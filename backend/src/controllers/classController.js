const prisma = require('../utils/prisma')

exports.getClasses = async (req, res) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        _count: { select: { students: true, subjects: true } },
        subjects: { orderBy: { name: 'asc' } }
      },
      orderBy: { name: 'asc' }
    })
    res.json(classes)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createClass = async (req, res) => {
  try {
    const { name, level } = req.body
    const existing = await prisma.class.findUnique({ where: { name } })
    if (existing) {
      return res.status(400).json({ message: 'Class already exists' })
    }
    const newClass = await prisma.class.create({ data: { name, level } })
    res.status(201).json(newClass)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getClassSubjects = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { classId: req.params.classId },
      orderBy: { name: 'asc' }
    })
    res.json(subjects)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createSubject = async (req, res) => {
  try {
    const { name, classId } = req.body
    const subject = await prisma.subject.create({ data: { name, classId } })
    res.status(201).json(subject)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.assignFormTeacher = async (req, res) => {
  try {
    const { userId, classId } = req.body
    const assignment = await prisma.classTeacher.create({ data: { userId, classId } })
    res.status(201).json(assignment)
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Teacher already assigned to this class' })
    }
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getFormTeachers = async (req, res) => {
  try {
    const assignments = await prisma.classTeacher.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        class: true
      }
    })
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMyAssignment = async (req, res) => {
  try {
    const assignment = await prisma.classTeacher.findFirst({
      where: { userId: req.user.id },
      include: { class: true }
    })
    if (!assignment) return res.status(404).json({ message: 'No class assignment found' })
    res.json(assignment)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getSessions = async (req, res) => {
  try {
    const sessions = await prisma.academicSession.findMany({
      include: { terms: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createSession = async (req, res) => {
  try {
    const { name, isCurrent } = req.body
    if (isCurrent) {
      await prisma.academicSession.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } })
    }
    const session = await prisma.academicSession.create({ data: { name, isCurrent: isCurrent || false } })
    res.status(201).json(session)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createTerm = async (req, res) => {
  try {
    const { name, sessionId, isCurrent } = req.body
    if (isCurrent) {
      await prisma.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } })
    }
    const term = await prisma.term.create({ data: { name, sessionId, isCurrent: isCurrent || false } })
    res.status(201).json(term)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
