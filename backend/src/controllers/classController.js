const { Class, Subject, ClassTeacher, AcademicSession, Term, User, Student, Result } = require('../models')
const { isValidObjectId } = require('../utils/sanitize')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

const getClassSortOrder = (name) => {
  const n = name.toLowerCase().trim()
  if (n.startsWith('montesorri') || n.startsWith('montessori')) return 1
  if (n.startsWith('nursery')) return 2
  if (n.startsWith('basic')) {
    const num = parseInt(n.match(/\d+/)?.[0] || '1')
    if (num <= 2) return 2 + num
    return 4 + (num - 2)
  }
  if (n.startsWith('jss')) {
    const num = parseInt(n.match(/\d+/)?.[0] || '1')
    const isB = n.includes('b')
    return 9 + (num - 1) * 2 + (isB ? 1 : 0)
  }
  if (n.startsWith('sss')) {
    const num = parseInt(n.match(/\d+/)?.[0] || '1')
    if (num === 1) return n.includes('b') ? 16 : 15
    if (num === 2) return 17
    if (num === 3) return 18
    return 14 + num
  }
  if (n.startsWith('graduat')) return 19
  return 99
}

exports.getClasses = async (req, res) => {
  try {
    const classes = await Class.find().select('name level')
    classes.sort((a, b) => getClassSortOrder(a.name) - getClassSortOrder(b.name))
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
    const { sessionId } = req.query
    const where = { class: req.params.classId }
    if (sessionId && isValidObjectId(sessionId)) where.session = sessionId
    const subjects = await Subject.find(where).sort({ createdAt: 1 })
    res.json(subjects)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.createSubject = async (req, res) => {
  try {
    const { name, classId, sessionId } = req.body
    if (!sessionId || !isValidObjectId(sessionId)) {
      return res.status(400).json({ message: 'sessionId is required' })
    }
    const existing = await Subject.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, class: classId, session: sessionId })
    if (existing) {
      return res.status(400).json({ message: 'Subject already exists in this class for this session' })
    }
    const subject = await Subject.create({ name, class: classId, session: sessionId })
    res.status(201).json(subject)
    try { emitBroadcast('entity:updated', { type: 'subject' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.bulkCreateSubjects = async (req, res) => {
  try {
    const { names, classId, sessionId } = req.body
    if (!names || !Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: 'Subject names are required' })
    }
    if (!sessionId || !isValidObjectId(sessionId)) {
      return res.status(400).json({ message: 'sessionId is required' })
    }
    const existing = await Subject.find({ class: classId, session: sessionId }).select('name')
    const existingNames = new Set(existing.map((s) => s.name.toLowerCase()))
    const created = []
    for (const name of names) {
      const trimmed = name.trim()
      if (!trimmed || existingNames.has(trimmed.toLowerCase())) continue
      const subject = await Subject.create({ name: trimmed, class: classId, session: sessionId })
      created.push(subject)
      existingNames.add(trimmed.toLowerCase())
    }
    res.status(201).json({ subjects: created, count: created.length })
    try { emitBroadcast('entity:updated', { type: 'subject' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.copySubjectsFromSession = async (req, res) => {
  try {
    const { fromSessionId, toSessionId, classMappings } = req.body
    if (!fromSessionId || !toSessionId || !classMappings || !Array.isArray(classMappings)) {
      return res.status(400).json({ message: 'fromSessionId, toSessionId, and classMappings array required' })
    }

    let copied = 0
    let skipped = 0

    for (const mapping of classMappings) {
      const { fromClassId, toClassId } = mapping
      if (!fromClassId || !toClassId) continue

      const subjects = await Subject.find({ class: fromClassId, session: fromSessionId })

      for (const subject of subjects) {
        const exists = await Subject.findOne({ name: subject.name, class: toClassId, session: toSessionId })
        if (exists) {
          skipped++
          continue
        }
        await Subject.create({
          name: subject.name,
          class: toClassId,
          session: toSessionId,
        })
        copied++
      }
    }

    res.json({ message: `${copied} subjects copied, ${skipped} skipped (already exist)` })
    try { emitBroadcast('entity:updated', { type: 'subject' }) } catch (e) {}
  } catch (error) {
    console.error('copySubjectsFromSession error:', error)
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

exports.reactivateSession = async (req, res) => {
  try {
    const { sessionId, termId } = req.body
    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' })

    await AcademicSession.updateMany({ isCurrent: true }, { isCurrent: false })
    await AcademicSession.findByIdAndUpdate(sessionId, { isCurrent: true })

    if (termId) {
      await Term.updateMany({ isCurrent: true }, { isCurrent: false })
      await Term.findByIdAndUpdate(termId, { isCurrent: true })
    }

    const session = await AcademicSession.findById(sessionId).populate('terms')
    res.json({ message: 'Session reactivated', session })
    try { emitBroadcast('entity:updated', { type: 'session' }) } catch (e) {}
  } catch (error) {
    console.error('reactivateSession error:', error)
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