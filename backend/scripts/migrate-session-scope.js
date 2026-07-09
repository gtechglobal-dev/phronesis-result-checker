require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const Student = require('../src/models/Student')
const Subject = require('../src/models/Subject')
const AcademicSession = require('../src/models/AcademicSession')

async function migrate() {
  try {
    await mongoose.connect(process.env.DATABASE_URL)
    console.log('Connected to MongoDB')

    const currentSession = await AcademicSession.findOne({ isCurrent: true })
    if (!currentSession) {
      console.log('No current session found. Please set a session as current first.')
      process.exit(1)
    }
    console.log(`Using current session: ${currentSession.name} (${currentSession._id})`)

    const sid = currentSession._id

    const studentsWithoutSession = await Student.countDocuments({ session: { $exists: false } })
    if (studentsWithoutSession > 0) {
      await Student.updateMany({ session: { $exists: false } }, { $set: { session: sid } })
      console.log(`Updated ${studentsWithoutSession} students missing session field`)
    } else {
      console.log('All students already have session field')
    }

    const subjectsWithoutSession = await Subject.countDocuments({ session: { $exists: false } })
    if (subjectsWithoutSession > 0) {
      await Subject.updateMany({ session: { $exists: false } }, { $set: { session: sid } })
      console.log(`Updated ${subjectsWithoutSession} subjects missing session field`)
    } else {
      console.log('All subjects already have session field')
    }

    const newStudentIndexes = await Student.collection.indexes()
    const hasCompoundIndex = newStudentIndexes.some(idx =>
      idx.key && idx.key.regNo === 1 && idx.key.session === 1
    )
    if (!hasCompoundIndex) {
      console.log('Creating new compound index on Student { regNo, session }...')
      await Student.collection.createIndex({ regNo: 1, session: 1 }, { unique: true })
    }

    const newSubjectIndexes = await Subject.collection.indexes()
    const hasSubjectIndex = newSubjectIndexes.some(idx =>
      idx.key && idx.key.name === 1 && idx.key.class === 1 && idx.key.session === 1
    )
    if (!hasSubjectIndex) {
      console.log('Creating new compound index on Subject { name, class, session }...')
      await Subject.collection.createIndex({ name: 1, class: 1, session: 1 }, { unique: true })
    }

    console.log('\nMigration complete!')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error.message)
    process.exit(1)
  }
}

migrate()
