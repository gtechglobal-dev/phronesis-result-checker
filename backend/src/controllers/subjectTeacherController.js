const { SubjectAssignment, Result, ResultDetail, Student, Subject, Class } = require('../models')

exports.getAssignment = async (req, res) => {
  try {
    const assignments = await SubjectAssignment.find({ user: req.user.id })
      .populate('subject')
      .populate({ path: 'class', populate: { path: 'students', options: { sort: { lastName: 1 } } } })
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
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

    res.json({ students, scores: scoreMap, submitted: results.some(r => r.status === 'SUBMITTED') })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.saveScores = async (req, res) => {
  try {
    const { sessionId, termId, classId, subjectId, scores } = req.body
    if (!sessionId || !termId || !classId || !subjectId || !scores) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const existingSubmitted = await Result.findOne({ class: classId, session: sessionId, term: termId, status: 'SUBMITTED' })
    if (existingSubmitted) return res.status(400).json({ message: 'Scores already submitted. Cannot modify.' })

    for (const item of scores) {
      let result = await Result.findOne({ student: item.studentId, session: sessionId, term: termId })

      if (result) {
        if (result.status === 'SUBMITTED') continue
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
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
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
      const hasSubject = r.details.some(d => d.subject._id.toString() === subjectId)
      if (!hasSubject) continue
      await Result.findByIdAndUpdate(r._id, { status: 'SUBMITTED' })
    }

    res.json({ message: 'Scores submitted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}