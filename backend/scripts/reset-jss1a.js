require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const Class = require('../src/models/Class')
const Student = require('../src/models/Student')
const Result = require('../src/models/Result')
const ResultDetail = require('../src/models/ResultDetail')

async function resetJSS1A() {
  await mongoose.connect(process.env.DATABASE_URL)
  console.log('Connected to MongoDB\n')

  const jss1a = await Class.findOne({ name: 'JSS 1A' })
  if (!jss1a) {
    console.error('JSS 1A class not found in database')
    process.exit(1)
  }
  console.log(`Found class: ${jss1a.name} (${jss1a._id})\n`)

  const students = await Student.find({ class: jss1a._id })
  console.log(`Found ${students.length} student(s) in JSS 1A`)

  const studentIds = students.map(s => s._id)
  const studentIdStrings = studentIds.map(id => id.toString())

  const results = await Result.find({ class: jss1a._id })
  console.log(`Found ${results.length} result(s) for JSS 1A`)

  const resultIds = results.map(r => r._id)
  const resultIdStrings = resultIds.map(id => id.toString())

  if (resultIds.length > 0) {
    const detailResult = await ResultDetail.deleteMany({ result: { $in: resultIds } })
    console.log(`  Deleted ${detailResult.deletedCount} ResultDetail(s)`)
  }

  if (resultIds.length > 0) {
    const resultDel = await Result.deleteMany({ class: jss1a._id })
    console.log(`  Deleted ${resultDel.deletedCount} Result(s)`)
  }

  if (studentIds.length > 0) {
    const studentDel = await Student.deleteMany({ class: jss1a._id })
    console.log(`  Deleted ${studentDel.deletedCount} Student(s)`)
  }

  console.log('\nJSS 1A reset complete — students and results cleared.')
  process.exit(0)
}

resetJSS1A().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
