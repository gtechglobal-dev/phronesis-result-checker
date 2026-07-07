const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['FORM_TEACHER', 'PARENT', 'EXAM_OFFICER', 'SUBJECT_TEACHER'], required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String },
}, { timestamps: true })

module.exports = mongoose.model('User', UserSchema)