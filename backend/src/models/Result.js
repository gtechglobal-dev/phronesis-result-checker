const mongoose = require('mongoose')

const ResultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term', required: true },
  examOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  formTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalScore: { type: Number, default: 0 },
  average: { type: Number, default: 0 },
  position: { type: Number },
  withheld: { type: Boolean, default: false },
  status: { type: String, default: 'DRAFT', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'] },
  teacherComment: { type: String },
  principalComment: { type: String },
  daysPresent: { type: Number },
  daysAbsent: { type: Number },
}, { timestamps: true, toJSON: { virtuals: true } })

ResultSchema.virtual('details', {
  ref: 'ResultDetail',
  localField: '_id',
  foreignField: 'result',
})

ResultSchema.index({ student: 1 })
ResultSchema.index({ class: 1 })
ResultSchema.index({ session: 1 })
ResultSchema.index({ term: 1 })
ResultSchema.index({ status: 1 })
ResultSchema.index({ student: 1, session: 1, term: 1 }, { unique: true })
ResultSchema.index({ class: 1, session: 1, term: 1 })

module.exports = mongoose.model('Result', ResultSchema)