import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const dashboardPath = user?.role === 'EXAM_OFFICER'
    ? '/dashboard/exam-officer'
    : user?.role === 'FORM_TEACHER'
    ? '/dashboard/form-teacher'
    : user?.role === 'SUBJECT_TEACHER'
    ? '/dashboard/subject-teacher'
    : '/dashboard/parent'

  const roleLabel = user?.role.replace('_', ' ')

  const navLinks = user
    ? [
        { label: 'Dashboard', to: dashboardPath },
        { label: 'Check Result', to: '/check-result' },
        { label: `${user.firstName} (${roleLabel})`, to: '#', className: 'text-yellow-400' },
        { label: 'Logout', to: '#', onClick: handleLogout, className: 'bg-yellow-600 hover:bg-yellow-700 px-4 py-1.5 rounded' }
      ]
    : [
        { label: 'Check Result', to: '/check-result' },
        { label: 'Academic Team', to: '/login', className: 'bg-yellow-600 hover:bg-yellow-700 px-4 py-1.5 rounded' }
      ]

  return (
    <nav className="bg-[#1B5E20] text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center space-x-3 shrink-0" onClick={() => setMenuOpen(false)}>
            <img src="/school logo.png" alt="Phronesis" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover" />
            <span className="font-bold text-sm sm:text-lg truncate max-w-[180px] sm:max-w-none">Phronesis Int'l School</span>
          </Link>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-[#2E7D32] transition"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link, i) => (
              link.onClick ? (
                <button key={i} onClick={link.onClick} className={`text-sm font-medium transition ${link.className || 'hover:text-yellow-400'}`}>
                  {link.label}
                </button>
              ) : (
                <Link key={i} to={link.to} className={`text-sm font-medium transition ${link.className || 'hover:text-yellow-400'}`}>
                  {link.label}
                </Link>
              )
            ))}
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-[#2E7D32] pt-3">
            {navLinks.map((link, i) => (
              link.onClick ? (
                <button
                  key={i}
                  onClick={() => { link.onClick(); setMenuOpen(false) }}
                  className={`block w-full text-left px-3 py-2 rounded text-sm font-medium transition ${link.className || 'hover:bg-[#2E7D32]'}`}
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={i}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2 rounded text-sm font-medium transition ${link.className || 'hover:bg-[#2E7D32]'}`}
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
