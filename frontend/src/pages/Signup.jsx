import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { value: 'PARENT', label: 'Parent/Guardian', desc: 'View and manage your wards\' results' },
  { value: 'FORM_TEACHER', label: 'Form Teacher', desc: 'Manage class results and comments' },
  { value: 'EXAM_OFFICER', label: 'Exam Officer', desc: 'Full administrative access' }
]

export default function Signup() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'PARENT' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await register(form)
      const paths = { EXAM_OFFICER: '/dashboard/exam-officer', FORM_TEACHER: '/dashboard/form-teacher', PARENT: '/dashboard/parent' }
      navigate(paths[user.role])
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 py-6 sm:py-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <img src="/school logo.png" alt="Phronesis" className="h-14 w-14 sm:h-16 sm:w-16 mx-auto rounded-full" />
          <h2 className="text-xl sm:text-2xl font-bold text-[#1B5E20] mt-3 sm:mt-4">Create Account</h2>
          <p className="text-gray-500 text-xs sm:text-sm">Select your role and fill in your details</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 rounded mb-3 sm:mb-4 text-xs sm:text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">I am a</label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {ROLES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setForm({ ...form, role: r.value })}
                  className={`p-2 sm:p-3 rounded-lg border-2 text-center transition ${
                    form.role === r.value
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="font-semibold text-[10px] sm:text-xs">{r.label.split(' ')[0]}</div>
                  <div className="text-[8px] sm:text-[10px] mt-0.5 leading-tight">{r.label.split(' ').slice(1).join(' ')}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" placeholder="Min 6 characters" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm sm:text-base">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs sm:text-sm text-gray-500 mt-5 sm:mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-yellow-600 font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  )
}
