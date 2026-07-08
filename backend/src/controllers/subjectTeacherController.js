const { SubjectAssignment, Result, ResultDetail, Student, Subject, Class } = require('../models')
const { isValidObjectId, isString } = require('../utils/sanitize')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

exports.getAssignment = async (req, res) => {
  try {
    const assignments = await SubjectAssignment.find({ user: req.user.id })
      .populate('subject')
      .populate({ path: 'class', populate: { path: 'students', options: { sort: { lastName: 1 } } } })
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getScores = async (req, res) => {
  try {
    const { sessionId, termId, classId, subjectId } = req.query
    if (!sessionId || !termId || !classId || !subjectId) {
      return res.status(400).json({ message: 'sessionId, termId, classId, subjectId required' })
    }

    const results = await Result.find({ class: classId, session: sessionId, term: termId })
      .populate('student')
      .populate({ path: 'details', match: { subject: subjectId } })

    const students = await Student.find({ class: classId }).sort({ lastName: 1 })

    const scoreMap = {}
    for (const r of results) {
      if (r.details.length) {
        scoreMap[r.student._id.toString()] = { resultId: r._id, ...r.details[0].toObject() }
      }
    }

    res.json({ students, scores: scoreMap, submitted: results.some(r => r.details.some(d => d.submitted)) })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.saveScores = async (req, res) => {
  try {
    const { sessionId, termId, classId, subjectId, scores } = req.body
    if (!sessionId || !termId || !classId || !subjectId || !scores) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    if (!Array.isArray(scores) || scores.length > 100) {
      return res.status(400).json({ message: 'Invalid scores data' })
    }

    const resultIds = (await Result.find({ class: classId, session: sessionId, term: termId }).select('_id')).map(r => r._id)
    const existingSubmitted = await ResultDetail.findOne({ result: { $in: resultIds }, subject: subjectId, submitted: true })
    if (existingSubmitted) return res.status(400).json({ message: 'Scores already submitted for this subject. Cannot modify.' })

    for (const item of scores) {
      let result = await Result.findOne({ student: item.studentId, session: sessionId, term: termId })

      if (result) {
        const existingDetail = await ResultDetail.findOne({ result: result._id, subject: subjectId })
        if (existingDetail?.submitted) continue
        await ResultDetail.findOneAndUpdate(
          { result: result._id, subject: subjectId },
          {
            $set: {
              ca1: item.ca1 || 0,
              ca2: item.ca2 || 0,
              exam: item.exam || 0,
              total: (item.ca1 || 0) + (item.ca2 || 0) + (item.exam || 0)
            }
          },
          { upsert: true, new: true }
        )
      } else {
        result = await Result.create({
          student: item.studentId, class: classId, session: sessionId, term: termId,
          examOfficer: req.user.id,
        })
        await ResultDetail.create({
          result: result._id,
          subject: subjectId,
          ca1: item.ca1 || 0,
          ca2: item.ca2 || 0,
          exam: item.exam || 0,
          total: (item.ca1 || 0) + (item.ca2 || 0) + (item.exam || 0)
        })
      }

      const allDetails = await ResultDetail.find({ result: result._id }).populate('subject')

      let totalScore = 0
      for (const d of allDetails) {
        totalScore += d.total
      }
      const average = allDetails.length ? Math.round((totalScore / allDetails.length) * 100) / 100 : 0

      await Result.findByIdAndUpdate(result._id, { totalScore, average, status: 'DRAFT' })
    }

    res.json({ message: 'Scores saved' })
    try { emitToRole('EXAM_OFFICER', 'scores:saved', { sessionId, termId, classId, subjectId }); emitToRole('FORM_TEACHER', 'scores:saved', { sessionId, termId, classId, subjectId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.submitScores = async (req, res) => {
  try {
    const { sessionId, termId, classId, subjectId } = req.body
    if (!sessionId || !termId || !classId || !subjectId) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const results = await Result.find({ class: classId, session: sessionId, term: termId })
      .populate({ path: 'details', match: { subject: subjectId } })

    if (!results.length) return res.status(400).json({ message: 'No scores to submit' })

    for (const r of results) {
      const detail = r.details.find(d => d.subject._id.toString() === subjectId)
      if (!detail) continue
      await ResultDetail.findByIdAndUpdate(detail._id, { submitted: true })
    }

    res.json({ message: 'Scores submitted successfully' })
    try { emitToRole('EXAM_OFFICER', 'scores:submitted', { sessionId, termId, classId, subjectId }); emitToRole('FORM_TEACHER', 'scores:submitted', { sessionId, termId, classId, subjectId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}