require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const classRoutes = require('./routes/classes')
const studentRoutes = require('./routes/students')
const resultRoutes = require('./routes/results')

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

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Something went wrong!' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
