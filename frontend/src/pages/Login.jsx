import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      const paths = { EXAM_OFFICER: '/dashboard/exam-officer', FORM_TEACHER: '/dashboard/form-teacher', PARENT: '/dashboard/parent' }
      navigate(paths[user.role])
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 py-6 sm:py-10">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <img src="/school logo.png" alt="Phronesis" className="h-14 w-14 sm:h-16 sm:w-16 mx-auto rounded-full" />
          <h2 className="text-xl sm:text-2xl font-bold text-[#1B5E20] mt-3 sm:mt-4">Welcome Back</h2>
          <p className="text-gray-500 text-xs sm:text-sm">Sign in to your account</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 rounded mb-3 sm:mb-4 text-xs sm:text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email, Phone, or Username</label>
            <input
              type="text"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
              placeholder="Min 6 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm sm:text-base"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs sm:text-sm text-gray-500 mt-5 sm:mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-yellow-600 font-medium hover:underline">Sign Up</Link>
        </p>
      </div>
    </div>
  )
}
