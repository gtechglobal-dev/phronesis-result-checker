const mongoose = require('mongoose')

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  level: { type: String, enum: ['MONTESSORI', 'NURSERY', 'PRIMARY', 'SECONDARY'], required: true },
}, { timestamps: true })

module.exports = mongoose.model('Class', ClassSchema)