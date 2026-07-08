const mongoose = require('mongoose')

const AcademicSessionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  isCurrent: { type: Boolean, default: false },
  terms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Term' }],
}, { timestamps: true })

module.exports = mongoose.model('AcademicSession', AcademicSessionSchema)