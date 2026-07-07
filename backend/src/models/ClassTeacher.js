const mongoose = require('mongoose')

const ClassTeacherSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, unique: true },
}, { timestamps: true })

ClassTeacherSchema.index({ user: 1, class: 1 }, { unique: true })
ClassTeacherSchema.index({ user: 1 })

module.exports = mongoose.model('ClassTeacher', ClassTeacherSchema)