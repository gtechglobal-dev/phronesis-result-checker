const mongoose = require('mongoose')

const ResultPinSchema = new mongoose.Schema({
  pin: { type: String, required: true, unique: true },
  regNo: { type: String, required: true },
  maxUses: { type: Number, default: 5 },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

module.exports = mongoose.model('ResultPin', ResultPinSchema)