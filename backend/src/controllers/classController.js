const { Class, Subject, ClassTeacher, AcademicSession, Term, User, Student, Result } = require('../models')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

exports.getClasses = async (req, res) => {
  try {
    const classes = await Class.find().select('name level').sort({ name: 1 })
    res.json(classes)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
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
    try { emitBroadcast('entity:updated', { type: 'class' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getClassSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ class: req.params.classId }).sort({ createdAt: 1 })
    res.json(subjects)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.createSubject = async (req, res) => {
  try {
    const { name, classId } = req.body
    const subject = await Subject.create({ name, class: classId })
    res.status(201).json(subject)
    try { emitBroadcast('entity:updated', { type: 'subject' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.bulkCreateSubjects = async (req, res) => {
  try {
    const { names, classId } = req.body
    if (!names || !Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: 'Subject names are required' })
    }
    const existing = await Subject.find({ class: classId }).select('name')
    const existingNames = new Set(existing.map((s) => s.name.toLowerCase()))
    const created = []
    for (const name of names) {
      const trimmed = name.trim()
      if (!trimmed || existingNames.has(trimmed.toLowerCase())) continue
      const subject = await Subject.create({ name: trimmed, class: classId })
      created.push(subject)
      existingNames.add(trimmed.toLowerCase())
    }
    res.status(201).json({ subjects: created, count: created.length })
    try { emitBroadcast('entity:updated', { type: 'subject' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.deleteClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
    if (!cls) return res.status(404).json({ message: 'Class not found' })
    await Subject.deleteMany({ class: req.params.id })
    await Result.updateMany({ class: req.params.id }, { $unset: { class: '' } })
    await Class.findByIdAndDelete(req.params.id)
    res.json({ message: 'Class deleted' })
    try { emitBroadcast('entity:updated', { type: 'class' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
    if (!subject) return res.status(404).json({ message: 'Subject not found' })
    await Subject.findByIdAndDelete(req.params.id)
    res.json({ message: 'Subject deleted' })
    try { emitBroadcast('entity:updated', { type: 'subject' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.assignFormTeacher = async (req, res) => {
  try {
    const { userId, classId } = req.body
    const assignment = await ClassTeacher.create({ user: userId, class: classId })
    await assignment.populate('user', 'firstName lastName email').populate('class')
    res.status(201).json(assignment)
    try { emitToRole('EXAM_OFFICER', 'teacher:assigned', { teacherId: userId, classId }); emitBroadcast('entity:updated', { type: 'teacher' }) } catch (e) {}
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Teacher already assigned to this class' })
    }
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getFormTeachers = async (req, res) => {
  try {
    const assignments = await ClassTeacher.find()
      .populate('user', 'firstName lastName email')
      .populate('class')
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getMyAssignment = async (req, res) => {
  try {
    const assignment = await ClassTeacher.findOne({ user: req.user.id }).populate('class')
    if (!assignment) return res.status(404).json({ message: 'No class assignment found' })
    res.json(assignment)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
}

exports.getSessions = async (req, res) => {
  try {
    const sessions = await AcademicSession.find()
      .populate('terms')
      .sort({ createdAt: -1 })
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
}

exports.createSession = async (req, res) => {
  try {
    const { name, isCurrent } = req.body
    const existing = await AcademicSession.findOne({ name })
    if (existing) {
      return res.status(400).json({ message: 'Session already exists' })
    }
    if (isCurrent) {
      await AcademicSession.updateMany({ isCurrent: true }, { isCurrent: false })
    }
    const session = await AcademicSession.create({ name, isCurrent: isCurrent || false })
    res.status(201).json(session)
    try { emitBroadcast('entity:updated', { type: 'session' }) } catch (e) {}
  } catch (error) {
    console.error('createSession error:', error)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Session already exists' })
    }
    res.status(500).json({ message: 'Server error' })
  }
}

exports.createTerm = async (req, res) => {
  try {
    const { name, sessionId, isCurrent } = req.body
    const existing = await Term.findOne({ name, session: sessionId })
    if (existing) {
      return res.status(400).json({ message: 'Term already exists in this session' })
    }
    if (isCurrent) {
      await Term.updateMany({ isCurrent: true }, { isCurrent: false })
    }
    const term = await Term.create({ name, session: sessionId, isCurrent: isCurrent || false })
    await AcademicSession.findByIdAndUpdate(sessionId, { $push: { terms: term._id } })

    if (isCurrent) {
      const classes = await Class.find()
      for (const cls of classes) {
        const students = await Student.find({ class: cls._id })
        for (const student of students) {
          const existingResult = await Result.findOne({ student: student._id, session: sessionId, term: term._id })
          if (!existingResult) {
            await Result.create({
              student: student._id,
              class: cls._id,
              session: sessionId,
              term: term._id,
              examOfficer: req.user.id,
            })
          }
        }
      }
    }

    res.status(201).json(term)
    try { emitBroadcast('entity:updated', { type: 'term' }) } catch (e) {}
  } catch (error) {
    console.error('createTerm error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.deleteSession = async (req, res) => {
  try {
    const session = await AcademicSession.findById(req.params.id).populate('terms')
    if (!session) return res.status(404).json({ message: 'Session not found' })

    const termIds = session.terms.map(t => t._id)
    await Result.deleteMany({ session: req.params.id })
    await Term.deleteMany({ _id: { $in: termIds } })
    await AcademicSession.findByIdAndDelete(req.params.id)
    res.json({ message: 'Session deleted' })
    try { emitBroadcast('entity:updated', { type: 'session' }) } catch (e) {}
  } catch (error) {
    console.error('deleteSession error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.deleteTerm = async (req, res) => {
  try {
    const term = await Term.findById(req.params.id)
    if (!term) return res.status(404).json({ message: 'Term not found' })

    await Result.deleteMany({ term: req.params.id })
    await AcademicSession.findByIdAndUpdate(term.session, { $pull: { terms: term._id } })
    await Term.findByIdAndDelete(req.params.id)
    res.json({ message: 'Term deleted' })
    try { emitBroadcast('entity:updated', { type: 'term' }) } catch (e) {}
  } catch (error) {
    console.error('deleteTerm error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}