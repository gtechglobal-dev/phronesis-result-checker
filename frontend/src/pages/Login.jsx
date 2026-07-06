import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const roles = [
  {
    key: 'SUBJECT_TEACHER',
    title: 'Subject Teacher',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" fill="currentColor" opacity="0.2" />
      </svg>
    ),
    description: 'Upload subject scores to spreadsheet',
    gradient: 'from-emerald-500 to-green-700',
    hoverGradient: 'from-emerald-600 to-green-800',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    textColor: 'text-emerald-700',
    ring: 'ring-emerald-500',
    backendRole: 'FORM_TEACHER',
    dashboardPath: '/dashboard/subject-teacher'
  },
  {
    key: 'FORM_TEACHER',
    title: 'Form Teacher',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" fill="currentColor" opacity="0.2" />
      </svg>
    ),
    description: 'Manage results & add teacher comments',
    gradient: 'from-blue-500 to-blue-700',
    hoverGradient: 'from-blue-600 to-blue-800',
    bgLight: 'bg-blue-50',
    border: 'border-blue-200',
    textColor: 'text-blue-700',
    ring: 'ring-blue-500',
    backendRole: 'FORM_TEACHER',
    dashboardPath: '/dashboard/form-teacher'
  },
  {
    key: 'EXAM_OFFICER',
    title: 'Exam Officer',
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" fill="currentColor" opacity="0.2" />
      </svg>
    ),
    description: 'Full administrative control over results',
    gradient: 'from-yellow-500 to-amber-700',
    hoverGradient: 'from-yellow-600 to-amber-800',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-200',
    textColor: 'text-yellow-700',
    ring: 'ring-yellow-500',
    backendRole: 'EXAM_OFFICER',
    dashboardPath: '/dashboard/exam-officer'
  }
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState(null)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const openModal = (role) => {
    setSelectedRole(role)
    setForm({ email: '', password: '', subject: '' })
    setError('')
  }

  const closeModal = () => {
    setSelectedRole(null)
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      const expectedRole = selectedRole.backendRole || selectedRole.key
      if (user.role !== expectedRole) {
        setError(`This account is not registered as ${selectedRole.title}`)
        setLoading(false)
        return
      }
      navigate(selectedRole.dashboardPath || '/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] shadow-lg mb-4 sm:mb-5">
            <img src="/school logo.png" alt="Phronesis" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-[#1B5E20]">Academic Team Portal</h1>
          <p className="text-gray-500 text-sm sm:text-base mt-2">Select your role to sign in</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl">
          {roles.map((role) => (
            <button
              key={role.title}
              onClick={() => openModal(role)}
              className={`group relative overflow-hidden rounded-2xl border-2 ${role.border} ${role.bgLight} p-6 sm:p-8 text-center sm:text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-transparent`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className={`${role.textColor} group-hover:text-white transition-colors duration-300 mb-4 flex justify-center sm:justify-start`}>
                  {role.icon}
                </div>
                <h3 className={`text-lg sm:text-xl font-bold text-gray-800 group-hover:text-white transition-colors duration-300`}>{role.title}</h3>
                <p className={`text-xs sm:text-sm text-gray-500 group-hover:text-gray-200 transition-colors duration-300 mt-1.5`}>{role.description}</p>
              </div>
              <div className={`absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br ${role.gradient} opacity-10 rounded-tl-full group-hover:opacity-20 transition-opacity duration-300`} />
            </button>
          ))}
        </div>
      </div>

      {selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-[fadeIn_0.2s_ease-out]">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br ${selectedRole.gradient} mb-3`}>
                <div className="text-white">{selectedRole.icon}</div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{selectedRole.title}</h2>
              <p className="text-gray-500 text-xs sm:text-sm mt-1">Sign in to your account</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 rounded mb-4 text-xs sm:text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
                  placeholder="Enter username"
                  autoFocus
                />
              </div>
              <div className="relative">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm pr-10"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-gradient-to-r ${selectedRole.gradient} text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm sm:text-base hover:shadow-lg`}
              >
                {loading ? 'Signing in...' : `Sign in as ${selectedRole.title}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
