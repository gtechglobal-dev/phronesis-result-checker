const prisma = require('../utils/prisma')

const calculateGrade = (score) => {
  if (score >= 80) return { grade: 'A', remark: 'Excellent' }
  if (score >= 70) return { grade: 'B', remark: 'Very Good' }
  if (score >= 60) return { grade: 'C', remark: 'Good' }
  if (score >= 50) return { grade: 'D', remark: 'Fair' }
  if (score >= 40) return { grade: 'E', remark: 'Poor' }
  return { grade: 'F', remark: 'Fail' }
}

exports.getBroadsheet = async (req, res) => {
  try {
    const { sessionId, termId } = req.query
    if (!sessionId || !termId) return res.status(400).json({ message: 'sessionId and termId required' })

    const classTeacher = await prisma.classTeacher.findFirst({
      where: { userId: req.user.id },
      include: { class: { include: { subjects: { orderBy: { name: 'asc' } } } } }
    })
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    const classRecord = classTeacher.class
    const students = await prisma.student.findMany({
      where: { classId: classRecord.id },
      orderBy: { lastName: 'asc' }
    })

    const results = await prisma.result.findMany({
      where: { classId: classRecord.id, sessionId, termId },
      include: { details: { include: { subject: true } } }
    })

    const term = await prisma.term.findUnique({ where: { id: termId } })

    const resultMap = {}
    for (const r of results) {
      resultMap[r.studentId] = r
    }

    const rows = students.map(student => {
      const result = resultMap[student.id]
      const details = {}
      let totalScore = 0
      let subjectCount = 0

      for (const sub of classRecord.subjects) {
        const detail = result?.details.find(d => d.subjectId === sub.id)
        if (detail) {
          details[sub.id] = { ca1: detail.ca1, ca2: detail.ca2, exam: detail.exam, total: detail.total, grade: detail.grade, remark: detail.remark }
          totalScore += detail.total
          subjectCount++
        } else {
          details[sub.id] = null
        }
      }

      const average = subjectCount > 0 ? Math.round((totalScore / subjectCount) * 100) / 100 : 0
      return {
        student: { id: student.id, regNo: student.regNo, firstName: student.firstName, lastName: student.lastName, arm: student.arm },
        details,
        totalScore,
        average,
        subjectCount,
        resultId: result?.id || null,
        status: result?.status || null,
        teacherComment: result?.teacherComment || null,
        principalComment: result?.principalComment || null,
        daysPresent: result?.daysPresent ?? null,
        daysAbsent: result?.daysAbsent ?? null
      }
    })

    rows.sort((a, b) => b.totalScore - a.totalScore)
    rows.forEach((row, i) => { row.position = i + 1 })

    res.json({
      class: { id: classRecord.id, name: classRecord.name, level: classRecord.level },
      subjects: classRecord.subjects,
      students: rows,
      daysOpen: term?.daysOpen ?? null,
      nextResumptionDate: term?.nextResumptionDate ?? null
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updateComment = async (req, res) => {
  try {
    const { resultId, teacherComment } = req.body
    await prisma.result.update({
      where: { id: resultId },
      data: { teacherComment }
    })
    res.json({ message: 'Comment saved' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updateSettings = async (req, res) => {
  try {
    const { termId, daysOpen, nextResumptionDate } = req.body
    if (!termId) return res.status(400).json({ message: 'termId required' })

    const classTeacher = await prisma.classTeacher.findFirst({
      where: { userId: req.user.id }
    })
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    await prisma.term.update({
      where: { id: termId },
      data: { daysOpen: daysOpen != null ? parseInt(daysOpen) : undefined, nextResumptionDate }
    })
    res.json({ message: 'Settings saved' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updateAttendance = async (req, res) => {
  try {
    const { records } = req.body
    if (!Array.isArray(records)) return res.status(400).json({ message: 'records array required' })

    for (const rec of records) {
      if (rec.resultId) {
        await prisma.result.update({
          where: { id: rec.resultId },
          data: { daysPresent: rec.daysPresent != null ? parseInt(rec.daysPresent) : undefined, daysAbsent: rec.daysAbsent != null ? parseInt(rec.daysAbsent) : undefined }
        })
      }
    }
    res.json({ message: 'Attendance saved' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.submitBroadsheet = async (req, res) => {
  try {
    const { sessionId, termId } = req.body
    if (!sessionId || !termId) return res.status(400).json({ message: 'sessionId and termId required' })

    const classTeacher = await prisma.classTeacher.findFirst({
      where: { userId: req.user.id },
      include: { class: true }
    })
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    const results = await prisma.result.findMany({
      where: { classId: classTeacher.classId, sessionId, termId }
    })

    if (!results.length) return res.status(400).json({ message: 'No results to submit' })

    for (const r of results) {
      const allDetails = await prisma.resultDetail.findMany({
        where: { resultId: r.id },
        include: { subject: true }
      })

      let totalScore = 0
      for (const d of allDetails) totalScore += d.total
      const average = allDetails.length > 0 ? Math.round((totalScore / allDetails.length) * 100) / 100 : 0

      await prisma.result.update({
        where: { id: r.id },
        data: { totalScore, average, status: 'SUBMITTED', formTeacherId: req.user.id }
      })
    }

    const allResults = await prisma.result.findMany({
      where: { classId: classTeacher.classId, sessionId, termId },
      orderBy: { totalScore: 'desc' }
    })
    for (let i = 0; i < allResults.length; i++) {
      await prisma.result.update({
        where: { id: allResults[i].id },
        data: { position: i + 1 }
      })
    }

    res.json({ message: 'Broadsheet submitted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
