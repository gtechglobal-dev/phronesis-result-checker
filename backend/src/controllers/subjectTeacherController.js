const prisma = require('../utils/prisma')

exports.getAssignment = async (req, res) => {
  try {
    const assignments = await prisma.subjectAssignment.findMany({
      where: { userId: req.user.id },
      include: {
        subject: true,
        class: { include: { students: { orderBy: { lastName: 'asc' } } } }
      }
    })
    if (!assignments.length) return res.status(404).json({ message: 'No subject assignments found' })
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

    const results = await prisma.result.findMany({
      where: { classId, sessionId, termId },
      include: {
        student: true,
        details: { where: { subjectId } }
      }
    })

    const students = await prisma.student.findMany({
      where: { classId },
      orderBy: { lastName: 'asc' }
    })

    const scoreMap = {}
    for (const r of results) {
      if (r.details.length) {
        scoreMap[r.studentId] = { resultId: r.id, ...r.details[0] }
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

    const existingSubmitted = await prisma.result.findFirst({
      where: { classId, sessionId, termId, status: 'SUBMITTED' }
    })
    if (existingSubmitted) return res.status(400).json({ message: 'Scores already submitted. Cannot modify.' })

    for (const item of scores) {
      let result = await prisma.result.findFirst({
        where: { studentId: item.studentId, sessionId, termId }
      })

      if (result) {
        if (result.status === 'SUBMITTED') continue
        await prisma.resultDetail.upsert({
          where: { resultId_subjectId: { resultId: result.id, subjectId } },
          create: { resultId: result.id, subjectId, ca1: item.ca1 || 0, ca2: item.ca2 || 0, exam: item.exam || 0, total: (item.ca1 || 0) + (item.ca2 || 0) + (item.exam || 0) },
          update: { ca1: item.ca1 || 0, ca2: item.ca2 || 0, exam: item.exam || 0, total: (item.ca1 || 0) + (item.ca2 || 0) + (item.exam || 0) }
        })
      } else {
        result = await prisma.result.create({
          data: {
            studentId: item.studentId, classId, sessionId, termId,
            examOfficerId: req.user.id,
            details: {
              create: {
                subjectId,
                ca1: item.ca1 || 0,
                ca2: item.ca2 || 0,
                exam: item.exam || 0,
                total: (item.ca1 || 0) + (item.ca2 || 0) + (item.exam || 0)
              }
            }
          }
        })
      }

      const allDetails = await prisma.resultDetail.findMany({
        where: { resultId: result.id },
        include: { subject: true }
      })

      let totalScore = 0
      for (const d of allDetails) {
        totalScore += d.total
      }
      const average = allDetails.length ? Math.round((totalScore / allDetails.length) * 100) / 100 : 0

      await prisma.result.update({
        where: { id: result.id },
        data: { totalScore, average, status: 'DRAFT' }
      })
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

    const results = await prisma.result.findMany({
      where: { classId, sessionId, termId },
      include: { details: { where: { subjectId } } }
    })

    if (!results.length) return res.status(400).json({ message: 'No scores to submit' })

    for (const r of results) {
      const hasSubject = r.details.some(d => d.subjectId === subjectId)
      if (!hasSubject) continue
      await prisma.result.update({
        where: { id: r.id },
        data: { status: 'SUBMITTED' }
      })
    }

    res.json({ message: 'Scores submitted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
