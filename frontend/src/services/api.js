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
  getMe: () => api.get('/auth/me')
}

export const classAPI = {
  getAll: () => api.get('/classes'),
  getSubjects: (classId) => api.get(`/classes/${classId}/subjects`),
  create: (data) => api.post('/classes', data),
  createSubject: (data) => api.post('/classes/subjects', data),
  assignTeacher: (data) => api.post('/classes/assign-teacher', data),
  getTeachers: () => api.get('/classes/teachers/assignments'),
  getSessions: () => api.get('/classes/sessions/all'),
  createSession: (data) => api.post('/classes/sessions', data),
  createTerm: (data) => api.post('/classes/terms', data)
}

export const studentAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  getMyChildren: () => api.get('/students/my-children'),
  getByClass: (classId) => api.get(`/students/class/${classId}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data)
}

export const resultAPI = {
  checkByRegNo: (params) => api.get('/results/check', { params }),
  getStudentResults: (studentId) => api.get(`/results/student/${studentId}`),
  getById: (id) => api.get(`/results/${id}`),
  create: (data) => api.post('/results', data),
  addComment: (id, data) => api.put(`/results/${id}/comment`, data),
  updatePositions: (data) => api.post('/results/update-positions', data),
  getFormTeacherResults: (params) => api.get('/results/form-teacher', { params })
}

export default api
