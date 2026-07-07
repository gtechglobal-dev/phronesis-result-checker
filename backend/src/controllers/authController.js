const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { User, Student, ClassTeacher } = require('../models')

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'Admin').split(',').map(s => s.trim())
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Phronesis2026'
const STAFF_USERNAME = process.env.STAFF_USERNAME || 'Staff'
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'Staff2026'

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

exports.register = async (req, res) => {
  try {
    const { email, phone, password, firstName, lastName, studentIds } = req.body
    const identifier = email || phone
    if (!identifier) return res.status(400).json({ message: 'Email or phone is required' })

    const existing = await User.findOne({
      $or: [{ email: email || '' }, { phone: phone || '' }]
    })
    if (existing) return res.status(400).json({ message: 'Email or phone already registered' })

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
      email: email || null,
      phone: phone || null,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'PARENT'
    })

    if (studentIds && studentIds.length > 0) {
      await Student.updateMany(
        { _id: { $in: studentIds } },
        { parent: user._id }
      )
    }

    const token = generateToken(user)

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user._id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (ADMIN_USERNAMES.includes(email) && password === ADMIN_PASSWORD) {
      let admin = await User.findOne({ role: 'EXAM_OFFICER' })
      if (!admin) {
        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12)
        admin = await User.create({
          email: 'admin@phronesis.com', password: hashed, firstName: 'Exam', lastName: 'Officer', role: 'EXAM_OFFICER'
        })
      }
      const token = generateToken(admin)
      return res.json({
        message: 'Login successful',
        token,
        user: { id: admin._id, email: admin.email, role: admin.role, firstName: admin.firstName, lastName: admin.lastName }
      })
    }

    if (email === STAFF_USERNAME && password === STAFF_PASSWORD) {
      let staff = await User.findOne({ role: 'FORM_TEACHER' })
      if (!staff) {
        const hashed = await bcrypt.hash(STAFF_PASSWORD, 12)
        staff = await User.create({
          email: 'staff@phronesis.com', password: hashed, firstName: 'Subject', lastName: 'Teacher', role: 'FORM_TEACHER'
        })
      }
      const token = generateToken(staff)
      return res.json({
        message: 'Login successful',
        token,
        user: { id: staff._id, email: staff.email, role: staff.role, firstName: staff.firstName, lastName: staff.lastName }
      })
    }

    const user = await User.findOne({
      $or: [{ email: email || '' }, { phone: email || '' }]
    })
    if (!user) return res.status(400).json({ message: 'Invalid credentials' })

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' })

    if (user.role === 'EXAM_OFFICER') {
      return res.status(400).json({ message: 'Use Admin login' })
    }

    const token = generateToken(user)
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createTeacher = async (req, res) => {
  try {
    const { firstName, lastName, email, password, classId } = req.body
    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'Username already in use' })

    if (classId) {
      const existingAssignment = await ClassTeacher.findOne({ class: classId })
      if (existingAssignment) return res.status(400).json({ message: 'This class already has a form teacher' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const teacher = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'FORM_TEACHER'
    })

    if (classId) {
      await ClassTeacher.create({
        user: teacher._id, class: classId
      })
    }

    res.status(201).json({
      message: 'Teacher created',
      teacher: { id: teacher._id, email: teacher.email, firstName: teacher.firstName, lastName: teacher.lastName, role: teacher.role }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.cancelAssignment = async (req, res) => {
  try {
    const { id } = req.params
    const assignment = await ClassTeacher.findOne({ user: id })
    if (!assignment) return res.status(404).json({ message: 'No assignment found for this teacher' })
    await ClassTeacher.findByIdAndDelete(assignment._id)
    res.json({ message: 'Assignment cancelled' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.changePassword = async (req, res) => {
  try {
    const { id } = req.params
    const { password } = req.body
    const hashedPassword = await bcrypt.hash(password, 12)
    await User.findByIdAndUpdate(id, { password: hashedPassword })
    res.json({ message: 'Password changed' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('email phone role firstName lastName createdAt')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'FORM_TEACHER' })
      .select('email firstName lastName role')
      .populate({ path: 'classAssignments', populate: { path: 'class' } })
      .sort({ firstName: 1 })
    res.json(teachers)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}