const prisma = require('../utils/prisma')

exports.create = async (req, res) => {
  try {
    const { userId, subjectId, classId } = req.body
    const existing = await prisma.subjectAssignment.findUnique({
      where: { userId_subjectId_classId: { userId, subjectId, classId } }
    })
    if (existing) return res.status(400).json({ message: 'Teacher already assigned to this subject in this class' })

    const assignment = await prisma.subjectAssignment.create({
      data: { userId, subjectId, classId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, subject: true, class: true }
    })
    res.status(201).json(assignment)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.list = async (req, res) => {
  try {
    const { classId, subjectId } = req.query
    const where = {}
    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId

    const assignments = await prisma.subjectAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        subject: true,
        class: true
      },
      orderBy: [{ class: { name: 'asc' } }, { subject: { name: 'asc' } }]
    })
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMyAssignment = async (req, res) => {
  try {
    const assignments = await prisma.subjectAssignment.findMany({
      where: { userId: req.user.id },
      include: { subject: true, class: true }
    })
    if (!assignments.length) return res.status(404).json({ message: 'No subject assignments found' })
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.remove = async (req, res) => {
  try {
    await prisma.subjectAssignment.delete({ where: { id: req.params.id } })
    res.json({ message: 'Assignment removed' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
