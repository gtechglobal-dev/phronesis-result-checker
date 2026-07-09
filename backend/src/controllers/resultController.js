const { Result, ResultDetail, Student, Class, AcademicSession, Term, ResultPin, User, Subject } = require('../models')
const { isString, isValidObjectId, escapeRegex } = require('../utils/sanitize')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

const getPrincipalRemark = (average) => {
  if (average >= 80) return 'Excellent performance. Keep up the good work!'
  if (average >= 70) return 'Very good performance. Strive for excellence.'
  if (average >= 60) return 'Good performance. Room for improvement.'
  if (average >= 50) return 'Fair performance. Needs more effort.'
  if (average >= 40) return 'Poor performance. Significant improvement needed.'
  return 'Unsatisfactory performance. Urgent improvement required.'
}

const getTeacherComment = (average) => {
  if (average >= 80) return 'A consistent and commendable performance. Well done!'
  if (average >= 70) return 'Shown good understanding of the subjects. Keep striving.'
  if (average >= 60) return 'Making progress. Encourage more reading and practice.'
  if (average >= 50) return 'Average performance. Needs to be more attentive in class.'
  if (average >= 40) return 'Below average. Requires extra tutoring and supervision.'
  return 'Poor performance. Urgent intervention and parental support needed.'
}

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
      const reason = result.withholdReason || 'Result withheld. Please contact the school.'
      return res.json({ withheld: true, message: reason, student: result.student, class: result.class, session: result.session, term: result.term })
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.toggleWithhold = async (req, res) => {
  try {
    const { withheld, reason } = req.body
    const update = { withheld }
    if (withheld && reason) update.withholdReason = reason
    if (!withheld) update.withholdReason = ''
    const result = await Result.findByIdAndUpdate(req.params.id, update, { new: true })
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
      const pos = i === 0 ? 1 : results[i].totalScore === results[i - 1].totalScore ? results[i - 1].position : i + 1
      await Result.findByIdAndUpdate(results[i]._id, { position: pos })
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
      const reason = result.withholdReason || 'Result withheld. Please contact the school.'
      return res.json({ withheld: true, message: reason, student, result: null })
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

exports.getPendingSummary = async (req, res) => {
  try {
    const sessions = await Result.distinct('session', { status: 'SUBMITTED' })
    const populated = await AcademicSession.find({ _id: { $in: sessions } })
      .populate('terms')
      .sort({ createdAt: -1 })
    const result = await Promise.all(populated.map(async (s) => {
      const termIds = await Result.distinct('term', { session: s._id, status: 'SUBMITTED' })
      const terms = s.terms.filter(t => termIds.some(id => id.toString() === t._id.toString()))
      const termData = await Promise.all(terms.map(async (t) => {
        const classIds = await Result.distinct('class', { session: s._id, term: t._id })
        const studentIds = await Result.distinct('student', { session: s._id, term: t._id })
        return {
          _id: t._id, name: t.name,
          classCount: classIds.length,
          studentCount: studentIds.length,
        }
      }))
      return { _id: s._id, name: s.name, terms: termData }
    }))
    res.json(result)
  } catch (error) {
    console.error('getPendingSummary error:', error.message)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.getPendingBroadsheet = async (req, res) => {
  try {
    const { sessionId, termId, classId } = req.params
    const classRecord = await Class.findById(classId)
    if (!classRecord) return res.status(404).json({ message: 'Class not found' })

    const classSubjects = await Subject.find({ class: classId }).sort({ createdAt: 1 })
    const students = await Student.find({ class: classId }).sort({ lastName: 1 })

    const results = await Result.find({ class: classId, session: sessionId, term: termId, status: 'SUBMITTED' })
      .populate('student')
      .populate({ path: 'details', populate: { path: 'subject' } })

    const resultMap = {}
    for (const r of results) {
      if (!r.student) continue
      const sid = r.student._id.toString()
      const existing = resultMap[sid]
      if (!existing || r.details.length > existing.details.length) {
        resultMap[sid] = r
      }
    }

    const rows = students.map(student => {
      const result = resultMap[student._id.toString()]
      const details = {}
      let totalScore = 0
      let subjectCount = 0

      for (const sub of classSubjects) {
        const detail = result?.details.find(d => d.subject._id.toString() === sub._id.toString())
        if (detail) {
          details[sub._id] = { ca1: detail.ca1, ca2: detail.ca2, exam: detail.exam, total: detail.total, grade: detail.grade, remark: detail.remark, submitted: detail.submitted }
          totalScore += detail.total
          subjectCount++
        } else {
          details[sub._id] = null
        }
      }

      const average = subjectCount > 0 ? Math.round((totalScore / subjectCount) * 100) / 100 : 0
      const autoTeacherComment = getTeacherComment(average)
      const autoPrincipalRemark = getPrincipalRemark(average)
      return {
        student: { id: student._id, regNo: student.regNo, firstName: student.firstName, lastName: student.lastName, arm: student.arm, gender: student.gender },
        details,
        totalScore,
        average,
        subjectCount,
        resultId: result?._id || null,
        status: result?.status || null,
        teacherComment: result?.teacherComment || null,
        autoTeacherComment,
        principalComment: result?.principalComment || null,
        autoPrincipalRemark,
        withheld: result?.withheld || false,
        daysPresent: result?.daysPresent ?? null,
        daysAbsent: result?.daysAbsent ?? null,
        savedPosition: result?.position ?? null,
      }
    })

    const sorted = [...rows].sort((a, b) => b.totalScore - a.totalScore)
    sorted.forEach((row, i) => {
      if (row.savedPosition != null) {
        row.position = row.savedPosition
      } else {
        if (i === 0) row.position = 1
        else row.position = row.totalScore === sorted[i - 1].totalScore ? sorted[i - 1].position : i + 1
      }
    })

    const termData = await Term.findById(termId)
    res.json({
      class: { id: classRecord._id, name: classRecord.name, level: classRecord.level },
      subjects: classSubjects,
      students: rows,
      daysOpen: termData?.daysOpen ?? null,
      nextResumptionDate: termData?.nextResumptionDate ?? null,
    })
  } catch (error) {
    console.error('getPendingBroadsheet error:', error.message, error.stack)
    res.status(500).json({ message: 'Server error' })
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
          const reason = r.withholdReason || 'Result withheld. Please contact the school.'
          return { ...r.toObject(), withheld: true, details: [], totalScore: 0, average: 0, _message: reason }
        }
        return r
      })
    }))

    res.json(mapped)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getPublishedSessions = async (req, res) => {
  try {
    const sessionIds = await Result.distinct('session')
    const sessions = await AcademicSession.find({ _id: { $in: sessionIds } })
      .populate('terms')
      .sort({ createdAt: -1 })
    const result = await Promise.all(sessions.map(async (s) => {
      const termIds = await Result.distinct('term', { session: s._id })
      const terms = s.terms.filter(t => termIds.some(id => id.toString() === t._id.toString()))
      return { _id: s._id, name: s.name, terms: terms.map(t => ({ _id: t._id, name: t.name })) }
    }))
    res.json(result)
  } catch (error) {
    console.error('getPublishedSessions error:', error.message)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.getArchiveSessions = async (req, res) => {
  try {
    const sessions = await Result.distinct('session')
    const populated = await AcademicSession.find({ _id: { $in: sessions } })
      .populate('terms')
      .sort({ createdAt: -1 })
    const result = await Promise.all(populated.map(async (s) => {
      const termIds = await Result.distinct('term', { session: s._id })
      const terms = s.terms.filter(t => termIds.some(id => id.toString() === t._id.toString()))
      const termData = await Promise.all(terms.map(async (t) => {
        const classIds = await Result.distinct('class', { session: s._id, term: t._id })
        const studentIds = await Result.distinct('student', { session: s._id, term: t._id })
        const studentCount = studentIds.length
        return {
          _id: t._id, name: t.name,
          classCount: classIds.length,
          studentCount,
        }
      }))
      return { _id: s._id, name: s.name, terms: termData }
    }))
    res.json(result)
  } catch (error) {
    console.error('getArchiveSessions error:', error.message)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.getArchiveClasses = async (req, res) => {
  try {
    const { sessionId, termId } = req.params
    const classIds = await Result.distinct('class', { session: sessionId, term: termId })
    const classes = await Class.find({ _id: { $in: classIds } }).sort({ name: 1 })
    const result = await Promise.all(classes.map(async (c) => {
      const studentIds = await Result.distinct('student', { session: sessionId, term: termId, class: c._id })
      const studentCount = studentIds.length
      const publishedStudentIds = await Result.distinct('student', { session: sessionId, term: termId, class: c._id, status: 'PUBLISHED' })
      const publishedCount = publishedStudentIds.length
      return { _id: c._id, name: c.name, level: c.level, studentCount, publishedCount }
    }))
    res.json(result)
  } catch (error) {
    console.error('getArchiveClasses error:', error.message)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.getArchiveBroadsheet = async (req, res) => {
  try {
    const { sessionId, termId, classId } = req.params
    const classRecord = await Class.findById(classId)
    if (!classRecord) return res.status(404).json({ message: 'Class not found' })

    const classSubjects = await Subject.find({ class: classId }).sort({ createdAt: 1 })
    const students = await Student.find({ class: classId }).sort({ lastName: 1 })

    const results = await Result.find({ class: classId, session: sessionId, term: termId })
      .populate('student')
      .populate({ path: 'details', populate: { path: 'subject' } })

    const resultMap = {}
    for (const r of results) {
      if (!r.student) continue
      const sid = r.student._id.toString()
      const existing = resultMap[sid]
      if (!existing || r.details.length > existing.details.length) {
        resultMap[sid] = r
      }
    }

    const rows = students.map(student => {
      const result = resultMap[student._id.toString()]
      const details = {}
      let totalScore = 0
      let subjectCount = 0

      for (const sub of classSubjects) {
        const detail = result?.details.find(d => d.subject._id.toString() === sub._id.toString())
        if (detail) {
          details[sub._id] = { ca1: detail.ca1, ca2: detail.ca2, exam: detail.exam, total: detail.total, grade: detail.grade, remark: detail.remark, submitted: detail.submitted }
          totalScore += detail.total
          subjectCount++
        } else {
          details[sub._id] = null
        }
      }

      const average = subjectCount > 0 ? Math.round((totalScore / subjectCount) * 100) / 100 : 0
      const autoTeacherComment = getTeacherComment(average)
      const autoPrincipalRemark = getPrincipalRemark(average)
      return {
        student: { id: student._id, regNo: student.regNo, firstName: student.firstName, lastName: student.lastName, arm: student.arm, gender: student.gender },
        details,
        totalScore,
        average,
        subjectCount,
        resultId: result?._id || null,
        status: result?.status || null,
        teacherComment: result?.teacherComment || null,
        autoTeacherComment,
        principalComment: result?.principalComment || null,
        autoPrincipalRemark,
        withheld: result?.withheld || false,
        daysPresent: result?.daysPresent ?? null,
        daysAbsent: result?.daysAbsent ?? null,
        savedPosition: result?.position ?? null,
      }
    })

    const sorted = [...rows].sort((a, b) => b.totalScore - a.totalScore)
    sorted.forEach((row, i) => {
      if (row.savedPosition != null) {
        row.position = row.savedPosition
      } else {
        if (i === 0) row.position = 1
        else row.position = row.totalScore === sorted[i - 1].totalScore ? sorted[i - 1].position : i + 1
      }
    })

    const termData = await Term.findById(termId)
    res.json({
      class: { id: classRecord._id, name: classRecord.name, level: classRecord.level },
      subjects: classSubjects,
      students: rows,
      daysOpen: termData?.daysOpen ?? null,
      nextResumptionDate: termData?.nextResumptionDate ?? null,
    })
  } catch (error) {
    console.error('getArchiveBroadsheet error:', error.message, error.stack)
    res.status(500).json({ message: 'Server error' })
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

exports.updateStudentScores = async (req, res) => {
  try {
    const { scores } = req.body
    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ message: 'Scores are required' })
    }

    const result = await Result.findById(req.params.id)
    if (!result) return res.status(404).json({ message: 'Result not found' })

    let totalScore = 0
    for (const s of scores) {
      const total = s.ca1 + s.ca2 + s.exam
      const { grade, remark } = calculateGrade(total)
      totalScore += total
      await ResultDetail.findOneAndUpdate(
        { result: result._id, subject: s.subjectId },
        { ca1: s.ca1, ca2: s.ca2, exam: s.exam, total, grade, remark },
        { upsert: true }
      )
    }

    const average = totalScore / scores.length
    result.totalScore = totalScore
    result.average = Math.round(average * 100) / 100
    await result.save()

    const populated = await Result.findById(result._id)
      .populate({ path: 'details', populate: { path: 'subject' } })
      .populate('student')

    res.json(populated)
    try { emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    console.error('updateStudentScores error:', error.message, error.stack)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.publishClassResults = async (req, res) => {
  try {
    const { sessionId, termId, classId } = req.params
    const result = await Result.updateMany(
      { class: classId, session: sessionId, term: termId, status: { $in: ['SUBMITTED', 'APPROVED'] } },
      { status: 'PUBLISHED' }
    )
    res.json({ message: `${result.modifiedCount} result(s) published`, count: result.modifiedCount })
    try { emitToRole('EXAM_OFFICER', 'result:published', { sessionId, termId, classId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    console.error('publishClassResults error:', error.message)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.getWithheldResults = async (req, res) => {
  try {
    const results = await Result.find({ withheld: true })
      .populate('student class session term')
      .populate({ path: 'details', populate: { path: 'subject' } })
      .sort({ updatedAt: -1 })
    res.json(results)
  } catch (error) {
    console.error('getWithheldResults error:', error.message)
    res.status(500).json({ message: 'Server error' })
  }
}