const { Student, Class, Result, ResultDetail, Subject, AcademicSession, Term, SubjectAssignment, ClassTeacher } = require('../models')
const { isString, escapeRegex, isValidObjectId, sanitizeString } = require('../utils/sanitize')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

exports.getStudents = async (req, res) => {
  try {
    const { classId, className, arm, search, sessionId } = req.query
    const where = {}
    if (classId && isValidObjectId(classId)) where.class = classId
    if (sessionId && isValidObjectId(sessionId)) where.session = sessionId
    if (className && isString(className)) {
      const classRecord = await Class.findOne({ name: className })
      if (classRecord) where.class = classRecord._id
    }
    if (arm && isString(arm)) where.arm = arm
    if (search && isString(search) && search.length < 100) {
      const safe = escapeRegex(search)
      where.$or = [
        { firstName: { $regex: safe, $options: 'i' } },
        { lastName: { $regex: safe, $options: 'i' } },
        { regNo: { $regex: safe, $options: 'i' } }
      ]
    }

    const students = await Student.find(where)
      .populate('class')
      .populate('session')
      .populate('parent', 'firstName lastName email')
      .sort({ lastName: 1, firstName: 1 })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getUnlinkedStudents = async (req, res) => {
  try {
    const { classId, search, sessionId } = req.query
    const where = { parent: { $exists: false } }
    if (classId && isValidObjectId(classId)) where.class = classId
    if (sessionId && isValidObjectId(sessionId)) where.session = sessionId
    if (search && isString(search) && search.length < 100) {
      const safe = escapeRegex(search)
      where.$or = [
        { firstName: { $regex: safe, $options: 'i' } },
        { lastName: { $regex: safe, $options: 'i' } },
        { regNo: { $regex: safe, $options: 'i' } }
      ]
    }
    const students = await Student.find(where)
      .populate('class')
      .sort({ lastName: 1, firstName: 1 })
      .limit(50)
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({ path: 'class', populate: { path: 'subjects' } })
      .populate('parent', 'firstName lastName email')
    if (!student) return res.status(404).json({ message: 'Student not found' })
    res.json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.createStudent = async (req, res) => {
  try {
    const { regNo, firstName, lastName, classId, arm, sessionId } = req.body
    if (!isString(regNo) || !isString(firstName) || !isString(lastName) || !isValidObjectId(classId) || !isValidObjectId(sessionId)) {
      return res.status(400).json({ message: 'Invalid input' })
    }
    const normalizedRegNo = regNo.trim().toUpperCase()
    const existing = await Student.findOne({ regNo: normalizedRegNo, session: sessionId })
    if (existing) return res.status(400).json({ message: 'Registration number already exists in this session' })

    const gender = req.body.gender === 'M' || req.body.gender === 'F' ? req.body.gender : undefined
    const student = await Student.create({ regNo: normalizedRegNo, firstName: sanitizeString(firstName.trim()).toUpperCase(), lastName: sanitizeString(lastName.trim()).toUpperCase(), class: classId, session: sessionId, arm: arm || 'A', gender })
    await student.populate('class')
    await student.populate('session')
    res.status(201).json(student)
    try { emitBroadcast('entity:updated', { type: 'student' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

const generateUniqueRegNo = async () => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
    const regNo = `PHS/${num}`
    const exists = await Student.findOne({ regNo })
    if (!exists) return regNo
  }
  return null
}

exports.bulkCreateStudents = async (req, res) => {
  try {
    const { students, sessionId } = req.body
    if (!students || students.length === 0) return res.status(400).json({ message: 'No students provided' })
    if (!isValidObjectId(sessionId)) return res.status(400).json({ message: 'sessionId required' })

    let created = 0
    for (const s of students) {
      if (!s.firstName || !s.lastName || !s.classId) {
        return res.status(400).json({ message: `Missing required field for student "${s.firstName || ''} ${s.lastName || ''}"` })
      }
      const regNo = await generateUniqueRegNo()
      if (!regNo) return res.status(500).json({ message: 'Could not generate unique exam number after 50 attempts' })
      const gender = s.gender === 'M' || s.gender === 'F' ? s.gender : undefined
      await Student.create({ regNo, firstName: s.firstName.toUpperCase(), lastName: s.lastName.toUpperCase(), class: s.classId, session: sessionId, gender })
      created++
    }
    res.status(201).json({ message: `${created} students created` })
    try { emitBroadcast('entity:updated', { type: 'student' }) } catch (e) {}
  } catch (error) {
    console.error('bulkCreateStudents error:', error)
    res.status(500).json({ message: `Bulk create failed: ${error.message}` })
  }
}

exports.updateStudent = async (req, res) => {
  try {
    const { firstName, lastName, classId, arm, sessionId } = req.body
    const gender = req.body.gender === 'M' || req.body.gender === 'F' ? req.body.gender : undefined
    const update = {}
    if (firstName) update.firstName = firstName?.toUpperCase()
    if (lastName) update.lastName = lastName?.toUpperCase()
    if (classId) update.class = classId
    if (arm) update.arm = arm
    if (sessionId) update.session = sessionId
    if (gender) update.gender = gender
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('class')
    if (!student) return res.status(404).json({ message: 'Student not found' })
    res.json(student)
    try { emitBroadcast('entity:updated', { type: 'student' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getMyChildren = async (req, res) => {
  try {
    const students = await Student.find({ parent: req.user.id })
      .populate('class')
      .populate('session')
      .populate({
        path: 'results',
        populate: { path: 'session term' },
        options: { sort: { createdAt: -1 } }
      })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getStudentsByClass = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.classId)) {
      return res.status(400).json({ message: 'Invalid class ID' })
    }
    if (req.user.role !== 'EXAM_OFFICER') {
      const classTeacher = await require('../models/ClassTeacher').findOne({
        user: req.user.id, class: req.params.classId
      })
      if (!classTeacher) {
        const subjectAssignment = await require('../models/SubjectAssignment').findOne({
          user: req.user.id, class: req.params.classId
        })
        if (!subjectAssignment) return res.status(403).json({ message: 'Not assigned to this class' })
      }
    }
    const { sessionId } = req.query
    const where = { class: req.params.classId }
    if (sessionId && isValidObjectId(sessionId)) where.session = sessionId
    const students = await Student.find(where)
      .populate('class')
      .populate('session')
      .sort({ lastName: 1, firstName: 1 })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getClassStudentList = async (req, res) => {
  try {
    const { classId } = req.query
    if (!classId || !isValidObjectId(classId)) {
      return res.status(400).json({ message: 'classId required' })
    }

    const currentSession = await AcademicSession.findOne({ isCurrent: true })
    if (!currentSession) return res.json({ students: [], subjects: [], currentSession: null })

    const currentTerm = await Term.findOne({ session: currentSession._id, isCurrent: true })

    const classRecord = await Class.findById(classId)
    if (!classRecord) return res.status(404).json({ message: 'Class not found' })

    const subjects = await Subject.find({ class: classId, session: currentSession._id }).sort({ name: 1 })

    const allStudents = await Student.find({ class: classId })
      .populate('class')
      .populate('session')
      .sort({ lastName: 1, firstName: 1 })

    const studentRegNos = [...new Set(allStudents.map(s => s.regNo))]

    const currentSessionStudents = await Student.find({
      regNo: { $in: studentRegNos },
      session: currentSession._id
    }).select('regNo class')

    const currentClassMap = {}
    for (const s of currentSessionStudents) {
      currentClassMap[s.regNo] = s.class.toString()
    }

    const previousSessionStudents = await Student.find({
      regNo: { $in: studentRegNos },
      session: { $ne: currentSession._id }
    }).select('regNo class session createdAt')
      .populate('session', 'name')
      .populate('class', 'name')

    const firstSeenMap = {}
    for (const s of previousSessionStudents) {
      const rn = s.regNo
      if (!firstSeenMap[rn] || s.createdAt < firstSeenMap[rn].createdAt) {
        firstSeenMap[rn] = s
      }
    }

    const transferredClassIds = currentSessionStudents
      .filter(s => currentClassMap[s.regNo] !== classId)
      .map(s => s.class.toString())

    const otherClassNames = {}
    if (transferredClassIds.length > 0) {
      const otherClasses = await Class.find({ _id: { $in: transferredClassIds } })
      for (const c of otherClasses) otherClassNames[c._id.toString()] = c.name
    }

    const currentStudentRecords = await Student.find({
      regNo: { $in: studentRegNos },
      session: currentSession._id
    }).select('regNo _id')

    const currentStudentIds = currentStudentRecords.map(s => s._id)

    let results = []
    let resultDetails = []
    if (currentTerm && currentStudentIds.length > 0) {
      results = await Result.find({
        student: { $in: currentStudentIds },
        session: currentSession._id,
        term: currentTerm._id
      }).select('_id student status updatedAt')

      if (results.length > 0) {
        resultDetails = await ResultDetail.find({
          result: { $in: results.map(r => r._id) }
        }).select('result subject submitted')
      }
    }

    const resultByStudent = {}
    for (const r of results) {
      resultByStudent[r.student.toString()] = r
    }

    const detailsByResult = {}
    for (const d of resultDetails) {
      const rid = d.result.toString()
      if (!detailsByResult[rid]) detailsByResult[rid] = []
      detailsByResult[rid].push(d)
    }

    const studentList = allStudents.reduce((acc, s) => {
      const rn = s.regNo
      if (acc.find(x => x.regNo === rn)) return acc

      const currentClassId = currentClassMap[rn]
      const isActive = currentClassId === classId
      const isTransferred = currentSessionStudents.some(x => x.regNo === rn) && currentClassId && currentClassId !== classId
      const isGraduated = !currentSessionStudents.some(x => x.regNo === rn)

      let status = 'ACTIVE'
      let transferInfo = null
      if (isTransferred) {
        status = 'TRANSFERRED'
        transferInfo = {
          toClass: otherClassNames[currentClassId] || 'Unknown',
          toClassId: currentClassId,
        }
      } else if (isGraduated) {
        status = 'GRADUATED'
      }

      const currentRecord = currentSessionStudents.find(x => x.regNo === rn)
      const result = currentRecord ? resultByStudent[currentRecord._id?.toString()] || resultByStudent[s._id?.toString()] : null

      let submissionInfo = null
      if (result) {
        const details = detailsByResult[result._id.toString()] || []
        const submittedCount = details.filter(d => d.submitted).length
        submissionInfo = {
          totalSubjects: subjects.length,
          submittedSubjects: submittedCount,
          resultStatus: result.status,
          submittedAt: result.updatedAt,
        }
      } else if (isActive && currentTerm) {
        submissionInfo = {
          totalSubjects: subjects.length,
          submittedSubjects: 0,
          resultStatus: 'NO_RESULT',
        }
      }

      acc.push({
        _id: s._id,
        regNo: s.regNo,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        arm: s.arm,
        parent: s.parent,
        createdAt: s.createdAt,
        status,
        transferInfo,
        enrollmentSession: s.session?.name || 'Unknown',
        submissionInfo,
      })
      return acc
    }, [])

    const formTeacher = await ClassTeacher.findOne({ class: classId }).populate('user', 'firstName lastName email')

    const classHistory = await Student.aggregate([
      { $match: { class: classRecord._id } },
      {
        $group: {
          _id: '$session',
          count: { $addToSet: '$regNo' },
        }
      },
      {
        $lookup: {
          from: 'academicsessions',
          localField: '_id',
          foreignField: '_id',
          as: 'session'
        }
      },
      { $unwind: { path: '$session', preserveNullAndEmptyArrays: true } },
      { $project: { sessionName: '$session.name', count: { $size: '$count' } } },
      { $sort: { sessionName: -1 } }
    ])

    const activeStudentCount = studentList.filter(s => s.status === 'ACTIVE').length
    const transferredCount = studentList.filter(s => s.status === 'TRANSFERRED').length
    const graduatedCount = studentList.filter(s => s.status === 'GRADUATED').length

    res.json({
      className: classRecord.name,
      currentSession: { _id: currentSession._id, name: currentSession.name },
      currentTerm: currentTerm ? { _id: currentTerm._id, name: currentTerm.name } : null,
      subjects: subjects.map(s => ({ _id: s._id, name: s.name })),
      students: studentList,
      formTeacher: formTeacher ? { name: `${formTeacher.user.firstName} ${formTeacher.user.lastName}`, email: formTeacher.user.email } : null,
      classHistory,
      stats: {
        activeCount: activeStudentCount,
        transferredCount,
        graduatedCount,
        totalSubjects: subjects.length,
        totalStudents: studentList.length,
      },
    })
  } catch (error) {
    console.error('getClassStudentList error:', error.message)
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.getGraduatedStudents = async (req, res) => {
  try {
    const currentSession = await AcademicSession.findOne({ isCurrent: true })
    if (!currentSession) return res.json({ students: [] })

    const currentRegNos = await Student.distinct('regNo', { session: currentSession._id })
    const allRegNos = await Student.distinct('regNo')
    const graduatedRegNos = allRegNos.filter(r => !currentRegNos.includes(r))

    if (graduatedRegNos.length === 0) return res.json({ students: [] })

    const pipeline = [
      { $match: { regNo: { $in: graduatedRegNos } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$regNo', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      {
        $lookup: {
          from: 'classes',
          localField: 'class',
          foreignField: '_id',
          as: 'class'
        }
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'academicsessions',
          localField: 'session',
          foreignField: '_id',
          as: 'session'
        }
      },
      { $unwind: { path: '$session', preserveNullAndEmptyArrays: true } },
    ]

    const graduated = await Student.aggregate(pipeline)

    const studentIds = graduated.map(s => s._id)
    const results = await Result.find({ student: { $in: studentIds } })
      .populate('term', 'name')
      .sort({ createdAt: -1 })

    const lastResultMap = {}
    for (const r of results) {
      const sid = r.student.toString()
      if (!lastResultMap[sid]) lastResultMap[sid] = r
    }

    const resultIds = [...new Set(results.map(r => r._id))]
    const details = await ResultDetail.find({ result: { $in: resultIds } })
      .populate('subject', 'name')
      .sort({ createdAt: -1 })

    const detailsByResult = {}
    for (const d of details) {
      const rid = d.result.toString()
      if (!detailsByResult[rid]) detailsByResult[rid] = []
      detailsByResult[rid].push(d)
    }

    const studentList = graduated.map(s => {
      const lastResult = lastResultMap[s._id.toString()]
      const lastDetails = lastResult ? detailsByResult[lastResult._id.toString()] || [] : []

      return {
        _id: s._id,
        regNo: s.regNo,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        arm: s.arm,
        lastClass: s.class?.name || 'Unknown',
        lastSession: s.session?.name || 'Unknown',
        graduatedAt: s.createdAt,
        lastGrades: lastDetails.map(d => ({
          subject: d.subject?.name || 'Unknown',
          ca: d.ca,
          exam: d.exam,
          total: d.total,
          grade: d.grade,
        })),
        lastResult: lastResult ? {
          term: lastResult.term?.name || 'Unknown',
          status: lastResult.status,
          totalObtained: lastDetails.reduce((sum, d) => sum + (d.total || 0), 0),
          totalSubjects: lastDetails.length,
        } : null,
      }
    })

    res.json({ students: studentList, total: studentList.length })
  } catch (error) {
    console.error('getGraduatedStudents error:', error.message)
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id)
    if (!student) return res.status(404).json({ message: 'Student not found' })
    const results = await Result.find({ student: req.params.id }).select('_id')
    const resultIds = results.map(r => r._id)
    if (resultIds.length > 0) {
      await ResultDetail.deleteMany({ result: { $in: resultIds } })
      await Result.deleteMany({ student: req.params.id })
    }
    res.json({ message: 'Student deleted' })
    try { emitBroadcast('entity:updated', { type: 'student' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.generateExamNumbers = async (req, res) => {
  try {
    const { classId, count } = req.body
    if (!classId || !count) return res.status(400).json({ message: 'classId and count required' })

    const numbers = []
    for (let i = 0; i < count; i++) {
      const regNo = await generateUniqueRegNo()
      if (!regNo) return res.status(500).json({ message: 'Could not generate unique exam number after 50 attempts' })
      numbers.push(regNo)
    }

    res.json({ numbers })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.carryForwardStudents = async (req, res) => {
  try {
    const { fromSessionId, toSessionId, classMappings } = req.body
    if (!fromSessionId || !toSessionId || !classMappings || !Array.isArray(classMappings)) {
      return res.status(400).json({ message: 'fromSessionId, toSessionId, and classMappings array required' })
    }

    let carried = 0
    let skipped = 0

    for (const mapping of classMappings) {
      const { fromClassId, toClassId, studentIds } = mapping
      if (!fromClassId || !toClassId) continue

      const query = { class: fromClassId, session: fromSessionId }
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        query._id = { $in: studentIds }
      }

      const students = await Student.find(query)

      for (const student of students) {
        const exists = await Student.findOne({ regNo: student.regNo, session: toSessionId })
        if (exists) {
          skipped++
          continue
        }
        try {
          await Student.create({
            regNo: student.regNo,
            firstName: student.firstName,
            lastName: student.lastName,
            arm: student.arm,
            gender: student.gender,
            pin: student.pin,
            class: toClassId,
            session: toSessionId,
            parent: student.parent,
          })
          carried++
        } catch (e) {
          if (e.code === 11000) {
            skipped++
          } else {
            throw e
          }
        }
      }
    }

    res.json({ message: `${carried} students carried forward, ${skipped} skipped (already exist)` })
    try { emitBroadcast('entity:updated', { type: 'student' }) } catch (e) {}
  } catch (error) {
    console.error('carryForwardStudents error:', error)
    const msg = error.name === 'ValidationError' ? error.message
      : error.code === 11000 ? 'Duplicate entry: a student with this exam number already exists in the target session'
      : error.name === 'CastError' ? `Invalid ID format: ${error.stringValue || error.message}`
      : 'Server error'
    res.status(500).json({ message: msg })
  }
}
