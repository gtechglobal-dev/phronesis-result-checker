import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { resultAPI, classAPI } from '../services/api'

export default function ResultChecker() {
  const [regNo, setRegNo] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [termId, setTermId] = useState('')
  const [pin, setPin] = useState('')
  const [sessions, setSessions] = useState([])
  const [result, setResult] = useState(null)
  const [student, setStudent] = useState(null)
  const [withheld, setWithheld] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    classAPI.getSessions().then(res => setSessions(res.data)).catch(() => {})
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!regNo || !sessionId || !termId || !pin) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    setStudent(null)
    setWithheld(false)
    try {
      const res = await resultAPI.checkByRegNo({ regNo, sessionId, termId, pin })
      if (res.data.withheld) {
        setStudent(res.data.student)
        setWithheld(true)
        setError(res.data.message)
      } else {
        setStudent(res.data.student)
        setResult(res.data.result)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Result not found')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-6 sm:mb-10">
        <img src="/school logo.png" alt="Phronesis" className="h-16 w-16 sm:h-20 sm:w-20 mx-auto rounded-full mb-3 sm:mb-4" />
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1B5E20]">Check Result</h1>
        <p className="text-gray-500 text-sm sm:text-base mt-1 sm:mt-2">Phronesis Int'l School - Result Portal</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8">
        <form onSubmit={handleSearch} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Reg. No.</label>
            <input
              type="text"
              required
              value={regNo}
              onChange={(e) => setRegNo(e.target.value.toUpperCase())}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
              placeholder="e.g., PHS/2025/001"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Year</label>
              <select required value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm">
                <option value="">Select Year</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
              <select required value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm">
                <option value="">Select Term</option>
                {sessions.filter(s => sessionId === s.id).flatMap(s => s.terms).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">PIN</label>
            <input
              type="password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
              placeholder="Enter your PIN"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-[#1B5E20] font-bold py-2.5 sm:py-3 rounded-lg transition text-base sm:text-lg disabled:opacity-50">
            {loading ? 'Searching...' : 'Check Result'}
          </button>
        </form>

        {error && !withheld && <div className="mt-4 sm:mt-6 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded text-center text-sm">{error}</div>}
        {withheld && (
          <div className="mt-4 sm:mt-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 sm:px-4 py-2.5 sm:py-3 rounded text-center text-sm">
            {error}
          </div>
        )}

        {result && student && (
          <div className="mt-6 sm:mt-8">
            <div className="bg-[#1B5E20] text-white p-4 sm:p-6 rounded-t-xl">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">{student.firstName} {student.lastName}</h2>
                <p className="text-yellow-400 text-xs sm:text-sm mt-1">{result.class.name} - {result.session.name} ({result.term.name})</p>
                <p className="text-gray-300 text-xs mt-0.5">Reg No: {student.regNo} | Arm: {student.arm}</p>
              </div>
            </div>

            <div className="border-x border-b rounded-b-xl overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Subject</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">CA1</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">CA2</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Exam</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Total</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Grade</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {result.details.map((d) => (
                    <tr key={d.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{d.subject.name}</td>
                      <td className="p-2 sm:p-3 text-center whitespace-nowrap">{d.ca1}</td>
                      <td className="p-2 sm:p-3 text-center whitespace-nowrap">{d.ca2}</td>
                      <td className="p-2 sm:p-3 text-center whitespace-nowrap">{d.exam}</td>
                      <td className="p-2 sm:p-3 text-center font-bold whitespace-nowrap">{d.total}</td>
                      <td className="p-2 sm:p-3 text-center whitespace-nowrap">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${
                          d.grade === 'A' ? 'bg-green-100 text-green-700' :
                          d.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                          d.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                          d.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>{d.grade}</span>
                      </td>
                      <td className="p-2 sm:p-3 text-center text-[10px] sm:text-xs whitespace-nowrap">{d.remark}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <td className="p-2 sm:p-3 text-xs sm:text-sm" colSpan="4">Total: {result.totalScore} | Avg: {result.average}</td>
                    <td className="p-2 sm:p-3 text-center text-xs sm:text-sm" colSpan="3">Pos: {result.position || '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {result.teacherComment && (
              <div className="mt-4 p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-sm sm:text-base text-[#1B5E20]">Teacher's Comment</h4>
                <p className="text-gray-700 mt-1 text-xs sm:text-sm">{result.teacherComment}</p>
              </div>
            )}

            <div className="mt-4 sm:mt-6 text-center">
              <button
                onClick={() => window.print()}
                className="bg-[#1B5E20] text-white px-6 sm:px-8 py-2 sm:py-2.5 rounded-lg font-medium hover:bg-[#2E7D32] transition text-sm sm:text-base"
              >
                Print Result
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-center mt-6">
        <Link to="/" className="inline-flex items-center gap-2 text-[#1B5E20] hover:text-yellow-600 font-medium transition text-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  )
}
