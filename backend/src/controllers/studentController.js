const { Student, Class, Result, AcademicSession, Term } = require('../models')

exports.getStudents = async (req, res) => {
  try {
    const { classId, className, arm, search } = req.query
    const where = {}
    if (classId) where.class = classId
    if (className) {
      const classRecord = await Class.findOne({ name: className })
      if (classRecord) where.class = classRecord._id
    }
    if (arm) where.arm = arm
    if (search) {
      where.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { regNo: { $regex: search, $options: 'i' } }
      ]
    }

    const students = await Student.find(where)
      .populate('class')
      .populate('parent', 'firstName lastName email')
      .sort({ lastName: 1, firstName: 1 })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getUnlinkedStudents = async (req, res) => {
  try {
    const { classId, search } = req.query
    const where = { parent: { $exists: false } }
    if (classId) where.class = classId
    if (search) {
      where.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { regNo: { $regex: search, $options: 'i' } }
      ]
    }
    const students = await Student.find(where)
      .populate('class')
      .sort({ lastName: 1, firstName: 1 })
      .limit(50)
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
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
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createStudent = async (req, res) => {
  try {
    const { regNo, firstName, lastName, classId, arm } = req.body
    const existing = await Student.findOne({ regNo })
    if (existing) return res.status(400).json({ message: 'Registration number already exists' })

    const student = await Student.create({ regNo, firstName, lastName, class: classId, arm })
    await student.populate('class')
    res.status(201).json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.bulkCreateStudents = async (req, res) => {
  try {
    const { students } = req.body
    if (!students || students.length === 0) return res.status(400).json({ message: 'No students provided' })

    let created = 0
    for (const s of students) {
      const existing = await Student.findOne({ regNo: s.regNo })
      if (!existing) {
        await Student.create({ regNo: s.regNo, firstName: s.firstName, lastName: s.lastName, class: s.classId, arm: s.arm || 'A' })
        created++
      }
    }
    res.status(201).json({ message: `${created} students created` })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.updateStudent = async (req, res) => {
  try {
    const { firstName, lastName, classId, arm } = req.body
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, class: classId, arm },
      { new: true }
    ).populate('class')
    res.json(student)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMyChildren = async (req, res) => {
  try {
    const students = await Student.find({ parent: req.user.id })
      .populate('class')
      .populate({
        path: 'results',
        populate: { path: 'session term' },
        options: { sort: { createdAt: -1 } }
      })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getStudentsByClass = async (req, res) => {
  try {
    const classTeacher = await require('../models/ClassTeacher').findOne({
      user: req.user.id, class: req.params.classId
    })
    if (!classTeacher && req.user.role !== 'EXAM_OFFICER') {
      return res.status(403).json({ message: 'Not assigned to this class' })
    }
    const students = await Student.find({ class: req.params.classId })
      .populate('class')
      .sort({ lastName: 1, firstName: 1 })
    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.generateExamNumbers = async (req, res) => {
  try {
    const { classId, count } = req.body
    if (!classId || !count) return res.status(400).json({ message: 'classId and count required' })

    const lastStudent = await Student.findOne({ regNo: { $regex: '^PHS' } })
      .sort({ regNo: -1 })

    let nextNum = 1
    if (lastStudent) {
      const match = lastStudent.regNo.match(/PHS(\d{5})/)
      if (match) nextNum = parseInt(match[1]) + 1
    }

    const numbers = []
    for (let i = 0; i < count; i++) {
      numbers.push(`PHS${String(nextNum + i).padStart(5, '0')}`)
    }

    res.json({ numbers })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}