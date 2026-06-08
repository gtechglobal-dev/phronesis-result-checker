const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')

const ADMIN_USERNAME = 'Admin'
const ADMIN_PASSWORD = 'Phronesis2026'

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

exports.register = async (req, res) => {
  try {
    const { email, phone, password, firstName, lastName, studentIds } = req.body
    const identifier = email || phone
    if (!identifier) return res.status(400).json({ message: 'Email or phone is required' })

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email || '' }, { phone: phone || '' }] }
    })
    if (existing) return res.status(400).json({ message: 'Email or phone already registered' })

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email: email || null,
        phone: phone || null,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'PARENT'
      }
    })

    if (studentIds && studentIds.length > 0) {
      await prisma.student.updateMany({
        where: { id: { in: studentIds } },
        data: { parentId: user.id }
      })
    }

    const token = generateToken(user)

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (email === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      let admin = await prisma.user.findFirst({ where: { role: 'EXAM_OFFICER' } })
      if (!admin) {
        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12)
        admin = await prisma.user.create({
          data: { email: 'admin@phronesis.com', password: hashed, firstName: 'Exam', lastName: 'Officer', role: 'EXAM_OFFICER' }
        })
      }
      const token = generateToken(admin)
      return res.json({
        message: 'Login successful',
        token,
        user: { id: admin.id, email: admin.email, role: admin.role, firstName: admin.firstName, lastName: admin.lastName }
      })
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: email || '' }, { phone: email || '' }] }
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
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.createTeacher = async (req, res) => {
  try {
    const { firstName, lastName, email, password, classIds } = req.body
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ message: 'Email already in use' })

    const hashedPassword = await bcrypt.hash(password, 12)

    const teacher = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'FORM_TEACHER'
      }
    })

    if (classIds && classIds.length > 0) {
      for (const classId of classIds) {
        await prisma.classTeacher.create({
          data: { userId: teacher.id, classId }
        }).catch(() => {})
      }
    }

    res.status(201).json({
      message: 'Teacher created',
      teacher: { id: teacher.id, email: teacher.email, firstName: teacher.firstName, lastName: teacher.lastName, role: teacher.role }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, phone: true, role: true, firstName: true, lastName: true, createdAt: true }
    })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
