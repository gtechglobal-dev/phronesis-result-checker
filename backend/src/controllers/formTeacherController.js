const { ClassTeacher, Student, Result, ResultDetail, Class, Term, Subject } = require('../models')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

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

    const classTeacher = await ClassTeacher.findOne({ user: req.user.id }).populate('class')
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    const classRecord = classTeacher.class
    const classSubjects = await Subject.find({ class: classRecord._id }).sort({ createdAt: 1 })
    const students = await Student.find({ class: classRecord._id }).sort({ lastName: 1 })

    const results = await Result.find({ class: classRecord._id, session: sessionId, term: termId })
      .populate({ path: 'details', populate: { path: 'subject' } })

    const termData = await Term.findById(termId)

    const resultMap = {}
    for (const r of results) {
      resultMap[r.student._id.toString()] = r
    }

    const rows = students.map(student => {
      const result = resultMap[student._id.toString()]
      const details = {}
      let totalScore = 0
      let subjectCount = 0

      for (const sub of classSubjects) {
        const detail = result?.details.find(d => d.subject._id.toString() === sub._id.toString())
        if (detail) {
          details[sub._id] = { ca1: detail.ca1, ca2: detail.ca2, exam: detail.exam, total: detail.total, grade: detail.grade, remark: detail.remark }
          totalScore += detail.total
          subjectCount++
        } else {
          details[sub._id] = null
        }
      }

      const average = subjectCount > 0 ? Math.round((totalScore / subjectCount) * 100) / 100 : 0
      return {
        student: { id: student._id, regNo: student.regNo, firstName: student.firstName, lastName: student.lastName, arm: student.arm, gender: student.gender },
        details,
        totalScore,
        average,
        subjectCount,
        resultId: result?._id || null,
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
      class: { id: classRecord._id, name: classRecord.name, level: classRecord.level },
      subjects: classSubjects,
      students: rows,
      daysOpen: termData?.daysOpen ?? null,
      nextResumptionDate: termData?.nextResumptionDate ?? null
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updateComment = async (req, res) => {
  try {
    const { resultId, teacherComment } = req.body
    await Result.findByIdAndUpdate(resultId, { teacherComment })
    res.json({ message: 'Comment saved' })
    try { emitToRole('EXAM_OFFICER', 'result:comment', { resultId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updateSettings = async (req, res) => {
  try {
    const { termId, daysOpen, nextResumptionDate } = req.body
    if (!termId) return res.status(400).json({ message: 'termId required' })

    const classTeacher = await ClassTeacher.findOne({ user: req.user.id })
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    await Term.findByIdAndUpdate(termId, { daysOpen: daysOpen != null ? parseInt(daysOpen) : undefined, nextResumptionDate })
    res.json({ message: 'Settings saved' })
    try { emitBroadcast('entity:updated', { type: 'settings' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updateAttendance = async (req, res) => {
  try {
    const { records } = req.body
    if (!Array.isArray(records)) return res.status(400).json({ message: 'records array required' })

    for (const rec of records) {
      if (rec.resultId) {
        await Result.findByIdAndUpdate(rec.resultId, {
          daysPresent: rec.daysPresent != null ? parseInt(rec.daysPresent) : undefined,
          daysAbsent: rec.daysAbsent != null ? parseInt(rec.daysAbsent) : undefined
        })
      }
    }
    res.json({ message: 'Attendance saved' })
    try { emitBroadcast('entity:updated', { type: 'attendance' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.submitBroadsheet = async (req, res) => {
  try {
    const { sessionId, termId } = req.body
    if (!sessionId || !termId) return res.status(400).json({ message: 'sessionId and termId required' })

    const classTeacher = await ClassTeacher.findOne({ user: req.user.id }).populate('class')
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    const results = await Result.find({ class: classTeacher.class._id, session: sessionId, term: termId })

    if (!results.length) return res.status(400).json({ message: 'No results to submit' })

    for (const r of results) {
      const allDetails = await ResultDetail.find({ result: r._id }).populate('subject')

      let totalScore = 0
      for (const d of allDetails) totalScore += d.total
      const average = allDetails.length > 0 ? Math.round((totalScore / allDetails.length) * 100) / 100 : 0

      await Result.findByIdAndUpdate(r._id, { totalScore, average, status: 'SUBMITTED', formTeacher: req.user.id })
    }

    const allResults = await Result.find({ class: classTeacher.class._id, session: sessionId, term: termId })
      .sort({ totalScore: -1 })

    for (let i = 0; i < allResults.length; i++) {
      await Result.findByIdAndUpdate(allResults[i]._id, { position: i + 1 })
    }

    res.json({ message: 'Broadsheet submitted successfully' })
    try { emitToRole('EXAM_OFFICER', 'result:status', { class: classTeacher.class._id, sessionId, termId, status: 'SUBMITTED' }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}