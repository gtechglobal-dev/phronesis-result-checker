const mongoose = require('mongoose')

const ResultDetailSchema = new mongoose.Schema({
  result: { type: mongoose.Schema.Types.ObjectId, ref: 'Result', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  ca1: { type: Number, default: 0 },
  ca2: { type: Number, default: 0 },
  exam: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  grade: { type: String, default: 'F' },
  remark: { type: String, default: 'Fail' },
  submitted: { type: Boolean, default: false },
}, { timestamps: true })

ResultDetailSchema.index({ result: 1, subject: 1 }, { unique: true })
ResultDetailSchema.index({ result: 1 })
ResultDetailSchema.index({ subject: 1 })

module.exports = mongoose.model('ResultDetail', ResultDetailSchema)