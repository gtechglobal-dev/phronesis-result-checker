const mongoose = require('mongoose')

const SubjectAssignmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
}, { timestamps: true })

SubjectAssignmentSchema.index({ user: 1, subject: 1, class: 1 }, { unique: true })

module.exports = mongoose.model('SubjectAssignment', SubjectAssignmentSchema)