const prisma = require('../utils/prisma')

const calculateGrade = (score) => {
  if (score >= 80) return { grade: 'A', remark: 'Excellent' }
  if (score >= 70) return { grade: 'B', remark: 'Very Good' }
  if (score >= 60) return { grade: 'C', remark: 'Good' }
  if (score >= 50) return { grade: 'D', remark: 'Fair' }
  if (score >= 40) return { grade: 'E', remark: 'Poor' }
  return { grade: 'F', remark: 'Fail' }
}

exports.createResult = async (req, res) => {
  try {
    const { studentId, classId, sessionId, termId, scores } = req.body

    const existing = await prisma.result.findFirst({
      where: { studentId, sessionId, termId }
    })
    if (existing) return res.status(400).json({ message: 'Result already exists for this student in this session/term' })

    let totalScore = 0
    const details = scores.map((s) => {
      const total = s.ca1 + s.ca2 + s.exam
      const { grade, remark } = calculateGrade(total)
      totalScore += total
      return { subjectId: s.subjectId, ca1: s.ca1, ca2: s.ca2, exam: s.exam, total, grade, remark }
    })

    const average = totalScore / scores.length

    const result = await prisma.result.create({
      data: {
        studentId, classId, sessionId, termId,
        totalScore,
        average: Math.round(average * 100) / 100,
        examOfficerId: req.user.id,
        details: { create: details }
      },
      include: {
        details: { include: { subject: true } },
        student: true, class: true, session: true, term: true
      }
    })

    res.status(201).json(result)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getStudentResults = async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      where: { studentId: req.params.studentId },
      include: {
        details: { include: { subject: true }, orderBy: { subject: { name: 'asc' } } },
        class: true, session: true, term: true
      },
      orderBy: [{ session: { createdAt: 'desc' } }, { term: { createdAt: 'desc' } }]
    })
    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getResult = async (req, res) => {
  try {
    const result = await prisma.result.findUnique({
      where: { id: req.params.id },
      include: {
        details: { include: { subject: true }, orderBy: { subject: { name: 'asc' } } },
        student: { include: { class: true } },
        class: true, session: true, term: true,
        examOfficer: { select: { firstName: true, lastName: true } },
        formTeacher: { select: { firstName: true, lastName: true } }
      }
    })
    if (!result) return res.status(404).json({ message: 'Result not found' })

    if (result.withheld && req.user?.role !== 'EXAM_OFFICER') {
      return res.json({ withheld: true, message: 'Result withheld. Please clear fees.', student: result.student, class: result.class, session: result.session, term: result.term })
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.toggleWithhold = async (req, res) => {
  try {
    const { withheld } = req.body
    const result = await prisma.result.update({
      where: { id: req.params.id },
      data: { withheld }
    })
    res.json({ message: withheld ? 'Result withheld' : 'Result released', result })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.addTeacherComment = async (req, res) => {
  try {
    const { teacherComment } = req.body
    const result = await prisma.result.update({
      where: { id: req.params.id },
      data: { teacherComment, formTeacherId: req.user.id }
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updatePositions = async (req, res) => {
  try {
    const { classId, sessionId, termId } = req.body
    const results = await prisma.result.findMany({
      where: { classId, sessionId, termId },
      orderBy: { totalScore: 'desc' }
    })
    for (let i = 0; i < results.length; i++) {
      await prisma.result.update({ where: { id: results[i].id }, data: { position: i + 1 } })
    }
    res.json({ message: 'Positions updated successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.checkByRegNo = async (req, res) => {
  try {
    const { regNo, sessionId, termId } = req.query
    const student = await prisma.student.findUnique({ where: { regNo }, include: { class: true } })
    if (!student) return res.status(404).json({ message: 'Student not found' })

    const result = await prisma.result.findFirst({
      where: { studentId: student.id, sessionId, termId },
      include: {
        details: { include: { subject: true }, orderBy: { subject: { name: 'asc' } } },
        class: true, session: true, term: true
      }
    })
    if (!result) return res.status(404).json({ message: 'Result not found for this session/term' })

    if (result.withheld) {
      return res.json({ withheld: true, message: 'Result withheld. Please clear fees.', student, result: null })
    }

    res.json({ student, result })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getFormTeacherClassResults = async (req, res) => {
  try {
    const { sessionId, termId, classId: queryClassId } = req.query

    let classId
    if (req.user.role === 'EXAM_OFFICER') {
      classId = queryClassId
      if (!classId) return res.status(400).json({ message: 'classId required for exam officer' })
    } else {
      const classTeacher = await prisma.classTeacher.findFirst({ where: { userId: req.user.id } })
      if (!classTeacher) return res.status(403).json({ message: 'Not assigned as a form teacher' })
      classId = classTeacher.classId
    }

    const results = await prisma.result.findMany({
      where: {
        classId,
        ...(sessionId && { sessionId }),
        ...(termId && { termId })
      },
      include: {
        student: true, session: true, term: true,
        details: { include: { subject: true } }
      },
      orderBy: { student: { lastName: 'asc' } }
    })

    const classInfo = await prisma.class.findUnique({ where: { id: classId } })
    res.json({ class: classInfo, results })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getParentChildrenResults = async (req, res) => {
  try {
    const children = await prisma.student.findMany({
      where: { parentId: req.user.id },
      include: {
        class: true,
        results: {
          include: {
            details: { include: { subject: true }, orderBy: { subject: { name: 'asc' } } },
            session: true, term: true, class: true
          },
          orderBy: [{ session: { createdAt: 'desc' } }, { term: { createdAt: 'desc' } }]
        }
      }
    })

    const mapped = children.map(child => ({
      ...child,
      results: child.results.map(r => {
        if (r.withheld) {
          return { ...r, withheld: true, details: [], totalScore: 0, average: 0, _message: 'Result withheld. Please clear fees.' }
        }
        return r
      })
    }))

    res.json(mapped)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
