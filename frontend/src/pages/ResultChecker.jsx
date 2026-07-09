import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { resultAPI } from '../services/api'

const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    #result-sheet, #result-sheet * { visibility: visible; }
    #result-sheet {
      position: absolute;
      left: 0; top: 0;
      width: 100%;
      padding: 0;
      margin: 0;
      box-shadow: none;
      border: none;
    }
    .no-print { display: none !important; }
  }
  @page {
    size: A4 portrait;
    margin: 12mm;
  }
`

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
  const [loading, setLoading] = useState(false)
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
    setResult(null)
    setStudent(null)
    try {
      const res = await resultAPI.checkByRegNo({ regNo, sessionId, termId, pin })
      if (res.data.withheld) {
        setStudent(res.data.student)
        setModal({ show: true, type: 'withheld', title: 'Result Withheld', message: res.data.message })
      } else {
        setStudent(res.data.student)
        setResult(res.data.result)
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'An unexpected error occurred. Please try again.'
      const status = err.response?.status
      let title = 'Error'
      if (msg.includes('PIN') || msg.includes('expired') || msg.includes('Invalid or expired')) {
        title = 'PIN Error'
      } else if (msg.includes('Student not found') || msg.includes('exam number')) {
        title = 'Student Not Found'
      } else if (msg.includes('Result not found')) {
        title = 'Result Not Found'
      } else if (status === 400) {
        title = 'Invalid Input'
      }
      setModal({ show: true, type: 'error', title, message: msg })
    } finally {
      setLoading(false)
    }
  }

  const showForm = !loading && !result

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* FULL PAGE LOADER */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
          <div className="w-14 h-14 border-4 border-gray-200 border-t-[#1B5E20] rounded-full animate-spin mb-5"></div>
          <p className="text-gray-600 text-base font-medium">Checking your result...</p>
          <p className="text-gray-400 text-sm mt-1">Please wait a moment</p>
        </div>
      )}

      {/* ERROR / WITHHELD MODAL */}
      {modal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-100">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={modal.type === 'withheld' ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M6 18L18 6M6 6l12 12"} />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{modal.title}</h3>
            <p className="text-sm text-gray-600 mb-6">{modal.message}</p>
            <button onClick={() => setModal({ show: false, type: '', title: '', message: '' })}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition text-sm">
              {modal.type === 'withheld' ? 'Close' : 'Try Again'}
            </button>
          </div>
        </div>
      )}

      {/* FORM - only show when not loading and no result */}
      {showForm && (
        <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <img src="/school logo.png" alt="Phronesis" className="h-16 w-16 sm:h-20 sm:w-20 mx-auto rounded-full mb-3" />
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1B5E20]">Check Result</h1>
            <p className="text-gray-500 text-sm mt-1">Phronesis Int'l School - Result Portal</p>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Examination Number</label>
                <input type="text" required value={regNo}
                  onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
                  placeholder="e.g., PHS/00001" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Session</label>
                  <select required value={sessionId} onChange={(e) => setSessionId(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm">
                    <option value="">Select</option>
                    {sessions.map((s) => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
                  <select required value={termId} onChange={(e) => setTermId(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm">
                    <option value="">Select</option>
                    {terms.map((t) => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">PIN</label>
                <div className="relative">
                  <input type={showPin ? 'text' : 'password'} required maxLength={8} value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
                    placeholder="Enter your PIN" />
                  <button type="button" onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                    {showPin ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <button type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-[#1B5E20] font-bold py-3 rounded-lg transition text-base">
                Check Result
              </button>
            </form>
          </div>
          <div className="text-center mt-6 no-print">
            <Link to="/" className="inline-flex items-center gap-2 text-[#1B5E20] hover:text-yellow-600 font-medium transition text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Home
            </Link>
          </div>
        </div>
      )}

      {/* RESULT SHEET - A4 paper */}
      {result && student && (
        <div className="min-h-screen bg-gray-100 py-4 px-2 sm:py-8 sm:px-4 no-print-wrapper">
          <div className="max-w-[210mm] mx-auto">
            <div id="result-sheet"
              className="bg-white shadow-2xl mx-auto"
              style={{ width: '100%', maxWidth: '210mm', minHeight: '297mm', padding: '12mm 14mm' }}>

              {/* HEADER */}
              <div className="text-center border-b-2 border-[#1B5E20] pb-4 mb-5">
                <img src="/school logo.png" alt="Phronesis Int'l School" className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-2" />
                <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20] tracking-tight">PHRONESIS INT'L SCHOOL</h1>
                <p className="text-xs sm:text-sm text-gray-500 italic">...Building a legacy of excellence</p>
                <h2 className="text-sm sm:text-base font-bold text-gray-800 mt-2 uppercase tracking-wide">Student's Academic Report</h2>
              </div>

              {/* STUDENT INFO */}
              <div className="mb-5">
                <table className="w-full text-xs sm:text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 font-semibold text-gray-600 w-36">Name</td>
                      <td className="py-1.5 font-bold text-gray-900">{student.lastName} {student.firstName}</td>
                      <td className="py-1.5 font-semibold text-gray-600 w-36">Grand Total</td>
                      <td className="py-1.5 font-bold text-gray-900">{result.totalScore}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 font-semibold text-gray-600">Class</td>
                      <td className="py-1.5 font-bold text-gray-900">{result.class?.name}</td>
                      <td className="py-1.5 font-semibold text-gray-600">Average</td>
                      <td className="py-1.5 font-bold text-gray-900">{result.average ?? (result.details?.length ? Math.round(result.totalScore / result.details.length) : '-')}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 font-semibold text-gray-600">Session</td>
                      <td className="py-1.5 font-bold text-gray-900">{result.session?.name}</td>
                      <td className="py-1.5 font-semibold text-gray-600">Position</td>
                      <td className="py-1.5 font-bold text-gray-900">{result.position ? `${result.position}${getOrdinalSuffix(result.position)}` : '-'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1.5 font-semibold text-gray-600">Term</td>
                      <td className="py-1.5 font-bold text-gray-900">{result.term?.name}</td>
                      <td className="py-1.5 font-semibold text-gray-600">Exam No</td>
                      <td className="py-1.5 font-bold text-gray-900">{student.regNo}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SUBJECT RESULTS */}
              <h3 className="font-bold text-sm text-[#1B5E20] mb-2 border-b border-gray-200 pb-1">Subject Results</h3>
              <div className="overflow-x-auto mb-5">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1B5E20] text-white">
                      <th className="p-2 text-center font-semibold w-8">#</th>
                      <th className="p-2 text-left font-semibold">SUBJECT</th>
                      <th className="p-2 text-center font-semibold">CA1</th>
                      <th className="p-2 text-center font-semibold">CA2</th>
                      <th className="p-2 text-center font-semibold">EXAM</th>
                      <th className="p-2 text-center font-semibold">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.details || []).map((d, i) => (
                      <tr key={d._id || d.id || i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="p-2 text-center font-medium">{i + 1}</td>
                        <td className="p-2 font-medium">{d.subject?.name}</td>
                        <td className="p-2 text-center">{d.ca1}</td>
                        <td className="p-2 text-center">{d.ca2}</td>
                        <td className="p-2 text-center font-semibold">{d.exam}</td>
                        <td className={`p-2 text-center font-bold ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ATTENDANCE */}
              <div className="mb-5">
                <table className="w-full text-xs sm:text-sm">
                  <tbody>
                    <tr><td className="py-1 text-gray-600 w-48">No of times school opened:</td><td className="py-1 font-bold text-gray-900">{result.daysOpen ?? '-'}</td></tr>
                    <tr><td className="py-1 text-gray-600">No of days present:</td><td className="py-1 font-bold text-green-700">{result.daysPresent ?? '-'}</td></tr>
                    <tr><td className="py-1 text-gray-600">No of days absent:</td><td className="py-1 font-bold text-red-700">{result.daysAbsent ?? '-'}</td></tr>
                    <tr><td className="py-1 text-gray-600">Next resumption date:</td><td className="py-1 font-bold text-gray-900">{result.nextResumptionDate ? new Date(result.nextResumptionDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* REMARKS */}
              <div className="mb-5 space-y-3">
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-xs text-gray-500 mb-1 uppercase">Form Teacher's Remark</h4>
                  <p className="text-gray-900 text-xs sm:text-sm italic min-h-[1.5em]">{result.teacherComment || result.autoTeacherComment || '—'}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-xs text-gray-500 mb-1 uppercase">Principal's Remark</h4>
                  <p className="text-gray-900 text-xs sm:text-sm italic min-h-[1.5em]">{result.principalComment || result.autoPrincipalRemark || '—'}</p>
                </div>
              </div>

              {/* SCHOOL NOTE */}
              <div className="bg-[#1B5E20]/5 border border-[#1B5E20]/20 rounded-lg p-3 sm:p-4 mb-4">
                <p className="text-[11px] sm:text-xs text-gray-600 leading-relaxed text-center italic">
                  Thank you for trusting us with your ward's educational journey.
                </p>
              </div>

              {/* FOOTER */}
              <div className="text-center pt-3 border-t border-gray-200">
                <p className="text-[10px] text-gray-400 italic">
                  This result is computer-generated and does not require a signature. Phronesis Int'l School - Building a legacy of excellence.
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-5 text-center no-print">
              <button onClick={() => window.print()}
                className="bg-[#1B5E20] text-white px-8 py-2.5 rounded-lg font-medium hover:bg-[#2E7D32] transition text-sm mr-3">
                Download PDF
              </button>
              <button onClick={() => { setResult(null); setStudent(null); setPin(''); }}
                className="bg-white text-gray-600 border border-gray-300 px-8 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">
                Check Another
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
