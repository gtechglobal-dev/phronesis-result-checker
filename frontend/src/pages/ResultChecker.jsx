import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { resultAPI } from '../services/api'

export default function ResultChecker() {
  const getOrdinalSuffix = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100
    return s[(v - 20) % 10] || s[v] || s[0]
  }

  const [regNo, setRegNo] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [termId, setTermId] = useState('')
  const [terms, setTerms] = useState([])
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [sessions, setSessions] = useState([])
  const [result, setResult] = useState(null)
  const [student, setStudent] = useState(null)
  const [withheld, setWithheld] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ show: false, type: '', title: '', message: '' })

  useEffect(() => {
    resultAPI.getPublishedSessions().then(res => { if (Array.isArray(res.data)) setSessions(res.data) }).catch(() => {})
  }, [])

  useEffect(() => {
    setTermId('')
    const s = sessions.find(s => (s._id || s.id) === sessionId)
    setTerms(s?.terms || [])
  }, [sessionId, sessions])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!regNo || !sessionId || !termId || !pin) {
      setModal({ show: true, type: 'error', title: 'Incomplete Fields', message: 'Please fill in all fields before checking your result.' })
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
        setModal({ show: true, type: 'withheld', title: 'Result Withheld', message: res.data.message })
      } else {
        setStudent(res.data.student)
        setResult(res.data.result)
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Result not found. Please check your details and try again.'
      setModal({ show: true, type: 'error', title: 'Result Not Found', message: msg })
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
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Examination Number</label>
            <input
              type="text"
              required
              value={regNo}
              onChange={(e) => setRegNo(e.target.value.toUpperCase())}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
              placeholder="e.g., PHS/00001"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Session</label>
              <select required value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm">
                <option value="">Select Session</option>
                {sessions.map((s) => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
              <select required value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm">
                <option value="">Select Term</option>
                {terms.map((t) => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">PIN</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                required
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
                placeholder="Enter your PIN"
              />
              <button type="button" onClick={() => setShowPin(!showPin)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showPin ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
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
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-[#1B5E20] font-bold py-2.5 sm:py-3 rounded-lg transition text-base sm:text-lg disabled:opacity-50">
            {loading ? 'Please Wait...' : 'Check Result'}
          </button>
        </form>

        {loading && (
          <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-gray-200 border-t-[#1B5E20] rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 text-sm">Checking your result, please wait...</p>
          </div>
        )}

        {modal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-[90%] max-w-sm mx-auto">
              {modal.type === 'withheld' ? (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-100">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{modal.title}</h3>
                  <p className="text-sm text-gray-600 mb-6">{modal.message} This may be due to unpaid fees. Please contact the school office for more information.</p>
                  <button onClick={() => setModal({ show: false, type: '', title: '', message: '' })}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition text-sm">
                    Close
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-100">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{modal.title}</h3>
                  <p className="text-sm text-gray-600 mb-6">{modal.message}</p>
                  <button onClick={() => setModal({ show: false, type: '', title: '', message: '' })}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition text-sm">
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {result && student && (
          <div className="mt-6 sm:mt-8 print-area" id="result-sheet">
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-8 print:shadow-none print:p-4 print:rounded-none">
              <div className="text-center border-b-2 border-[#1B5E20] pb-4 mb-6 print:pb-3 print:mb-4">
                <img src="/school logo.png" alt="Phronesis Int'l School" className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-3 print:h-16 print:w-16" />
                <h1 className="text-2xl sm:text-3xl font-bold text-[#1B5E20] tracking-tight">PHRONESIS INT'L SCHOOL</h1>
                <p className="text-sm text-gray-500 mt-1">...Building a legacy of excellence</p>
                <h2 className="text-lg sm:text-xl font-bold text-[#1B5E20] mt-2 uppercase tracking-wide">Result Sheet</h2>
              </div>

              <div className="mb-6 print:mb-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="py-1 font-semibold text-gray-700 w-40">Student Name:</td><td className="py-1 font-bold text-gray-900">{student.lastName} {student.firstName}</td></tr>
                    <tr><td className="py-1 font-semibold text-gray-700">Exam No:</td><td className="py-1 font-bold text-gray-900">{student.regNo}</td></tr>
                    <tr><td className="py-1 font-semibold text-gray-700">Class:</td><td className="py-1 font-bold text-gray-900">{result.class.name}</td></tr>
                    <tr><td className="py-1 font-semibold text-gray-700">Term:</td><td className="py-1 font-bold text-gray-900">{result.session.name} - {result.term.name}</td></tr>
                    <tr><td className="py-1 font-semibold text-gray-700">Position:</td><td className="py-1 font-bold text-gray-900">{result.position || '-'}{result.position ? getOrdinalSuffix(result.position) : ''}</td></tr>
                    <tr><td className="py-1 font-semibold text-gray-700">Total Score:</td><td className="py-1 font-bold text-gray-900">{result.totalScore}</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-3 border-b border-gray-200 pb-2">RESULTS</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1B5E20] text-white">
                      <th className="p-2 sm:p-3 text-center font-semibold w-10">S/N</th>
                      <th className="p-2 sm:p-3 text-left font-semibold">SUBJECT</th>
                      <th className="p-2 sm:p-3 text-center font-semibold">CA1 (20)</th>
                      <th className="p-2 sm:p-3 text-center font-semibold">CA2 (20)</th>
                      <th className="p-2 sm:p-3 text-center font-semibold">EXAM (60)</th>
                      <th className="p-2 sm:p-3 text-center font-semibold">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details.map((d, i) => (
                      <tr key={d.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                        <td className="p-2 sm:p-3 text-center font-medium">{i + 1}</td>
                        <td className="p-2 sm:p-3 font-medium">{d.subject.name}</td>
                        <td className="p-2 sm:p-3 text-center">{d.ca1}</td>
                        <td className="p-2 sm:p-3 text-center">{d.ca2}</td>
                        <td className="p-2 sm:p-3 text-center font-semibold">{d.exam}</td>
                        <td className={`p-2 sm:p-3 text-center font-bold ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mb-6 print:mb-4">
                <h4 className="font-bold text-sm text-[#1B5E20] mb-2">ATTENDANCE</h4>
                <table className="w-full text-xs sm:text-sm">
                  <tbody>
                    <tr><td className="py-1 text-gray-700 w-48">Number of Times School Opened:</td><td className="py-1 font-bold">{result.daysOpen ?? '-'}</td></tr>
                    <tr><td className="py-1 text-gray-700">Number of Times Present:</td><td className="py-1 font-bold text-green-700">{result.daysPresent ?? '-'}</td></tr>
                    <tr><td className="py-1 text-gray-700">Number of Times Absent:</td><td className="py-1 font-bold text-red-700">{result.daysAbsent ?? '-'}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-4 mb-6 print:mb-4">
                {result.teacherComment && (
                  <div className="p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-sm text-[#1B5E20] mb-1">Form Teacher's Remark</h4>
                    <p className="text-gray-700 text-sm">{result.teacherComment}</p>
                  </div>
                )}
                {result.principalComment && (
                  <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-sm text-[#1B5E20] mb-1">Principal's Remark</h4>
                    <p className="text-gray-700 text-sm">{result.principalComment}</p>
                  </div>
                )}
                {result.nextResumptionDate && (
                  <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-sm text-[#1B5E20] mb-1">Next Resumption Date</h4>
                    <p className="text-gray-700 text-sm font-bold">{new Date(result.nextResumptionDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                )}
              </div>

              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-[10px] sm:text-xs text-gray-400 italic">
                  This result is computer-generated and does not require a signature. Phronesis Int'l School - Building a legacy of excellence.
                </p>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 text-center print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-[#1B5E20] text-white px-8 py-2.5 rounded-lg font-medium hover:bg-[#2E7D32] transition text-sm sm:text-base mr-3"
              >
                Download PDF
              </button>
              <button
                onClick={() => { setResult(null); setStudent(null); }}
                className="bg-gray-100 text-gray-600 px-8 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition text-sm sm:text-base"
              >
                Check Another
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
