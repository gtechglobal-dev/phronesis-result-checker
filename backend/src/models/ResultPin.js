const mongoose = require('mongoose')

const ResultPinSchema = new mongoose.Schema({
  pin: { type: String, required: true, unique: true },
  regNo: { type: String, default: null },
  maxUses: { type: Number, default: 5 },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usedBy: [{ regNo: String, usedAt: { type: Date, default: Date.now } }],
}, { timestamps: true })

module.exports = mongoose.model('ResultPin', ResultPinSchema)