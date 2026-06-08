const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName, phone, role }
    })

    const token = generateToken(user)

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const token = generateToken(user)

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, createdAt: true }
    })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
