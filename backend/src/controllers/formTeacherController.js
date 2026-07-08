const { ClassTeacher, Student, Result, ResultDetail, Class, Term, Subject } = require('../models')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

const calculateGrade = (score) => {
  if (score >= 80) return { grade: 'A', remark: 'Excellent' }
  if (score >= 70) return { grade: 'B', remark: 'Very Good' }
  if (score >= 60) return { grade: 'C', remark: 'Good' }
  if (score >= 50) return { grade: 'D', remark: 'Fair' }
  if (score >= 40) return { grade: 'E', remark: 'Poor' }
  return { grade: 'F', remark: 'Fail' }
}

exports.getBroadsheet = async (req, res) => {
  try {
    const { sessionId, termId } = req.query
    if (!sessionId || !termId) return res.status(400).json({ message: 'sessionId and termId required' })

    const classTeacher = await ClassTeacher.findOne({ user: req.user.id }).populate('class')
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    const classRecord = classTeacher.class
    const classSubjects = await Subject.find({ class: classRecord._id }).sort({ createdAt: 1 })
    const students = await Student.find({ class: classRecord._id }).sort({ lastName: 1 })

    const results = await Result.find({ class: classRecord._id, session: sessionId, term: termId })
      .populate('student')
      .populate({ path: 'details', populate: { path: 'subject' } })

    const termData = await Term.findById(termId)

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
      return {
        student: { id: student._id, regNo: student.regNo, firstName: student.firstName, lastName: student.lastName, arm: student.arm, gender: student.gender },
        details,
        totalScore,
        average,
        subjectCount,
        resultId: result?._id || null,
        status: result?.status || null,
        teacherComment: result?.teacherComment || null,
        principalComment: result?.principalComment || null,
        daysPresent: result?.daysPresent ?? null,
        daysAbsent: result?.daysAbsent ?? null,
        savedPosition: result?.position ?? null
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

res.json({
      class: { id: classRecord._id, name: classRecord.name, level: classRecord.level },
      subjects: classSubjects,
      students: rows,
      daysOpen: termData?.daysOpen ?? null,
      nextResumptionDate: termData?.nextResumptionDate ?? null
    })
  } catch (error) {
    console.error('getBroadsheet error:', error.message, error.stack)
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updatePosition = async (req, res) => {
  try {
    const { resultId, position } = req.body
    if (!resultId || position == null) return res.status(400).json({ message: 'resultId and position required' })
    await Result.findByIdAndUpdate(resultId, { position: parseInt(position) })
    res.json({ message: 'Position updated' })
    try { emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    console.error('updatePosition error:', error.message)
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updateComment = async (req, res) => {
  try {
    const { resultId, teacherComment } = req.body
    await Result.findByIdAndUpdate(resultId, { teacherComment })
    res.json({ message: 'Comment saved' })
    try { emitToRole('EXAM_OFFICER', 'result:comment', { resultId }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updateSettings = async (req, res) => {
  try {
    const { termId, daysOpen, nextResumptionDate } = req.body
    if (!termId) return res.status(400).json({ message: 'termId required' })

    const classTeacher = await ClassTeacher.findOne({ user: req.user.id })
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    await Term.findByIdAndUpdate(termId, { daysOpen: daysOpen != null ? parseInt(daysOpen) : undefined, nextResumptionDate })
    res.json({ message: 'Settings saved' })
    try { emitBroadcast('entity:updated', { type: 'settings' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.updateAttendance = async (req, res) => {
  try {
    const { records } = req.body
    if (!Array.isArray(records)) return res.status(400).json({ message: 'records array required' })

    for (const rec of records) {
      if (rec.resultId) {
        await Result.findByIdAndUpdate(rec.resultId, {
          daysPresent: rec.daysPresent != null ? parseInt(rec.daysPresent) : undefined,
          daysAbsent: rec.daysAbsent != null ? parseInt(rec.daysAbsent) : undefined
        })
      }
    }
    res.json({ message: 'Attendance saved' })
    try { emitBroadcast('entity:updated', { type: 'attendance' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.deduplicateResults = async (req, res) => {
  try {
    const duplicates = await Result.aggregate([
      { $group: { _id: { student: '$student', session: '$session', term: '$term' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ])

    let removed = 0
    for (const group of duplicates) {
      const ids = group.ids
      const detailsCounts = await Promise.all(ids.map(id =>
        ResultDetail.countDocuments({ result: id }).then(c => ({ id: id.toString(), count: c }))
      ))
      detailsCounts.sort((a, b) => b.count - a.count)
      const keepId = detailsCounts[0].id
      const removeIds = ids.filter(id => id.toString() !== keepId)

      for (const removeId of removeIds) {
        const detailsToMove = await ResultDetail.find({ result: removeId })
        for (const detail of detailsToMove) {
          const exists = await ResultDetail.findOne({ result: keepId, subject: detail.subject })
          if (exists) {
            await ResultDetail.findByIdAndDelete(detail._id)
          } else {
            await ResultDetail.findByIdAndUpdate(detail._id, { result: keepId })
          }
        }
        await Result.findByIdAndDelete(removeId)
        removed++
      }
    }

    res.json({ message: `Cleaned up ${removed} duplicate result(s)` })
  } catch (error) {
    console.error('deduplicate error:', error.message)
    res.status(500).json({ message: 'Server error' })
  }
}

exports.reopenSubject = async (req, res) => {
  try {
    const { sessionId, termId, subjectId } = req.body
    if (!sessionId || !termId || !subjectId) return res.status(400).json({ message: 'Missing required fields' })

    const classTeacher = await ClassTeacher.findOne({ user: req.user.id }).populate('class')
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    const results = await Result.find({ class: classTeacher.class._id, session: sessionId, term: termId }).select('_id')
    const resultIds = results.map(r => r._id)

    await ResultDetail.updateMany(
      { result: { $in: resultIds }, subject: subjectId },
      { $set: { submitted: false } }
    )

    res.json({ message: 'Subject reopened for editing' })
    try { emitBroadcast('entity:updated', { type: 'subjectSubmission', sessionId, termId, classId: classTeacher.class._id, subjectId }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.submitBroadsheet = async (req, res) => {
  try {
    const { sessionId, termId } = req.body
    if (!sessionId || !termId) return res.status(400).json({ message: 'sessionId and termId required' })

    const classTeacher = await ClassTeacher.findOne({ user: req.user.id }).populate('class')
    if (!classTeacher) return res.status(403).json({ message: 'Not assigned as form teacher' })

    const results = await Result.find({ class: classTeacher.class._id, session: sessionId, term: termId })

    if (!results.length) return res.status(400).json({ message: 'No results to submit' })

    for (const r of results) {
      const allDetails = await ResultDetail.find({ result: r._id }).populate('subject')

      let totalScore = 0
      for (const d of allDetails) totalScore += d.total
      const average = allDetails.length > 0 ? Math.round((totalScore / allDetails.length) * 100) / 100 : 0

      await Result.findByIdAndUpdate(r._id, { totalScore, average, status: 'SUBMITTED', formTeacher: req.user.id })
    }

    const allResults = await Result.find({ class: classTeacher.class._id, session: sessionId, term: termId })
      .sort({ totalScore: -1 })

    for (let i = 0; i < allResults.length; i++) {
      if (allResults[i].position != null) continue
      const pos = i === 0 ? 1 : allResults[i].totalScore === allResults[i - 1].totalScore ? allResults[i - 1].position : i + 1
      await Result.findByIdAndUpdate(allResults[i]._id, { position: pos })
    }

    res.json({ message: 'Broadsheet submitted successfully' })
    try { emitToRole('EXAM_OFFICER', 'result:status', { class: classTeacher.class._id, sessionId, termId, status: 'SUBMITTED' }); emitBroadcast('entity:updated', { type: 'result' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}