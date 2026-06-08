const prisma = require('../utils/prisma')

exports.getStudents = async (req, res) => {
  try {
    const { classId, arm } = req.query
    const where = {}
    if (classId) where.classId = classId
    if (arm) where.arm = arm

    const students = await prisma.student.findMany({
      where,
      include: {
        class: true,
        parent: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getStudent = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        class: { include: { subjects: true } },
        parent: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    })
    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }
    res.json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createStudent = async (req, res) => {
  try {
    const { regNo, firstName, lastName, classId, arm, parentId } = req.body
    const existing = await prisma.student.findUnique({ where: { regNo } })
    if (existing) {
      return res.status(400).json({ message: 'Registration number already exists' })
    }
    const student = await prisma.student.create({
      data: { regNo, firstName, lastName, classId, arm, parentId },
      include: { class: true }
    })
    res.status(201).json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updateStudent = async (req, res) => {
  try {
    const { firstName, lastName, classId, arm, parentId } = req.body
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { firstName, lastName, classId, arm, parentId },
      include: { class: true }
    })
    res.json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMyChildren = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { parentId: req.user.id },
      include: { class: true }
    })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getStudentsByClass = async (req, res) => {
  try {
    const classTeacher = await prisma.classTeacher.findFirst({
      where: { userId: req.user.id, classId: req.params.classId }
    })
    if (!classTeacher && req.user.role !== 'EXAM_OFFICER') {
      return res.status(403).json({ message: 'You are not assigned to this class' })
    }
    const students = await prisma.student.findMany({
      where: { classId: req.params.classId },
      include: { class: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
