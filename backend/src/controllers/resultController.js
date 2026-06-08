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
    if (existing) {
      return res.status(400).json({ message: 'Result already exists for this student in this session/term' })
    }

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
        studentId,
        classId,
        sessionId,
        termId,
        totalScore,
        average: Math.round(average * 100) / 100,
        examOfficerId: req.user.id,
        details: { create: details }
      },
      include: {
        details: { include: { subject: true } },
        student: true,
        class: true,
        session: true,
        term: true
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
        class: true,
        session: true,
        term: true
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
        class: true,
        session: true,
        term: true,
        examOfficer: { select: { firstName: true, lastName: true } },
        formTeacher: { select: { firstName: true, lastName: true } }
      }
    })
    if (!result) {
      return res.status(404).json({ message: 'Result not found' })
    }
    res.json(result)
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
      await prisma.result.update({
        where: { id: results[i].id },
        data: { position: i + 1 }
      })
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
    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }

    const result = await prisma.result.findFirst({
      where: { studentId: student.id, sessionId, termId },
      include: {
        details: { include: { subject: true }, orderBy: { subject: { name: 'asc' } } },
        class: true,
        session: true,
        term: true
      }
    })
    if (!result) {
      return res.status(404).json({ message: 'Result not found for this session/term' })
    }

    res.json({ student, result })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getFormTeacherClassResults = async (req, res) => {
  try {
    const classTeacher = await prisma.classTeacher.findFirst({
      where: { userId: req.user.id }
    })
    if (!classTeacher) {
      return res.status(403).json({ message: 'You are not assigned as a form teacher' })
    }

    const { sessionId, termId } = req.query
    const results = await prisma.result.findMany({
      where: {
        classId: classTeacher.classId,
        ...(sessionId && { sessionId }),
        ...(termId && { termId })
      },
      include: {
        student: true,
        session: true,
        term: true,
        details: { include: { subject: true } }
      },
      orderBy: { student: { lastName: 'asc' } }
    })

    res.json({ class: classTeacher.class, results })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
