require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const connectDB = require('./utils/db')
const { apiLimiter, loginLimiter, pinCheckLimiter } = require('./middlewares/rateLimiter')

const authRoutes = require('./routes/auth')
const classRoutes = require('./routes/classes')
const studentRoutes = require('./routes/students')
const resultRoutes = require('./routes/results')
const pinRoutes = require('./routes/pins')
const subjectAssignmentRoutes = require('./routes/subjectAssignments')
const subjectTeacherRoutes = require('./routes/subjectTeacher')
const formTeacherRoutes = require('./routes/formTeacher')
const { setupSocket } = require('./utils/socket')

const app = express()

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim())

app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(null, false)
  },
  credentials: true,
}))
app.use(express.json({ limit: '10kb' }))
app.use(mongoSanitize())

app.use('/api/', apiLimiter)
app.use('/api/auth/login', loginLimiter)
app.use('/api/results/check', pinCheckLimiter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Phronesis Int\'l School Result Checker API' })
})

app.use('/api/auth', authRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/results', resultRoutes)
app.use('/api/pins', pinRoutes)
app.use('/api/subject-assignments', subjectAssignmentRoutes)
app.use('/api/subject-teacher', subjectTeacherRoutes)
app.use('/api/form-teacher', formTeacherRoutes)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Something went wrong!' })
})

const PORT = process.env.PORT || 5000

const http = require('http')
const server = http.createServer(app)

connectDB().then(() => {
  setupSocket(server)
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
})
