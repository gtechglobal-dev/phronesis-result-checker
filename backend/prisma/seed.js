const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  const examOfficerPassword = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where: { email: 'exam.officer@phronesis.com' },
    update: {},
    create: {
      email: 'exam.officer@phronesis.com',
      password: examOfficerPassword,
      firstName: 'Exam',
      lastName: 'Officer',
      role: 'EXAM_OFFICER',
      phone: '08012345678'
    }
  })
  console.log('✓ Created exam officer')

  const classNames = [
    { name: 'Montessori 1', level: 'MONTESSORI' },
    { name: 'Montessori 2', level: 'MONTESSORI' },
    { name: 'Nursery 1', level: 'NURSERY' },
    { name: 'Nursery 2', level: 'NURSERY' },
    { name: 'Nursery 3', level: 'NURSERY' },
    { name: 'Primary 1', level: 'PRIMARY' },
    { name: 'Primary 2', level: 'PRIMARY' },
    { name: 'Primary 3', level: 'PRIMARY' },
    { name: 'Primary 4', level: 'PRIMARY' },
    { name: 'Primary 5', level: 'PRIMARY' },
    { name: 'Primary 6', level: 'PRIMARY' },
    { name: 'JSS 1', level: 'SECONDARY' },
    { name: 'JSS 2', level: 'SECONDARY' },
    { name: 'JSS 3', level: 'SECONDARY' },
    { name: 'SSS 1', level: 'SECONDARY' },
    { name: 'SSS 2', level: 'SECONDARY' },
    { name: 'SSS 3', level: 'SECONDARY' }
  ]

  for (const cls of classNames) {
    await prisma.class.upsert({ where: { name: cls.name }, update: {}, create: cls })
  }
  console.log('✓ Created classes')

  const allClasses = await prisma.class.findMany()

  const montessoriSubjects = ['Literacy', 'Numeracy', 'Sensorial', 'Practical Life', 'Art & Craft', 'Music & Movement', 'Physical Development', 'Social Skills']
  const nurserySubjects = ['Mathematics', 'English Language', 'Basic Science', 'Social Habits', 'Writing', 'Rhymes', 'Art & Craft', 'Physical Education']
  const primarySubjects = ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Computer Studies', 'Religious Studies', 'Creative Arts', 'Music', 'Physical Education', 'Home Economics']
  const secondarySubjects = ['Mathematics', 'English Language', 'Biology', 'Chemistry', 'Physics', 'Government', 'Economics', 'Literature', 'History', 'Computer Science', 'Agricultural Science', 'Further Mathematics', 'Geography', 'Civic Education', 'Yoruba Language']

  for (const cls of allClasses) {
    const subjects = cls.level === 'MONTESSORI' ? montessoriSubjects : cls.level === 'NURSERY' ? nurserySubjects : cls.level === 'PRIMARY' ? primarySubjects : secondarySubjects
    const existingSubjects = await prisma.subject.findMany({ where: { classId: cls.id }, select: { name: true } })
    const existingNames = new Set(existingSubjects.map(s => s.name))
    const newSubjects = subjects.filter(s => !existingNames.has(s))
    if (newSubjects.length > 0) {
      await prisma.subject.createMany({ data: newSubjects.map(name => ({ name, classId: cls.id })) })
    }
  }
  console.log('✓ Created subjects')

  const session = await prisma.academicSession.upsert({
    where: { name: '2025/2026' },
    update: {},
    create: { name: '2025/2026', isCurrent: true }
  })
  console.log('✓ Created session')

  const termNames = ['1st Term', '2nd Term', '3rd Term']
  for (const name of termNames) {
    const existing = await prisma.term.findFirst({ where: { name, sessionId: session.id } })
    if (!existing) {
      await prisma.term.create({ data: { name, sessionId: session.id, isCurrent: name === '1st Term' } })
    }
  }
  console.log('✓ Created terms')

  console.log('\n✅ Seed completed successfully!')
  console.log('📧 Exam Officer: exam.officer@phronesis.com / admin123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
