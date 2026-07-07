const mongoose = require('mongoose')

const TermSchema = new mongoose.Schema({
  name: { type: String, required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  isCurrent: { type: Boolean, default: false },
}, { timestamps: true })

module.exports = mongoose.model('Term', TermSchema)