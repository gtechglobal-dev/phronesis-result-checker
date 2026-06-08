import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ResultChecker from './pages/ResultChecker'
import ExamOfficerDashboard from './pages/dashboard/ExamOfficerDashboard'
import FormTeacherDashboard from './pages/dashboard/FormTeacherDashboard'
import ParentDashboard from './pages/dashboard/ParentDashboard'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1B5E20]"></div></div>
  if (!user) return <Navigate to="/login" />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />
  return children
}

function DashboardRouter() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" />
  if (user.role === 'EXAM_OFFICER') return <ExamOfficerDashboard />
  if (user.role === 'FORM_TEACHER') return <FormTeacherDashboard />
  if (user.role === 'PARENT') return <ParentDashboard />
  return <Navigate to="/" />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/check-result" element={<ResultChecker />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/exam-officer" element={
              <ProtectedRoute allowedRoles={['EXAM_OFFICER']}>
                <ExamOfficerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/form-teacher" element={
              <ProtectedRoute allowedRoles={['FORM_TEACHER']}>
                <FormTeacherDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/parent" element={
              <ProtectedRoute allowedRoles={['PARENT']}>
                <ParentDashboard />
              </ProtectedRoute>
            } />
            <Route path="*" element={
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-[#1B5E20]">404</h1>
                  <p className="text-gray-500 mt-2">Page not found</p>
                </div>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
