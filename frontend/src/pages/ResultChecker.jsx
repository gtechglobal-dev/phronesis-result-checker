import { useState, useEffect, useRef } from 'react'
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
      border-radius: 0;
    }
    .no-print { display: none !important; }
    .no-print-wrapper { background: white !important; padding: 0 !important; }
    #result-sheet::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url('/school logo.png');
      background-repeat: repeat;
      background-size: 80px;
      opacity: 0.06;
      pointer-events: none;
      z-index: 0;
    }
    #result-sheet > * { position: relative; z-index: 1; }
  }
`

const WATERMARK_STYLES = `
  #result-sheet {
    position: relative;
    overflow: hidden;
  }
  #result-sheet::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url('/school logo.png');
    background-repeat: repeat;
    background-size: 80px;
    opacity: 0.05;
    pointer-events: none;
    z-index: 0;
  }
  #result-sheet > * { position: relative; z-index: 1; }
`

export default function ResultChecker() {
  const getOrdinalSuffix = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100
    return s[(v - 20) % 10] || s[v] || s[0]
  }

  const [regNo, setRegNo] = useState('')
  const [examDigits, setExamDigits] = useState('')
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

  const initialLoad = useRef(true)

  useEffect(() => {
    resultAPI.getPublishedSessions().then(res => {
      if (Array.isArray(res.data)) {
        setSessions(res.data)
        const current = res.data.find(s => s.isCurrent) || res.data[0]
        if (current) {
          setSessionId(current._id || current.id)
          const ct = current.terms.find(t => t.isCurrent) || current.terms[0]
          if (ct) setTermId(ct._id || ct.id)
        }
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!sessionId && sessions.length) {
      const current = sessions.find(s => s.isCurrent) || sessions[0]
      if (current) setSessionId(current._id || current.id)
    }
  }, [sessions])

  useEffect(() => {
    if (!initialLoad.current) setTermId('')
    initialLoad.current = false
    const s = sessions.find(s => (s._id || s.id) === sessionId)
    setTerms(s?.terms || [])
  }, [sessionId, sessions])

  const handleSearch = async (e) => {
    e.preventDefault()
    const fullRegNo = examDigits ? `PHS/${examDigits}` : ''
    if (!fullRegNo || !sessionId || !termId || !pin) {
      setModal({ show: true, type: 'error', title: 'Incomplete Fields', message: 'Please fill in all fields before checking your result.' })
      return
    }
    setLoading(true)
    setResult(null)
    setStudent(null)
    try {
      const res = await resultAPI.checkByRegNo({ regNo: fullRegNo, sessionId, termId, pin })
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
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm font-mono select-none">
                    PHS/
                  </span>
                  <input type="text" required maxLength={10} value={examDigits}
                    onChange={(e) => setExamDigits(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent outline-none text-sm"
                    placeholder="e.g., 00001" />
                </div>
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

      {/* RESULT SHEET */}
      {result && student && (
        <div className="min-h-screen bg-gray-100 py-3 px-3 sm:py-8 sm:px-4 no-print-wrapper">
          <div className="max-w-[210mm] mx-auto">
            <div id="result-sheet"
              className="bg-white shadow-xl mx-auto rounded-none sm:rounded-2xl p-4 sm:p-8 md:p-10 lg:p-12"
              style={{ width: '100%', maxWidth: '210mm' }}>
              <style>{WATERMARK_STYLES}</style>

              {/* HEADER */}
              <div className="text-center border-b-2 border-[#1B5E20] pb-3 mb-4">
                <img src="/school logo.png" alt="Phronesis Int'l School" className="h-14 w-14 sm:h-20 sm:w-20 mx-auto mb-2" />
                <h1 className="text-lg sm:text-2xl font-bold text-[#1B5E20] tracking-tight">PHRONESIS INT'L SCHOOL</h1>
                <p className="text-[11px] sm:text-sm text-gray-500 italic">...Divine wisdom for excellence</p>
                <h2 className="text-sm sm:text-base font-bold text-gray-800 mt-2 uppercase tracking-wide">Student's Academic Report</h2>
              </div>

              {/* STUDENT INFO - letter style */}
              <div className="bg-[#1B5E20]/5 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#1B5E20]/10">
                  <div className="w-10 h-10 rounded-full bg-[#1B5E20] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {student.firstName?.[0]}{student.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">{student.lastName} {student.firstName}</h3>
                    <p className="text-xs text-gray-500">Exam No: {student.regNo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-500">Class:</span>
                    <p className="font-semibold text-gray-900">{result.class?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Term:</span>
                    <p className="font-semibold text-gray-900">{result.term?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Session:</span>
                    <p className="font-semibold text-gray-900">{result.session?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Grand Total:</span>
                    <p className="font-semibold text-gray-900">{result.totalScore}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Average:</span>
                    <p className="font-semibold text-gray-900">{result.average ?? (result.details?.length ? Math.round(result.totalScore / result.details.length) : '-')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Position:</span>
                    <p className="font-semibold text-gray-900">{result.position ? `${result.position}${getOrdinalSuffix(result.position)}` : '-'}</p>
                  </div>
                </div>
              </div>

              {/* SUBJECT RESULTS */}
              <h3 className="font-bold text-sm text-[#1B5E20] mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-[#1B5E20] rounded-full inline-block"></span>
                Subject Results
              </h3>
              <div className="overflow-x-auto mb-5 rounded-lg border border-gray-200">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1B5E20] text-white">
                      <th className="p-2 text-center font-semibold w-7">#</th>
                      <th className="p-2 text-left font-semibold">SUBJECT</th>
                      <th className="p-2 text-center font-semibold hidden sm:table-cell">CA1</th>
                      <th className="p-2 text-center font-semibold hidden sm:table-cell">CA2</th>
                      <th className="p-2 text-center font-semibold">EXAM</th>
                      <th className="p-2 text-center font-semibold">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.details || []).map((d, i) => (
                      <tr key={d._id || d.id || i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="p-2 text-center font-medium text-gray-400">{i + 1}</td>
                        <td className="p-2 font-medium">{d.subject?.name}</td>
                        <td className="p-2 text-center hidden sm:table-cell text-gray-600">{d.ca1}</td>
                        <td className="p-2 text-center hidden sm:table-cell text-gray-600">{d.ca2}</td>
                        <td className="p-2 text-center font-semibold">{d.exam}</td>
                        <td className={`p-2 text-center font-bold ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ATTENDANCE + SUMMARY ROW */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-[18px] font-bold text-gray-900">{result.daysOpen ?? '-'}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">No of times school Opened</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-[18px] font-bold text-green-700">{result.daysPresent ?? '-'}</p>
                  <p className="text-[10px] text-green-600 uppercase tracking-wide">No of Times Present</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-[18px] font-bold text-red-700">{result.daysAbsent ?? '-'}</p>
                  <p className="text-[10px] text-red-600 uppercase tracking-wide">No of Times Absent</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-[#1B5E20]/5 rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Resumption Date</p>
                  <p className="text-[18px] font-bold text-gray-900">{result.nextResumptionDate ? new Date(result.nextResumptionDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
                </div>
              </div>

              {/* REMARKS */}
              <div className="mb-5 space-y-3">
                <div className="border-l-4 border-[#1B5E20] bg-[#1B5E20]/5 rounded-r-lg p-3">
                  <h4 className="font-semibold text-xs text-gray-500 mb-1 uppercase tracking-wide">Form Teacher's Remark</h4>
                  <p className="text-gray-900 text-xs sm:text-sm italic">{result.teacherComment || result.autoTeacherComment || '—'}</p>
                </div>
                <div className="border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg p-3">
                  <h4 className="font-semibold text-xs text-gray-500 mb-1 uppercase tracking-wide">Principal's Remark</h4>
                  <p className="text-gray-900 text-xs sm:text-sm italic">{result.principalComment || result.autoPrincipalRemark || '—'}</p>
                </div>
              </div>

              {/* SCHOOL NOTE */}
              <div className="text-center border-t border-gray-200 pt-4 mb-2">
                <p className="text-[11px] sm:text-xs text-gray-500 italic leading-relaxed">
                  Thank you for trusting us with your ward's educational journey.
                </p>
              </div>

            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-4 pb-6 text-center no-print flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => window.print()}
                className="w-full sm:w-auto bg-[#1B5E20] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#2E7D32] transition text-sm shadow-md shadow-[#1B5E20]/20">
                Download PDF
              </button>
              <button onClick={() => { setResult(null); setStudent(null); setPin(''); }}
                className="w-full sm:w-auto bg-white text-gray-600 border border-gray-300 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 transition text-sm">
                Check Another Result
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
