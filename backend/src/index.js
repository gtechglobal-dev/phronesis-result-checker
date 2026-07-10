require('dotenv').config()
const express = require('express')
const path = require('path')
const cors = require('cors')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const connectDB = require('./utils/db')
const { apiLimiter, loginLimiter, registerLimiter, pinCheckLimiter } = require('./middlewares/rateLimiter')

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

app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true)
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true)
    if (/^https?:\/\/.+\.onrender\.com$/.test(origin)) return callback(null, true)
    console.warn(`CORS: allowing unknown origin ${origin}`)
    callback(null, true)
  },
  credentials: true,
}))
app.use(express.json({ limit: '10kb' }))
app.use(mongoSanitize())

app.get('/wakeup', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/', apiLimiter)
app.use('/api/auth/login', loginLimiter)
app.use('/api/auth/register', registerLimiter)
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

const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist')
app.use(express.static(frontendPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'))
})

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
