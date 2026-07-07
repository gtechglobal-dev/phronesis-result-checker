const mongoose = require('mongoose')

const AcademicSessionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  isCurrent: { type: Boolean, default: false },
}, { timestamps: true })

module.exports = mongoose.model('AcademicSession', AcademicSessionSchema)