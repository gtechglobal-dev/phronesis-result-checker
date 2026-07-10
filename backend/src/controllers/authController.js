const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Student, ClassTeacher, SubjectTeacherConfig } = require("../models");
const { isString, sanitizeString, escapeRegex } = require("../utils/sanitize");
const { emitToRole, emitToUser, emitBroadcast } = require("../utils/socket");

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || "Admin")
  .split(",")
  .map((s) => s.trim());

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
};

exports.register = async (req, res) => {
  try {
    const { email, phone, password, firstName, lastName, studentIds } =
      req.body;

    if (!isString(password) || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    if (
      !isString(firstName) ||
      !isString(lastName) ||
      !firstName.trim() ||
      !lastName.trim()
    ) {
      return res
        .status(400)
        .json({ message: "First and last name are required" });
    }

    const identifier = email || phone;
    if (!identifier)
      return res.status(400).json({ message: "Email or phone is required" });
    if (email && !isString(email))
      return res.status(400).json({ message: "Invalid email" });

    const existing = await User.findOne({
      $or: [
        { email: isString(email) ? email : "" },
        { phone: isString(phone) ? phone : "" },
      ],
    });
    if (existing)
      return res
        .status(400)
        .json({ message: "Email or phone already registered" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: isString(email) ? email : null,
      phone: isString(phone) ? phone : null,
      password: hashedPassword,
      firstName: sanitizeString(firstName.trim()),
      lastName: sanitizeString(lastName.trim()),
      role: "PARENT",
    });

    if (studentIds && studentIds.length > 0) {
      await Student.updateMany(
        { _id: { $in: studentIds } },
        { parent: user._id },
      );
    }

    const token = generateToken(user);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
    try { emitToRole('EXAM_OFFICER', 'user:registered', { userId: user._id, role: 'PARENT' }) } catch (e) {}
  } catch (error) {
    console.error('LOGIN ERROR:', error)
    res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isString(email) || !isString(password)) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (ADMIN_USERNAMES.includes(email.trim())) {
      const adminPassword = process.env.ADMIN_PASSWORD || "Schooladmin001";
      let admin = await User.findOne({ role: "EXAM_OFFICER" });
      if (!admin) {
        const hashed = await bcrypt.hash(adminPassword, 12);
        admin = await User.create({
          email: "admin@phronesis.com",
          password: hashed,
          firstName: "Exam",
          lastName: "Officer",
          role: "EXAM_OFFICER",
        });
      }
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
      const token = generateToken(admin);
      return res.json({
        message: "Login successful",
        token,
        user: {
          id: admin._id,
          email: admin.email,
          role: admin.role,
          firstName: admin.firstName,
          lastName: admin.lastName,
        },
      });
    }

    const normalizedEmail = email.trim();
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') } },
        { phone: normalizedEmail.toLowerCase() },
      ],
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    let isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    if (user.role === "EXAM_OFFICER") {
      return res.status(400).json({ message: "Use Admin login" });
    }

    const token = generateToken(user);
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.createTeacher = async (req, res) => {
  try {
    const { firstName, lastName, email, password, classId, role } = req.body;
    const teacherRole = role || "FORM_TEACHER";

    if (!isString(email)) {
      return res.status(400).json({ message: "Username is required" });
    }
    if (!isString(firstName) || !isString(lastName)) {
      return res
        .status(400)
        .json({ message: "First and last name are required" });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing)
      return res.status(400).json({ message: "Username already in use" });

    let hashedPassword;
    if (teacherRole === "SUBJECT_TEACHER") {
      const existing = await User.findOne({ role: "SUBJECT_TEACHER" }).select(
        "password",
      );
      if (existing) {
        hashedPassword = existing.password;
      } else {
        const config = await SubjectTeacherConfig.findOne();
        hashedPassword = config?.passwordHash
          ? config.passwordHash
          : null;
      }
      if (!hashedPassword) {
        return res.status(400).json({ message: "No subject teacher password configured. Set it first." });
      }
    } else {
      if (!isString(password) || password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters" });
      }
      hashedPassword = await bcrypt.hash(password, 12);
    }

    const teacher = await User.create({
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      firstName: sanitizeString(firstName.trim()),
      lastName: sanitizeString(lastName.trim()),
      role: teacherRole,
    });

    if (classId) {
      await ClassTeacher.deleteMany({ class: classId });
      await ClassTeacher.create({ user: teacher._id, class: classId });
    }

    res.status(201).json({
      message: "Teacher created",
      teacher: {
        id: teacher._id,
        email: teacher.email,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        role: teacher.role,
      },
    });
    try { emitToRole('EXAM_OFFICER', 'teacher:created', { teacher: teacher }); emitBroadcast('entity:updated', { type: 'teacher' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateTeacherRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["FORM_TEACHER", "SUBJECT_TEACHER"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const update = { role };
    if (role === "SUBJECT_TEACHER") {
      const config = await SubjectTeacherConfig.findOne();
      if (config?.passwordHash) {
        update.password = config.passwordHash;
      } else {
        const existing = await User.findOne({ role: "SUBJECT_TEACHER" }).select("password");
        if (existing) update.password = existing.password;
      }
      if (!update.password) return res.status(400).json({ message: "No subject teacher password configured. Set it first." });
    }
    const teacher = await User.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true },
    ).select("email firstName lastName role");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: `Role updated`, teacher });
    try { emitToRole('EXAM_OFFICER', 'teacher:roleChanged', { teacherId: req.params.id, role }); emitBroadcast('entity:updated', { type: 'teacher' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.assignTeacherToClass = async (req, res) => {
  try {
    const { teacherId, classId } = req.body;
    if (!isString(teacherId) || !isString(classId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const teacher = await User.findOne({
      _id: teacherId,
      role: { $in: ["FORM_TEACHER", "SUBJECT_TEACHER"] },
    });
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    await ClassTeacher.deleteMany({ class: classId });

    const assignment = await ClassTeacher.create({
      user: teacherId,
      class: classId,
    });
    await assignment.populate("class");

    res.json({ message: "Teacher assigned", assignment });
    try { emitToRole('EXAM_OFFICER', 'teacher:assigned', { teacherId, classId }); emitBroadcast('entity:updated', { type: 'teacher' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.cancelAssignment = async (req, res) => {
  try {
    const assignment = await ClassTeacher.findOne({ user: req.params.id });
    if (!assignment)
      return res
        .status(404)
        .json({ message: "No assignment found for this teacher" });
    await ClassTeacher.findByIdAndDelete(assignment._id);
    res.json({ message: "Assignment cancelled" });
    try { emitToRole('EXAM_OFFICER', 'teacher:unassigned', { teacherId: req.params.id }); emitBroadcast('entity:updated', { type: 'teacher' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!isString(password) || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
    res.json({ message: "Password changed" });
    try { emitToRole('EXAM_OFFICER', 'teacher:passwordChanged', { teacherId: req.params.id }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateSubjectTeacherPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!isString(password) || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    const hashed = await bcrypt.hash(password, 12);
    await User.updateMany({ role: "SUBJECT_TEACHER" }, { password: hashed });
    await SubjectTeacherConfig.findOneAndUpdate(
      {},
      { passwordHash: hashed },
      { upsert: true },
    );
    await User.findOneAndUpdate(
      { email: "staff" },
      {
        email: "staff",
        password: hashed,
        role: "SUBJECT_TEACHER",
        firstName: "Staff",
        lastName: "Staff",
      },
      { upsert: true },
    );
    res.json({ message: "Subject teacher password updated" });
    try { emitToRole('EXAM_OFFICER', 'teacher:passwordChanged', { type: 'subject_teacher' }); emitBroadcast('entity:updated', { type: 'teacher' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getSubjectTeacherPasswordHash = async (req, res) => {
  try {
    const config = await SubjectTeacherConfig.findOne();
    if (config && config.passwordHash) {
      return res.json({ password: "[set]" });
    }
    const teacher = await User.findOne({ role: "SUBJECT_TEACHER" }).select(
      "password",
    );
    if (teacher && teacher.password) {
      return res.json({ password: "[set]" });
    }
    return res.json({ password: "" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (!["FORM_TEACHER", "SUBJECT_TEACHER"].includes(teacher.role)) {
      return res.status(400).json({ message: "Can only delete teachers" });
    }
    await ClassTeacher.deleteMany({ user: teacher._id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Teacher removed" });
    try { emitToRole('EXAM_OFFICER', 'teacher:deleted', { teacherId: req.params.id }); emitBroadcast('entity:updated', { type: 'teacher' }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateSubjectTeacherUsername = async (req, res) => {
  try {
    const { email } = req.body;
    if (!isString(email) || !email.trim()) {
      return res.status(400).json({ message: "Username is required" });
    }
    const existing = await User.findOne({
      email: email.trim().toLowerCase(),
      _id: { $ne: req.params.id },
    });
    if (existing) {
      return res.status(400).json({ message: "Username already in use" });
    }
    const teacher = await User.findByIdAndUpdate(
      req.params.id,
      { email: email.trim().toLowerCase() },
      { new: true },
    ).select("email firstName lastName role");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: "Username updated", teacher });
    try { emitToRole('EXAM_OFFICER', 'teacher:usernameUpdated', { teacherId: req.params.id }) } catch (e) {}
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "email phone role firstName lastName createdAt",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({
      role: { $in: ["FORM_TEACHER", "SUBJECT_TEACHER"] },
    })
      .select("email firstName lastName role")
      .sort({ firstName: 1 });

    const teacherIds = teachers.map((t) => t._id);
    const assignments = await ClassTeacher.find({
      user: { $in: teacherIds },
    }).populate("class");
    const assignmentMap = {};
    assignments.forEach((a) => {
      if (!assignmentMap[a.user]) assignmentMap[a.user] = [];
      assignmentMap[a.user].push(a);
    });

    const result = teachers.map((t) => ({
      ...t.toObject(),
      classAssignments: assignmentMap[t._id] || [],
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
