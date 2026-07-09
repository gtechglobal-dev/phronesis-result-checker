import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login")
        window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  getMe: () => api.get("/auth/me"),
  createTeacher: (data) => api.post("/auth/create-teacher", data),
  getTeachers: () => api.get("/auth/teachers"),
  cancelAssignment: (id) => api.put(`/auth/teachers/${id}/cancel-assignment`),
  changePassword: (id, data) =>
    api.put(`/auth/teachers/${id}/change-password`, data),
  updateTeacherRole: (id, data) => api.put(`/auth/teachers/${id}/role`, data),
  assignTeacher: (data) => api.post("/auth/assign-teacher", data),
  updateSubjectTeacherPassword: (data) =>
    api.put("/auth/subject-teacher-password", data),
  getSubjectTeacherPasswordHash: () =>
    api.get("/auth/subject-teacher-password"),
  updateSubjectTeacherUsername: (id, data) =>
    api.put(`/auth/subject-teachers/${id}/username`, data),
  deleteTeacher: (id) => api.delete(`/auth/teachers/${id}`),
};

export const classAPI = {
  getAll: () => api.get("/classes"),
  getSubjects: (classId) => api.get(`/classes/${classId}/subjects`),
  create: (data) => api.post("/classes", data),
  createSubject: (data) => api.post("/classes/subjects", data),
  bulkCreateSubjects: (data) => api.post("/classes/subjects/bulk", data),
  assignTeacher: (data) => api.post("/classes/assign-teacher", data),
  getTeachers: () => api.get("/classes/teachers/assignments"),
  getMyAssignment: () => api.get("/classes/my-assignment"),
  getSessions: () => api.get("/classes/sessions/all"),
  createSession: (data) => api.post("/classes/sessions", data),
  createTerm: (data) => api.post("/classes/terms", data),
  deleteSession: (id) => api.delete(`/classes/sessions/${id}`),
  deleteTerm: (id) => api.delete(`/classes/terms/${id}`),
  deleteClass: (id) => api.delete(`/classes/${id}`),
  deleteSubject: (id) => api.delete(`/classes/subjects/${id}`),
};

export const studentAPI = {
  getAll: (params) => api.get("/students", { params }),
  getUnlinked: (params) => api.get("/students/unlinked", { params }),
  getById: (id) => api.get(`/students/${id}`),
  getMyChildren: () => api.get("/students/my-children"),
  getByClass: (classId) => api.get(`/students/by-class/${classId}`),
  create: (data) => api.post("/students", data),
  bulkCreate: (data) => api.post("/students/bulk", data),
  update: (id, data) => api.put(`/students/${id}`, data),
  remove: (id) => api.delete(`/students/${id}`),
};

export const resultAPI = {
  checkByRegNo: (data) => api.post("/results/check", data),
  getPublishedSessions: () => api.get("/results/published-sessions"),
  getPendingSummary: () => api.get("/results/pending/summary"),
  getPendingBroadsheet: (sessionId, termId, classId) => api.get(`/results/pending/broadsheet/${sessionId}/${termId}/${classId}`),
  getPendingResults: (params) => api.get("/results/pending", { params }),
  getStudentResults: (studentId) => api.get(`/results/student/${studentId}`),
  getParentChildrenResults: () => api.get("/results/parent-children"),
  getById: (id) => api.get(`/results/${id}`),
  create: (data) => api.post("/results", data),
  addComment: (id, data) => api.put(`/results/${id}/comment`, data),
  updatePrincipalComment: (id, data) =>
    api.put(`/results/${id}/principal-comment`, data),
  toggleWithhold: (id, data) => api.put(`/results/${id}/withhold`, data),
  updateStatus: (id, data) => api.put(`/results/${id}/status`, data),
  updateStudentScores: (id, data) => api.put(`/results/${id}/scores`, data),
  publishClassResults: (sessionId, termId, classId) => api.post(`/results/publish/${sessionId}/${termId}/${classId}`),
  getWithheldResults: () => api.get("/results/withheld"),
  getManageResults: (params) => api.get("/results/manage/all", { params }),
  updatePositions: (data) => api.post("/results/positions", data),
  getFormTeacherResults: (params) => api.get("/results/my-class", { params }),
  getArchiveSessions: () => api.get("/results/archive/sessions"),
  getArchiveClasses: (sessionId, termId) => api.get(`/results/archive/sessions/${sessionId}/terms/${termId}/classes`),
  getArchiveBroadsheet: (sessionId, termId, classId) => api.get(`/results/archive/sessions/${sessionId}/terms/${termId}/classes/${classId}`),
};

export const pinAPI = {
  generate: (data) => api.post("/pins/generate", data),
  list: () => api.get("/pins"),
  deletePin: (id) => api.delete(`/pins/${id}`),
};

export const subjectAssignmentAPI = {
  create: (data) => api.post("/subject-assignments", data),
  list: (params) => api.get("/subject-assignments", { params }),
  getMy: () => api.get("/subject-assignments/my"),
  remove: (id) => api.delete(`/subject-assignments/${id}`),
};

export const subjectTeacherAPI = {
  getAssignment: () => api.get("/subject-teacher/assignment"),
  getScores: (params) => api.get("/subject-teacher/scores", { params }),
  saveScores: (data) => api.post("/subject-teacher/scores", data),
  submitScores: (data) => api.post("/subject-teacher/submit", data),
};

export const formTeacherAPI = {
  getBroadsheet: (params) => api.get("/form-teacher/broadsheet", { params }),
  updateComment: (data) => api.put("/form-teacher/comment", data),
  updatePosition: (data) => api.put("/form-teacher/position", data),
  updateSettings: (data) => api.post("/form-teacher/settings", data),
  updateAttendance: (data) => api.post("/form-teacher/attendance", data),
  submitBroadsheet: (data) => api.post("/form-teacher/submit", data),
  reopenSubject: (data) => api.post("/form-teacher/reopen-subject", data),
};

export default api;
