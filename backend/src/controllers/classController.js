const { Class, Subject, ClassTeacher, AcademicSession, Term, User } = require('../models')

exports.getClasses = async (req, res) => {
  try {
    const classes = await Class.find().select('name level').sort({ name: 1 })
    res.json(classes)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createClass = async (req, res) => {
  try {
    const { name, level } = req.body
    const existing = await Class.findOne({ name })
    if (existing) {
      return res.status(400).json({ message: 'Class already exists' })
    }
    const newClass = await Class.create({ name, level })
    res.status(201).json(newClass)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getClassSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ class: req.params.classId }).sort({ name: 1 })
    res.json(subjects)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createSubject = async (req, res) => {
  try {
    const { name, classId } = req.body
    const subject = await Subject.create({ name, class: classId })
    res.status(201).json(subject)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.assignFormTeacher = async (req, res) => {
  try {
    const { userId, classId } = req.body
    const assignment = await ClassTeacher.create({ user: userId, class: classId })
    await assignment.populate('user', 'firstName lastName email').populate('class')
    res.status(201).json(assignment)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Teacher already assigned to this class' })
    }
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getFormTeachers = async (req, res) => {
  try {
    const assignments = await ClassTeacher.find()
      .populate('user', 'firstName lastName email')
      .populate('class')
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMyAssignment = async (req, res) => {
  try {
    const assignment = await ClassTeacher.findOne({ user: req.user.id }).populate('class')
    if (!assignment) return res.status(404).json({ message: 'No class assignment found' })
    res.json(assignment)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getSessions = async (req, res) => {
  try {
    const sessions = await AcademicSession.find()
      .populate('terms')
      .sort({ createdAt: -1 })
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createSession = async (req, res) => {
  try {
    const { name, isCurrent } = req.body
    if (isCurrent) {
      await AcademicSession.updateMany({ isCurrent: true }, { isCurrent: false })
    }
    const session = await AcademicSession.create({ name, isCurrent: isCurrent || false })
    res.status(201).json(session)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createTerm = async (req, res) => {
  try {
    const { name, sessionId, isCurrent } = req.body
    if (isCurrent) {
      await Term.updateMany({ isCurrent: true }, { isCurrent: false })
    }
    const term = await Term.create({ name, session: sessionId, isCurrent: isCurrent || false })
    await AcademicSession.findByIdAndUpdate(sessionId, { $push: { terms: term._id } })
    res.status(201).json(term)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}