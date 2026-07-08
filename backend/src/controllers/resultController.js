const { Result, ResultDetail, Student, Class, AcademicSession, Term, ResultPin, User } = require('../models')
const { isString, isValidObjectId, escapeRegex } = require('../utils/sanitize')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

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
    const { studentId, classId, className, sessionId, termId, scores } = req.body

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ message: 'Scores are required' })
    }

    if (className && !classId) {
      if (!isString(className)) return res.status(400).json({ message: 'Invalid class name' })
      const classRecord = await Class.findOne({ name: className })
      if (!classRecord) return res.status(404).json({ message: 'Class not found' })
      classId = classRecord._id
    }

    if (!isValidObjectId(sessionId) || !isValidObjectId(termId)) {
      return res.status(400).json({ message: 'Invalid session or term' })
    }

    let totalScore = 0
    const details = scores.map((s) => {
      const total = s.ca1 + s.ca2 + s.exam
      const { grade, remark } = calculateGrade(total)
      totalScore += total
      return { subject: s.subjectId, ca1: s.ca1, ca2: s.ca2, exam: s.exam, total, grade, remark }
    })

    const average = totalScore / scores.length

    const result = await Result.create({
      student: studentId,
      class: classId,
      session: sessionId,
      term: termId,
      totalScore,
      average: Math.round(average * 100) / 100,
      examOfficer: req.user.id,
    })

    const detailDocs = details.map(d => ({ ...d, result: result._id }))
    await ResultDetail.insertMany(detailDocs)

    const populatedResult = await Result.findById(result._id)
      .populate({
        path: 'details',
        populate: { path: 'subject' }
      })
      .populate('student class session term examOfficer', 'firstName lastName')

    res.status(201).json(populatedResult)
    try { emitToRole('EXAM_OFFICER', 'result:created', { result: populatedResult }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getStudentResults = async (req, res) => {
  try {
    const results = await Result.find({ student: req.params.studentId })
      .populate({
        path: 'details',
        populate: { path: 'subject' },
        options: { sort: { 'subject.name': 1 } }
      })
      .populate('class session term')
      .sort({ 'session.createdAt': -1, 'term.createdAt': -1 })
    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getResult = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate({
        path: 'details',
        populate: { path: 'subject' },
        options: { sort: { 'subject.name': 1 } }
      })
      .populate('student class session term examOfficer formTeacher', 'firstName lastName')

    if (!result) return res.status(404).json({ message: 'Result not found' })

    if (result.withheld && req.user?.role !== 'EXAM_OFFICER') {
      return res.json({ withheld: true, message: 'Result withheld. Please clear fees.', student: result.student, class: result.class, session: result.session, term: result.term })
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.toggleWithhold = async (req, res) => {
  try {
    const { withheld } = req.body
    const result = await Result.findByIdAndUpdate(req.params.id, { withheld }, { new: true })
    res.json({ message: withheld ? 'Result withheld' : 'Result released', result })
    try { emitToRole('EXAM_OFFICER', 'result:withheld', { resultId: req.params.id, withheld }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.addTeacherComment = async (req, res) => {
  try {
    const { teacherComment } = req.body
    const result = await Result.findByIdAndUpdate(
      req.params.id,
      { teacherComment, formTeacher: req.user.id },
      { new: true }
    )
    res.json(result)
    try { emitToRole('EXAM_OFFICER', 'result:comment', { result }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updatePositions = async (req, res) => {
  try {
    const { classId, sessionId, termId } = req.body
    const results = await Result.find({ class: classId, session: sessionId, term: termId })
      .sort({ totalScore: -1 })

    for (let i = 0; i < results.length; i++) {
      await Result.findByIdAndUpdate(results[i]._id, { position: i + 1 })
    }
    res.json({ message: 'Positions updated successfully' })
    try { emitToRole('EXAM_OFFICER', 'result:positions', { classId, sessionId, termId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.checkByRegNo = async (req, res) => {
  try {
    const { regNo, sessionId, termId, pin } = req.body

    if (!isString(regNo) || !isString(pin) || !isString(sessionId) || !isString(termId)) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    if (!/^[A-Z0-9]{8}$/i.test(pin)) {
      return res.status(400).json({ message: 'Invalid PIN format' })
    }

    const student = await Student.findOne({ regNo: regNo.trim().toUpperCase() }).populate('class')
    if (!student) return res.status(404).json({ message: 'Student not found' })

    const pinRecord = await ResultPin.findOne({ pin: pin.toUpperCase() })
    if (!pinRecord || !pinRecord.isActive) return res.status(401).json({ message: 'Invalid or expired PIN' })

    const trimmedRegNo = regNo.trim().toUpperCase()

    const differentRegNo = pinRecord.usedBy.find(u => u.regNo !== trimmedRegNo)
    if (differentRegNo) {
      return res.status(401).json({ message: 'This PIN has already been used by another student' })
    }

    if (pinRecord.usedCount >= pinRecord.maxUses) {
      await ResultPin.findByIdAndUpdate(pinRecord._id, { isActive: false })
      return res.status(401).json({ message: 'PIN has expired (max uses reached)' })
    }

    await ResultPin.findByIdAndUpdate(pinRecord._id, {
      $inc: { usedCount: 1 },
      $push: { usedBy: { regNo: trimmedRegNo, usedAt: new Date() } },
    })
    try { emitToRole('EXAM_OFFICER', 'pin:used', { pin: pinRecord.pin, regNo: trimmedRegNo }) } catch (e) {}

    const result = await Result.findOne({ student: student._id, session: sessionId, term: termId })
      .populate({
        path: 'details',
        populate: { path: 'subject' },
        options: { sort: { 'subject.name': 1 } }
      })
      .populate('class session term')
    if (!result) return res.status(404).json({ message: 'Result not found for this session/term' })

    if (result.withheld) {
      return res.json({ withheld: true, message: 'Result withheld. Please clear fees.', student, result: null })
    }

    const termData = await Term.findById(termId)
    res.json({
      student,
      result: {
        ...result.toObject(),
        daysOpen: termData?.daysOpen,
        nextResumptionDate: termData?.nextResumptionDate
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updatePrincipalComment = async (req, res) => {
  try {
    const { principalComment } = req.body
    const result = await Result.findByIdAndUpdate(req.params.id, { principalComment }, { new: true })
    res.json(result)
    try { emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getPendingResults = async (req, res) => {
  try {
    const { sessionId, termId, classId } = req.query
    const where = { status: 'SUBMITTED' }
    if (sessionId) where.session = sessionId
    if (termId) where.term = termId
    if (classId) where.class = classId

    const results = await Result.find(where)
      .populate('student class session term')
      .populate({
        path: 'details',
        populate: { path: 'subject' }
      })
      .sort({ 'class.name': 1, 'student.lastName': 1 })
    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getFormTeacherClassResults = async (req, res) => {
  try {
    const { sessionId, termId, classId: queryClassId, className } = req.query

    let classId
    if (className) {
      const classRecord = await Class.findOne({ name: className })
      if (!classRecord) return res.status(404).json({ message: 'Class not found' })
      classId = classRecord._id
    } else if (req.user.role === 'EXAM_OFFICER') {
      classId = queryClassId
      if (!classId) return res.status(400).json({ message: 'classId required for exam officer' })
    } else {
      const classTeacher = await require('../models/ClassTeacher').findOne({ user: req.user.id })
      if (!classTeacher) return res.status(403).json({ message: 'Not assigned as a form teacher' })
      classId = classTeacher.class
    }

    const where = { class: classId }
    if (sessionId) where.session = sessionId
    if (termId) where.term = termId

    const results = await Result.find(where)
      .populate('student session term')
      .populate({
        path: 'details',
        populate: { path: 'subject' }
      })
      .sort({ 'student.lastName': 1 })

    const classInfo = await Class.findById(classId)
    res.json({ class: classInfo, results })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getParentChildrenResults = async (req, res) => {
  try {
    const children = await Student.find({ parent: req.user.id })
      .populate('class')
      .populate({
        path: 'results',
        populate: [
          { path: 'details', populate: { path: 'subject' }, options: { sort: { 'subject.name': 1 } } },
          { path: 'session' },
          { path: 'term' },
          { path: 'class' }
        ],
        options: { sort: { 'session.createdAt': -1, 'term.createdAt': -1 } }
      })

    const mapped = children.map(child => ({
      ...child.toObject(),
      results: child.results.map(r => {
        if (r.withheld) {
          return { ...r.toObject(), withheld: true, details: [], totalScore: 0, average: 0, _message: 'Result withheld. Please clear fees.' }
        }
        return r
      })
    }))

    res.json(mapped)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getManageResults = async (req, res) => {
  try {
    const where = { status: { $in: ['APPROVED', 'PUBLISHED'] } }
    const results = await Result.find(where)
      .populate('student class session term')
      .sort({ 'class.name': 1, 'student.lastName': 1 })
    res.json(results)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updateResultStatus = async (req, res) => {
  try {
    const { status } = req.body
    const valid = ['SUBMITTED', 'APPROVED', 'PUBLISHED']
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' })
    const result = await Result.findByIdAndUpdate(req.params.id, { status }, { new: true })
    if (!result) return res.status(404).json({ message: 'Result not found' })
    res.json({ message: `Result ${status.toLowerCase()}`, result })
    try { emitToRole('EXAM_OFFICER', 'result:status', { resultId: req.params.id, status }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}