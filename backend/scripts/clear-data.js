require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const User = require('../src/models/User')
const Student = require('../src/models/Student')
const Result = require('../src/models/Result')
const ResultDetail = require('../src/models/ResultDetail')
const ResultPin = require('../src/models/ResultPin')
const ClassTeacher = require('../src/models/ClassTeacher')
const SubjectAssignment = require('../src/models/SubjectAssignment')
const SubjectTeacherConfig = require('../src/models/SubjectTeacherConfig')
const AcademicSession = require('../src/models/AcademicSession')
const Term = require('../src/models/Term')
const Subject = require('../src/models/Subject')

async function clearData() {
  await mongoose.connect(process.env.DATABASE_URL)
  console.log('Connected to MongoDB\n')

  await ResultDetail.deleteMany({})
  console.log('✓ Result details cleared')

  await Result.deleteMany({})
  console.log('✓ Results cleared')

  await ResultPin.deleteMany({})
  console.log('✓ Result pins cleared')

  await Student.deleteMany({})
  console.log('✓ Students cleared')

  await SubjectAssignment.deleteMany({})
  console.log('✓ Subject teacher assignments cleared')

  await SubjectTeacherConfig.deleteMany({})
  console.log('✓ Subject teacher config cleared')

  await ClassTeacher.deleteMany({})
  console.log('✓ Form teacher assignments cleared')

  await Subject.deleteMany({})
  console.log('✓ Subjects cleared')

  await Term.deleteMany({})
  console.log('✓ Terms cleared')

  await AcademicSession.deleteMany({})
  console.log('✓ Academic sessions cleared')

  const examOfficers = await User.countDocuments({ role: 'EXAM_OFFICER' })
  const delResult = await User.deleteMany({ role: { $ne: 'EXAM_OFFICER' } })
  console.log(`✓ Non-exam-officer users deleted: ${delResult.deletedCount}`)
  console.log(`  Exam officer(s) kept: ${examOfficers}`)

  console.log('\nDatabase cleared — clean slate ready!')
  process.exit(0)
}

clearData().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
