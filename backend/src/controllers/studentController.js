const prisma = require('../utils/prisma')

exports.getStudents = async (req, res) => {
  try {
    const { classId, arm, search } = req.query
    const where = {}
    if (classId) where.classId = classId
    if (arm) where.arm = arm
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { regNo: { contains: search, mode: 'insensitive' } }
      ]
    }

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

exports.getUnlinkedStudents = async (req, res) => {
  try {
    const { classId, search } = req.query
    const where = { parentId: null }
    if (classId) where.classId = classId
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { regNo: { contains: search, mode: 'insensitive' } }
      ]
    }
    const students = await prisma.student.findMany({
      where,
      include: { class: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50
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
    if (!student) return res.status(404).json({ message: 'Student not found' })
    res.json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createStudent = async (req, res) => {
  try {
    const { regNo, firstName, lastName, classId, arm } = req.body
    const existing = await prisma.student.findUnique({ where: { regNo } })
    if (existing) return res.status(400).json({ message: 'Registration number already exists' })

    const student = await prisma.student.create({
      data: { regNo, firstName, lastName, classId, arm },
      include: { class: true }
    })
    res.status(201).json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.bulkCreateStudents = async (req, res) => {
  try {
    const { students } = req.body
    if (!students || students.length === 0) return res.status(400).json({ message: 'No students provided' })

    let created = 0
    for (const s of students) {
      const existing = await prisma.student.findUnique({ where: { regNo: s.regNo } })
      if (!existing) {
        await prisma.student.create({
          data: { regNo: s.regNo, firstName: s.firstName, lastName: s.lastName, classId: s.classId, arm: s.arm || 'A' }
        })
        created++
      }
    }
    res.status(201).json({ message: `${created} students created` })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updateStudent = async (req, res) => {
  try {
    const { firstName, lastName, classId, arm } = req.body
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { firstName, lastName, classId, arm },
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
      include: {
        class: true,
        results: { include: { session: true, term: true }, orderBy: { createdAt: 'desc' } }
      }
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
      return res.status(403).json({ message: 'Not assigned to this class' })
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
