import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { classAPI, studentAPI } from '../services/api'

export default function Signup() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', studentIds: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [unlinkedStudents, setUnlinkedStudents] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])

  useEffect(() => {
    classAPI.getAll().then(res => setClasses(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedClass || searchTerm) {
      studentAPI.getUnlinked({ classId: selectedClass || undefined, search: searchTerm || undefined })
        .then(res => setUnlinkedStudents(res.data))
        .catch(() => setUnlinkedStudents([]))
    } else {
      setUnlinkedStudents([])
    }
  }, [selectedClass, searchTerm])

  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await register({ ...form, studentIds: selectedStudents })
      navigate('/dashboard/parent')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 py-6 sm:py-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-lg">
        <div className="text-center mb-6 sm:mb-8">
          <img src="/school logo.png" alt="Phronesis" className="h-14 w-14 sm:h-16 sm:w-16 mx-auto rounded-full" />
          <h2 className="text-xl sm:text-2xl font-bold text-[#1B5E20] mt-3 sm:mt-4">Parent/Guardian Registration</h2>
          <p className="text-gray-500 text-xs sm:text-sm">Link your ward(s) to access their results</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 rounded mb-3 sm:mb-4 text-xs sm:text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" />
            <p className="text-[10px] text-gray-400 mt-1">Provide email or phone (at least one required)</p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm" placeholder="Min 6 characters" />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm sm:text-base text-[#1B5E20] mb-3">Link Your Ward(s)</h3>
            <div className="flex gap-2 mb-3">
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
                className="w-1/2 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">All Classes</option>
                {classes.map((c) => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
              </select>
              <input type="text" placeholder="Search student name..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-1/2 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
            </div>
            {selectedStudents.length > 0 && (
              <div className="mb-2 text-xs sm:text-sm text-[#1B5E20] font-medium">{selectedStudents.length} student(s) selected</div>
            )}
            <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-lg p-2">
              {unlinkedStudents.length === 0 && searchTerm === '' && !selectedClass && (
                <p className="text-gray-400 text-xs p-3 text-center">Select a class or search to find students</p>
              )}
              {unlinkedStudents.length === 0 && (searchTerm || selectedClass) && (
                <p className="text-gray-400 text-xs p-3 text-center">No students found</p>
              )}
              {unlinkedStudents.map((s) => (
                <label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition text-xs sm:text-sm ${
                  selectedStudents.includes(s.id) ? 'bg-[#1B5E20] text-white' : 'bg-gray-50 hover:bg-gray-100'
                }`}>
                  <input type="checkbox" checked={selectedStudents.includes(s.id)}
                    onChange={() => toggleStudent(s.id)} className="accent-yellow-500" />
                  <span className="font-medium">{s.firstName} {s.lastName}</span>
                  <span className="text-gray-400 ml-auto">({s.class?.name})</span>
                </label>
              ))}
            </div>
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
