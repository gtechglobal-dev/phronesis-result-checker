const mongoose = require('mongoose')

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
}, { timestamps: true })

SubjectSchema.index({ class: 1, session: 1 })
SubjectSchema.index({ name: 1, class: 1, session: 1 }, { unique: true })

module.exports = mongoose.model('Subject', SubjectSchema)