const mongoose = require('mongoose')
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

    const students = await Student.find({ class: classId, session: sessionId }).sort({ lastName: 1 })

    const scoreMap = {}
    for (const r of results) {
      if (!r.student) continue
      if (r.details.length) {
        scoreMap[r.student._id.toString()] = { resultId: r._id, ...r.details[0].toObject() }
      }
    }

    const submitted = results.some(r => r.details.some(d => d.submitted))
    const sampleKey = Object.keys(scoreMap)[0]
    console.log('getScores:', { students: students.length, scoresInMap: Object.keys(scoreMap).length, submitted, sample: sampleKey ? scoreMap[sampleKey] : 'none' })

    res.json({ students, scores: scoreMap, submitted })
  } catch (error) {
    console.error('getScores error:', error.message)
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

    const updatedResultIds = []
    for (const item of scores) {
      const result = await Result.findOneAndUpdate(
        { student: item.studentId, session: sessionId, term: termId },
        { $setOnInsert: { student: item.studentId, class: classId, session: sessionId, term: termId, examOfficer: req.user.id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

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
      updatedResultIds.push(result._id)
    }

    if (updatedResultIds.length) {
      const allDetails = await ResultDetail.find({ result: { $in: updatedResultIds } }).populate('subject')
      const totals = {}
      for (const d of allDetails) {
        const rid = d.result._id.toString()
        if (!totals[rid]) totals[rid] = { totalScore: 0, count: 0 }
        totals[rid].totalScore += d.total
        totals[rid].count++
      }
      await Promise.all(Object.entries(totals).map(([rid, t]) => {
        const average = t.count ? Math.round((t.totalScore / t.count) * 100) / 100 : 0
        return Result.findByIdAndUpdate(rid, { totalScore: t.totalScore, average, status: 'DRAFT' })
      }))
    }

    res.json({ message: 'Scores saved' })
    try { emitToRole('EXAM_OFFICER', 'scores:saved', { sessionId, termId, classId, subjectId }); emitToRole('FORM_TEACHER', 'scores:saved', { sessionId, termId, classId, subjectId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    console.error('saveScores error:', error.message)
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.submitScores = async (req, res) => {
  try {
    const { sessionId, termId, classId, subjectId } = req.body
    if (!sessionId || !termId || !classId || !subjectId) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const students = await Student.find({ class: classId, session: sessionId }).select('_id')
    const results = await Result.find({ class: classId, session: sessionId, term: termId }).select('_id student')

    const resultIds = results.map(r => r._id)

    const existingDetails = await ResultDetail.find({ result: { $in: resultIds }, subject: subjectId })
    const detailByResult = new Map()
    for (const d of existingDetails) {
      detailByResult.set(d.result.toString(), d)
    }

    const sidToResult = new Map()
    for (const r of results) {
      if (!r.student) continue
      sidToResult.set(r.student.toString(), r)
    }

    const resultBulks = []
    const detailBulks = []

    for (const student of students) {
      const sid = student._id.toString()
      const result = sidToResult.get(sid)
      if (!result) {
        const tempId = new mongoose.Types.ObjectId()
        resultBulks.push({
          insertOne: {
            document: {
              _id: tempId, student: sid, class: classId, session: sessionId, term: termId,
              examOfficer: req.user.id,
            }
          }
        })
        detailBulks.push({
          insertOne: {
            document: {
              result: tempId, subject: subjectId,
              ca1: 0, ca2: 0, exam: 0, total: 0, submitted: true
            }
          }
        })
      } else {
        const detail = detailByResult.get(result._id.toString())
        if (detail) {
          detailBulks.push({
            updateOne: {
              filter: { _id: detail._id },
              update: { $set: { submitted: true } }
            }
          })
        } else {
          detailBulks.push({
            insertOne: {
              document: {
                result: result._id, subject: subjectId,
                ca1: 0, ca2: 0, exam: 0, total: 0, submitted: true
              }
            }
          })
        }
      }
    }

    if (resultBulks.length) await Result.bulkWrite(resultBulks)
    if (detailBulks.length) await ResultDetail.bulkWrite(detailBulks)

    res.json({ message: 'Scores submitted successfully' })
    try { emitToRole('EXAM_OFFICER', 'scores:submitted', { sessionId, termId, classId, subjectId }); emitToRole('FORM_TEACHER', 'scores:submitted', { sessionId, termId, classId, subjectId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    console.error('submitScores error:', error.message)
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}