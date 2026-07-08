const mongoose = require("mongoose");

const SubjectTeacherConfigSchema = new mongoose.Schema({
  passwordHash: { type: String, default: "" },
  password: { type: String, default: "" },
});

module.exports = mongoose.model("SubjectTeacherConfig", SubjectTeacherConfigSchema);
