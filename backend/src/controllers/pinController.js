const { ResultPin } = require('../models')
const { emitToRole, emitToUser, emitBroadcast } = require('../utils/socket')

function generatePin() {
  let pin = ''
  for (let i = 0; i < 10; i++) {
    pin += Math.floor(Math.random() * 10).toString()
  }
  return pin
}

exports.generate = async (req, res) => {
  try {
    const { count } = req.body

    const numPins = Math.min(count || 1, 50)
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
      generatedBy: req.user.id
    }))
    await ResultPin.insertMany(pinDocs)

    const created = await ResultPin.find({ pin: { $in: pins } })
      .sort({ createdAt: -1 })

    res.status(201).json({ message: `${pins.length} PIN(s) generated`, pins: created })
    try { emitToRole('EXAM_OFFICER', 'pin:generated', { count: pins.length }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.list = async (req, res) => {
  try {
    const pins = await ResultPin.find()
      .sort({ createdAt: -1 })
      .populate('generatedBy', 'firstName lastName')
    res.json(pins)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}

exports.deletePin = async (req, res) => {
  try {
    const { id } = req.params
    const pin = await ResultPin.findByIdAndDelete(id)
    if (!pin) return res.status(404).json({ message: 'PIN not found' })
    res.json({ message: 'PIN deleted' })
    try { emitToRole('EXAM_OFFICER', 'pin:deleted', { pinId: id }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: 'Internal error' })
  }
}