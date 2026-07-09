const mongoose = require('mongoose')
const crypto = require('crypto')

const ResultPinSchema = new mongoose.Schema({
  pin: { type: String, required: true, unique: true },
  pinHash: { type: String, sparse: true, unique: true },
  regNo: { type: String, default: null },
  maxUses: { type: Number, default: 5 },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usedBy: [{ regNo: String, usedAt: { type: Date, default: Date.now } }],
}, { timestamps: true })

ResultPinSchema.statics.hashPin = function (pin) {
  return crypto.createHash('sha256').update(pin.toUpperCase()).digest('hex')
}

module.exports = mongoose.model('ResultPin', ResultPinSchema)