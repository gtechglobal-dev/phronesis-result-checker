require('dotenv').config()
const express = require('express')
const cors = require('cors')
const connectDB = require('./utils/db')

const authRoutes = require('./routes/auth')
const classRoutes = require('./routes/classes')
const studentRoutes = require('./routes/students')
const resultRoutes = require('./routes/results')
const pinRoutes = require('./routes/pins')
const subjectAssignmentRoutes = require('./routes/subjectAssignments')
const subjectTeacherRoutes = require('./routes/subjectTeacher')
const formTeacherRoutes = require('./routes/formTeacher')

const app = express()

app.use(cors())
app.use(express.json())

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

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
})
