import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''
const api = axios.create({ baseURL: `${API_URL}/api` })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  createTeacher: (data) => api.post('/auth/create-teacher', data)
}

export const classAPI = {
  getAll: () => api.get('/classes'),
  getSubjects: (classId) => api.get(`/classes/${classId}/subjects`),
  create: (data) => api.post('/classes', data),
  createSubject: (data) => api.post('/classes/subjects', data),
  assignTeacher: (data) => api.post('/classes/assign-teacher', data),
  getTeachers: () => api.get('/classes/teachers/assignments'),
  getMyAssignment: () => api.get('/classes/my-assignment'),
  getSessions: () => api.get('/classes/sessions/all'),
  createSession: (data) => api.post('/classes/sessions', data),
  createTerm: (data) => api.post('/classes/terms', data)
}

export const studentAPI = {
  getAll: (params) => api.get('/students', { params }),
  getUnlinked: (params) => api.get('/students/unlinked', { params }),
  getById: (id) => api.get(`/students/${id}`),
  getMyChildren: () => api.get('/students/my-children'),
  getByClass: (classId) => api.get(`/students/by-class/${classId}`),
  create: (data) => api.post('/students', data),
  bulkCreate: (data) => api.post('/students/bulk', data),
  update: (id, data) => api.put(`/students/${id}`, data)
}

export const resultAPI = {
  checkByRegNo: (params) => api.get('/results/check', { params }),
  getStudentResults: (studentId) => api.get(`/results/student/${studentId}`),
  getParentChildrenResults: () => api.get('/results/parent-children'),
  getById: (id) => api.get(`/results/${id}`),
  create: (data) => api.post('/results', data),
  addComment: (id, data) => api.put(`/results/${id}/comment`, data),
  toggleWithhold: (id, data) => api.put(`/results/${id}/withhold`, data),
  updatePositions: (data) => api.post('/results/positions', data),
  getFormTeacherResults: (params) => api.get('/results/my-class', { params })
}

export const pinAPI = {
  generate: (data) => api.post('/pins/generate', data),
  list: () => api.get('/pins'),
  revoke: (id) => api.put(`/pins/${id}/revoke`)
}

export default api
