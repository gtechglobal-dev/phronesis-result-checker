require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const User = require('../src/models/User')
const Result = require('../src/models/Result')
const ResultDetail = require('../src/models/ResultDetail')
const ResultPin = require('../src/models/ResultPin')
const ClassTeacher = require('../src/models/ClassTeacher')
const SubjectAssignment = require('../src/models/SubjectAssignment')
const SubjectTeacherConfig = require('../src/models/SubjectTeacherConfig')

async function clearData() {
  await mongoose.connect(process.env.DATABASE_URL)
  console.log('Connected to MongoDB\n')

  await ResultDetail.deleteMany({})
  console.log('✓ Result details cleared')

  await Result.deleteMany({})
  console.log('✓ Results cleared')

  await ResultPin.deleteMany({})
  console.log('✓ Result pins cleared')

  await ClassTeacher.deleteMany({})
  console.log('✓ Form teacher assignments cleared')

  await SubjectAssignment.deleteMany({})
  console.log('✓ Subject teacher assignments cleared')

  await SubjectTeacherConfig.deleteMany({})
  console.log('✓ Subject teacher config cleared')

  const examOfficers = await User.countDocuments({ role: 'EXAM_OFFICER' })
  const delResult = await User.deleteMany({ role: { $ne: 'EXAM_OFFICER' } })
  console.log(`✓ Non-exam-officer users deleted: ${delResult.deletedCount}`)
  console.log(`  Exam officer(s) kept: ${examOfficers}`)

  console.log('\nDatabase cleared successfully!')
  process.exit(0)
}

clearData().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
