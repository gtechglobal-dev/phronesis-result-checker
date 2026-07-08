const { SubjectAssignment, User, Subject, Class } = require('../models')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

exports.create = async (req, res) => {
  try {
    const { userId, subjectId, classId } = req.body
    const existing = await SubjectAssignment.findOne({ user: userId, subject: subjectId, class: classId })
    if (existing) return res.status(400).json({ message: 'Teacher already assigned to this subject in this class' })

    const assignment = await SubjectAssignment.create({ user: userId, subject: subjectId, class: classId })
    await assignment.populate([
      { path: 'user', select: 'firstName lastName email' },
      { path: 'subject' },
      { path: 'class' }
    ])
    res.status(201).json(assignment)
    try { emitToRole('EXAM_OFFICER', 'subjectAssignment:created', { assignment }); emitBroadcast('entity:updated', { type: 'subjectAssignment' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.list = async (req, res) => {
  try {
    const { classId, subjectId } = req.query
    const where = {}
    if (classId) where.class = classId
    if (subjectId) where.subject = subjectId

    const assignments = await SubjectAssignment.find(where)
      .populate('user', 'firstName lastName email')
      .populate('subject')
      .populate('class')
      .sort([['class.name', 1], ['subject.name', 1]])
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getMyAssignment = async (req, res) => {
  try {
    const assignments = await SubjectAssignment.find({ user: req.user.id })
      .populate('subject')
      .populate('class')
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.remove = async (req, res) => {
  try {
    await SubjectAssignment.findByIdAndDelete(req.params.id)
    res.json({ message: 'Assignment removed' })
    try { emitToRole('EXAM_OFFICER', 'subjectAssignment:removed', { assignmentId: req.params.id }); emitBroadcast('entity:updated', { type: 'subjectAssignment' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}