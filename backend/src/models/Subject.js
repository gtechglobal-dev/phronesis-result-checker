const mongoose = require('mongoose')

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
}, { timestamps: true })

SubjectSchema.index({ class: 1 })

module.exports = mongoose.model('Subject', SubjectSchema)