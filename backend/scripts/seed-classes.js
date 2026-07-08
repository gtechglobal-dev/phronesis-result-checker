require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const Class = require('../src/models/Class')

const classes = [
  { name: 'Montesorri', level: 'MONTESSORI' },
  { name: 'Nursery 1', level: 'NURSERY' },
  { name: 'Nursery 2', level: 'NURSERY' },
  { name: 'Nursery 3', level: 'NURSERY' },
  { name: 'Basic 1', level: 'PRIMARY' },
  { name: 'Basic 2', level: 'PRIMARY' },
  { name: 'Basic 3', level: 'PRIMARY' },
  { name: 'Basic 4', level: 'PRIMARY' },
  { name: 'Basic 5', level: 'PRIMARY' },
  { name: 'Basic 6', level: 'PRIMARY' },
  { name: 'JSS 1A', level: 'SECONDARY' },
  { name: 'JSS 1B', level: 'SECONDARY' },
  { name: 'JSS 2A', level: 'SECONDARY' },
  { name: 'JSS 2B', level: 'SECONDARY' },
  { name: 'JSS 3A', level: 'SECONDARY' },
  { name: 'JSS 3B', level: 'SECONDARY' },
  { name: 'SSS 1A', level: 'SECONDARY' },
  { name: 'SSS 1B', level: 'SECONDARY' },
  { name: 'SSS 2(SCIENCE)', level: 'SECONDARY' },
  { name: 'SSS 2(ARTS)', level: 'SECONDARY' },
  { name: 'SSS 3(SCIENCE)', level: 'SECONDARY' },
  { name: 'SSS 3(ARTS)', level: 'SECONDARY' },
]

async function seed() {
  try {
    await mongoose.connect(process.env.DATABASE_URL)
    console.log('Connected to MongoDB')

    let created = 0
    let skipped = 0

    for (const c of classes) {
      const existing = await Class.findOne({ name: c.name })
      if (existing) {
        console.log(`  SKIP  ${c.name} (${c.level}) — already exists`)
        skipped++
      } else {
        await Class.create(c)
        console.log(`  OK    ${c.name} (${c.level})`)
        created++
      }
    }

    console.log(`\nDone: ${created} created, ${skipped} skipped`)
    process.exit(0)
  } catch (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }
}

seed()
