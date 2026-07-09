const { Student, Class, Result, AcademicSession, Term } = require('../models')
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

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id)
    if (!student) return res.status(404).json({ message: 'Student not found' })
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
