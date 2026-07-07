const { Result, ResultDetail, Student, Class, AcademicSession, Term, ResultPin, User } = require('../models')

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

    if (className && !classId) {
      const classRecord = await Class.findOne({ name: className })
      if (!classRecord) return res.status(404).json({ message: 'Class not found' })
      classId = classRecord._id
    }

    const existing = await Result.findOne({ student: studentId, session: sessionId, term: termId })
    if (existing) return res.status(400).json({ message: 'Result already exists for this student in this session/term' })

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
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
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
    res.status(500).json({ message: 'Server error', error: error.message })
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
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.toggleWithhold = async (req, res) => {
  try {
    const { withheld } = req.body
    const result = await Result.findByIdAndUpdate(req.params.id, { withheld }, { new: true })
    res.json({ message: withheld ? 'Result withheld' : 'Result released', result })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
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
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
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
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.checkByRegNo = async (req, res) => {
  try {
    const { regNo, sessionId, termId, pin } = req.query
    const student = await Student.findOne({ regNo }).populate('class')
    if (!student) return res.status(404).json({ message: 'Student not found' })

    const pinRecord = await ResultPin.findOne({ pin })
    if (!pinRecord || !pinRecord.isActive) return res.status(401).json({ message: 'Invalid or expired PIN' })
    if (pinRecord.regNo !== regNo) return res.status(401).json({ message: 'PIN does not match this registration number' })
    if (pinRecord.usedCount >= pinRecord.maxUses) {
      await ResultPin.findByIdAndUpdate(pinRecord._id, { isActive: false })
      return res.status(401).json({ message: 'PIN has expired (max uses reached)' })
    }

    await ResultPin.findByIdAndUpdate(pinRecord._id, { $inc: { usedCount: 1 } })

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
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updatePrincipalComment = async (req, res) => {
  try {
    const { principalComment } = req.body
    const result = await Result.findByIdAndUpdate(req.params.id, { principalComment }, { new: true })
    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
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
    res.status(500).json({ message: 'Server error', error: error.message })
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
    res.status(500).json({ message: 'Server error', error: error.message })
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
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}