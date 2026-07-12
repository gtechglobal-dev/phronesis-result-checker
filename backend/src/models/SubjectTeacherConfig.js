const mongoose = require("mongoose");

const SubjectTeacherConfigSchema = new mongoose.Schema({
  passwordHash: { type: String, default: "" },
  passwordPlain: { type: String, default: "" },
});

module.exports = mongoose.model("SubjectTeacherConfig", SubjectTeacherConfigSchema);
