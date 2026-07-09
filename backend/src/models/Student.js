const mongoose = require('mongoose')

const StudentSchema = new mongoose.Schema({
  regNo: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  arm: { type: String, default: 'A' },
  gender: { type: String, enum: ['M', 'F'] },
  pin: { type: String, default: '1234' },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

StudentSchema.index({ regNo: 1, session: 1 }, { unique: true })
StudentSchema.index({ class: 1 })
StudentSchema.index({ class: 1, session: 1 })
StudentSchema.index({ parent: 1 })

module.exports = mongoose.model('Student', StudentSchema)