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

    const resultBulkOps = scores.map(item => ({
      updateOne: {
        filter: { student: item.studentId, session: sessionId, term: termId },
        update: { $setOnInsert: { student: item.studentId, class: classId, session: sessionId, term: termId, examOfficer: req.user.id } },
        upsert: true
      }
    }))
    const resultBulk = await Result.bulkWrite(resultBulkOps, { ordered: false })

    const upsertedIds = Object.values(resultBulk.upsertedIds || {})
    const allStudentIds = scores.map(s => s.studentId)
    const existingResults = await Result.find({ student: { $in: allStudentIds }, session: sessionId, term: termId }).select('_id student')
    const studentToResult = {}
    for (const r of existingResults) studentToResult[r.student.toString()] = r._id

    const studentScoreMap = {}
    for (const item of scores) studentScoreMap[item.studentId] = item

    const existingDetails = await ResultDetail.find({ result: { $in: existingResults.map(r => r._id) }, subject: subjectId }).select('_id result submitted')
    const submittedDetailResults = new Set()
    for (const d of existingDetails) {
      if (d.submitted) submittedDetailResults.add(d.result.toString())
    }

    const detailBulkOps = []
    const updatedResultIds = []
    for (const item of scores) {
      const rid = studentToResult[item.studentId]
      if (!rid) continue
      if (submittedDetailResults.has(rid.toString())) continue
      const ca1 = item.ca1 || 0, ca2 = item.ca2 || 0, exam = item.exam || 0
      detailBulkOps.push({
        updateOne: {
          filter: { result: rid, subject: subjectId },
          update: { $set: { ca1, ca2, exam, total: ca1 + ca2 + exam } },
          upsert: true
        }
      })
      updatedResultIds.push(rid)
    }

    if (detailBulkOps.length) {
      await ResultDetail.bulkWrite(detailBulkOps, { ordered: false })

      const agg = await ResultDetail.aggregate([
        { $match: { result: { $in: updatedResultIds } } },
        { $group: { _id: '$result', totalScore: { $sum: '$total' }, count: { $sum: 1 } } }
      ])
      const totalsMap = {}
      for (const a of agg) totalsMap[a._id.toString()] = a

      const resultUpdateOps = updatedResultIds.map(rid => {
        const t = totalsMap[rid.toString()] || { totalScore: 0, count: 0 }
        const average = t.count ? Math.round((t.totalScore / t.count) * 100) / 100 : 0
        return { updateOne: { filter: { _id: rid }, update: { $set: { totalScore: t.totalScore, average, status: 'DRAFT' } } } }
      })
      await Result.bulkWrite(resultUpdateOps)
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