const { ResultPin, Student } = require('../models')

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

    const student = await Student.findOne({ regNo })
    if (!student) return res.status(404).json({ message: 'Student not found' })

    const numPins = Math.min(count || 1, 10)
    const pins = []
    const usedPins = new Set()

    while (pins.length < numPins) {
      const pin = generatePin()
      if (usedPins.has(pin)) continue
      usedPins.add(pin)
      const existing = await ResultPin.findOne({ pin })
      if (existing) continue
      pins.push(pin)
    }

    const pinDocs = pins.map(pin => ({
      pin,
      regNo,
      generatedBy: req.user.id
    }))
    await ResultPin.insertMany(pinDocs)

    const created = await ResultPin.find({ pin: { $in: pins } })
      .sort({ createdAt: -1 })

    res.status(201).json({ message: `${pins.length} PIN(s) generated`, pins: created })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.list = async (req, res) => {
  try {
    const pins = await ResultPin.find()
      .sort({ createdAt: -1 })
      .populate('generatedBy', 'firstName lastName')
    res.json(pins)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}

exports.revoke = async (req, res) => {
  try {
    const { id } = req.params
    const pin = await ResultPin.findByIdAndUpdate(id, { isActive: false }, { new: true })
    res.json({ message: 'PIN revoked', pin })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
}