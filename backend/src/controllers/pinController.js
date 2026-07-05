const prisma = require('../utils/prisma')

function generatePin() {
  let pin = ''
  for (let i = 0; i < 10; i++) {
    pin += Math.floor(Math.random() * 10).toString()
  }
  return pin
}

exports.generate = async (req, res) => {
  try {
    const { regNo, count } = req.body
    if (!regNo) return res.status(400).json({ message: 'Registration number is required' })

    const student = await prisma.student.findUnique({ where: { regNo } })
    if (!student) return res.status(404).json({ message: 'Student not found' })

    const numPins = Math.min(count || 1, 10)
    const pins = []
    const usedPins = new Set()

    while (pins.length < numPins) {
      const pin = generatePin()
      if (usedPins.has(pin)) continue
      usedPins.add(pin)
      const existing = await prisma.resultPin.findUnique({ where: { pin } })
      if (existing) continue
      pins.push(pin)
    }

    await prisma.resultPin.createMany({
      data: pins.map(pin => ({
        pin,
        regNo,
        generatedBy: req.user.id
      }))
    })

    const created = await prisma.resultPin.findMany({
      where: { pin: { in: pins } },
      orderBy: { createdAt: 'desc' }
    })

    res.status(201).json({ message: `${pins.length} PIN(s) generated`, pins: created })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.list = async (req, res) => {
  try {
    const pins = await prisma.resultPin.findMany({
      orderBy: { createdAt: 'desc' },
      include: { generator: { select: { firstName: true, lastName: true } } }
    })
    res.json(pins)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.revoke = async (req, res) => {
  try {
    const { id } = req.params
    const pin = await prisma.resultPin.update({
      where: { id },
      data: { isActive: false }
    })
    res.json({ message: 'PIN revoked', pin })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}
