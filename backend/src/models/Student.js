const mongoose = require('mongoose')

const StudentSchema = new mongoose.Schema({
  regNo: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  arm: { type: String, default: 'A' },
  pin: { type: String, default: '1234' },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

StudentSchema.index({ class: 1 })
StudentSchema.index({ parent: 1 })

module.exports = mongoose.model('Student', StudentSchema)