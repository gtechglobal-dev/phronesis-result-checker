import { useState, useEffect, useRef, Fragment } from 'react'
import { classAPI, studentAPI, formTeacherAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function FormTeacherDashboard() {
  const { user } = useAuth()
  const [myClass, setMyClass] = useState(null)
  const [broadsheet, setBroadsheet] = useState(null)
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(true)
  const [savingComment, setSavingComment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('broadsheet')
  const broadsheetRef = useRef(null)

  const [studentForm, setStudentForm] = useState({ regNo: '', firstName: '', lastName: '', arm: 'A' })
  const [studentLoading, setStudentLoading] = useState(false)
  const [examNumbers, setExamNumbers] = useState([])

  const [daysOpen, setDaysOpen] = useState('')
  const [nextResDate, setNextResDate] = useState('')
  const [attendanceData, setAttendanceData] = useState({})
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const tabs = [
    { id: 'broadsheet', label: 'Broadsheet' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'students', label: 'Students' },
    { id: 'submit', label: 'Submit' }
  ]

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 4000)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [assignRes, sessRes] = await Promise.all([
          classAPI.getMyAssignment(),
          classAPI.getSessions()
        ])
        if (assignRes.data.class) setMyClass(assignRes.data.class)
        setSessions(sessRes.data)
        if (sessRes.data.length) {
          const curr = sessRes.data.find(s => s.isCurrent) || sessRes.data[0]
          setSelectedSession(curr.id)
          if (curr.terms?.length) {
            setSelectedTerm(curr.terms.find(t => t.isCurrent)?.id || curr.terms[0].id)
          }
        }
      } catch { showMessage('error', 'Failed to load data') }
      finally { setLoading(false) }
    }
    init()
  }, [])

  useEffect(() => {
    if (myClass && selectedSession && selectedTerm) loadBroadsheet()
  }, [myClass, selectedSession, selectedTerm])

  const loadBroadsheet = async () => {
    try {
      setLoading(true)
      const res = await formTeacherAPI.getBroadsheet({ sessionId: selectedSession, termId: selectedTerm })
      setBroadsheet(res.data)
      setDaysOpen(res.data.daysOpen != null ? String(res.data.daysOpen) : '')
      setNextResDate(res.data.nextResumptionDate || '')
      const att = {}
      res.data.students.forEach(s => {
        att[s.student.id] = {
          present: s.daysPresent != null ? String(s.daysPresent) : '',
          absent: s.daysAbsent != null ? String(s.daysAbsent) : ''
        }
      })
      setAttendanceData(att)
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Failed to load broadsheet')
    } finally { setLoading(false) }
  }

  const loadSessions = async () => {
    try { const res = await classAPI.getSessions(); setSessions(res.data) } catch {}
  }

  const generateExamNumbers = async () => {
    if (!myClass) return
    const count = parseInt(prompt('How many exam numbers to generate?', '10'))
    if (!count || count < 1) return
    try {
      const res = await studentAPI.generateExamNumbers({ classId: myClass.id, count })
      setExamNumbers(res.data.numbers || [])
      showMessage('success', `${res.data.numbers.length} exam numbers generated`)
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error generating numbers')
    }
  }

  const useExamNumber = (num) => {
    setStudentForm(prev => ({ ...prev, regNo: num }))
    setExamNumbers(prev => prev.filter(n => n !== num))
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault()
    if (!myClass) return
    setStudentLoading(true)
    try {
      await studentAPI.create({ ...studentForm, classId: myClass.id })
      showMessage('success', 'Student created')
      setStudentForm({ regNo: '', firstName: '', lastName: '', arm: 'A' })
      loadBroadsheet()
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error creating student')
    } finally { setStudentLoading(false) }
  }

  const handleSaveComment = async (resultId, comment) => {
    if (!resultId) return
    setSavingComment(true)
    try {
      await formTeacherAPI.updateComment({ resultId, teacherComment: comment })
    } catch {} finally { setSavingComment(false) }
  }

  const handleSaveSettings = async () => {
    if (!selectedTerm) return
    setSavingSettings(true)
    try {
      await formTeacherAPI.updateSettings({ termId: selectedTerm, daysOpen, nextResumptionDate: nextResDate })
      showMessage('success', 'Settings saved')
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error saving settings')
    } finally { setSavingSettings(false) }
  }

  const handleSaveAttendance = async () => {
    const records = broadsheet.students.map(s => ({
      resultId: s.resultId,
      daysPresent: attendanceData[s.student.id]?.present || null,
      daysAbsent: attendanceData[s.student.id]?.absent || null
    })).filter(r => r.resultId)
    if (!records.length) {
      showMessage('error', 'No results found. Save scores first.')
      return
    }
    setSavingAttendance(true)
    try {
      await formTeacherAPI.updateAttendance({ records })
      showMessage('success', 'Attendance saved')
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error saving attendance')
    } finally { setSavingAttendance(false) }
  }

  const handleSubmit = async () => {
    if (!window.confirm('Submit broadsheet to exam officer? This will lock all scores.')) return
    setSubmitting(true)
    try {
      await formTeacherAPI.submitBroadsheet({ sessionId: selectedSession, termId: selectedTerm })
      showMessage('success', 'Broadsheet submitted to exam officer')
      loadBroadsheet()
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error submitting')
    } finally { setSubmitting(false) }
  }

  const getGrade = (score) => {
    if (score >= 80) return { grade: 'A', color: 'text-green-700 bg-green-100' }
    if (score >= 70) return { grade: 'B', color: 'text-blue-700 bg-blue-100' }
    if (score >= 60) return { grade: 'C', color: 'text-yellow-700 bg-yellow-100' }
    if (score >= 50) return { grade: 'D', color: 'text-orange-700 bg-orange-100' }
    if (score >= 40) return { grade: 'E', color: 'text-red-700 bg-red-100' }
    return { grade: 'F', color: 'text-red-800 bg-red-200' }
  }

  const generateComment = (total, subjectCount) => {
    if (!subjectCount) return ''
    const avg = total / subjectCount
    if (avg >= 80) return 'Excellent performance. Keep it up!'
    if (avg >= 70) return 'Very good performance. Can do even better.'
    if (avg >= 60) return 'Good performance. Room for improvement.'
    if (avg >= 50) return 'Fair performance. Needs more effort.'
    if (avg >= 40) return 'Poor performance. Must work harder.'
    return 'Unsatisfactory. Urgent improvement needed.'
  }

  const printBroadsheet = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const rows = broadsheet?.students || []
    const subjects = broadsheet?.subjects || []

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Broadsheet - ${broadsheet?.class?.name || ''}</title>
      <style>
        @page { size: landscape; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header img { height: 60px; }
        .header h1 { margin: 5px 0; font-size: 18px; color: #1B5E20; }
        .header h2 { margin: 3px 0; font-size: 14px; color: #333; }
        table { width: 100%; border-collapse: collapse; font-size: 8px; }
        th, td { border: 1px solid #333; padding: 3px 4px; text-align: center; }
        th { background: #1B5E20; color: white; font-weight: bold; font-size: 7px; }
        td.name { text-align: left; font-weight: bold; }
        .total { font-weight: bold; }
        .footer { margin-top: 10px; font-size: 8px; text-align: center; color: #666; }
      </style>
    </head><body>
      <div class="header">
        <img src="/school logo.png" alt="Logo" />
        <h1>Phronesis Int'l School</h1>
        <h2>${broadsheet?.class?.name || ''} - ${sessions.find(s => s.id === selectedSession)?.name || ''} (${sessions.filter(s => s.id === selectedSession).flatMap(s => s.terms || []).find(t => t.id === selectedTerm)?.name || ''})</h2>
        <h2>RESULT BROADSHEET</h2>
      </div>
      <table>
        <thead><tr>
          <th>S/N</th><th>Reg No</th><th>Student Name</th>
          ${subjects.map(s => `<th colspan="4">${s.name}</th>`).join('')}
          <th>Total</th><th>Avg</th><th>Pos</th><th>Comment</th>
        </tr><tr>
          <th colspan="3"></th>
          ${subjects.map(() => '<th>CA1</th><th>CA2</th><th>Exam</th><th>Tot</th>').join('')}
          <th colspan="4"></th>
        </tr></thead>
        <tbody>
          ${rows.map((row, i) => `<tr>
            <td>${i + 1}</td>
            <td>${row.student.regNo}</td>
            <td class="name">${row.student.lastName} ${row.student.firstName}</td>
            ${subjects.map(s => {
              const d = row.details[s.id]
              return d ? `<td>${d.ca1}</td><td>${d.ca2}</td><td>${d.exam}</td><td class="total">${d.total}</td>`
                : '<td>-</td><td>-</td><td>-</td><td>-</td>'
            }).join('')}
            <td class="total">${row.totalScore}</td>
            <td>${row.average}</td>
            <td>${row.position || '-'}</td>
            <td style="font-size:7px;text-align:left">${row.teacherComment || generateComment(row.totalScore, row.subjectCount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">Generated on ${new Date().toLocaleDateString()} - Phronesis Int'l School Result Management System</div>
    </body></html>`)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  if (loading && !broadsheet) {
    return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1B5E20]" /></div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">Form Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {myClass ? <span className="text-yellow-600 font-medium">Class: {myClass.name}</span> : 'Loading class...'}
        </p>
      </div>

      {message.text && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex justify-between items-center ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-2 font-bold text-lg">&times;</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.id ? 'bg-[#1B5E20] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
          <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
            {sessions.filter(s => s.id === selectedSession).flatMap(s => s.terms || []).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === 'broadsheet' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6" ref={broadsheetRef}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-[#1B5E20]">Result Broadsheet</h3>
            <div className="flex gap-2">
              <button onClick={loadBroadsheet} className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium transition">Refresh</button>
              <button onClick={printBroadsheet}
                className="bg-[#1B5E20] text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-[#2E7D32] transition">Print</button>
            </div>
          </div>

          {broadsheet ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#1B5E20] text-white">
                    <th className="p-2 text-center font-medium text-[10px] sticky left-0 bg-[#1B5E20] z-10" rowSpan="2">S/N</th>
                    <th className="p-2 text-center font-medium text-[10px]" rowSpan="2">Reg No</th>
                    <th className="p-2 text-left font-medium text-[10px] sticky left-[40px] bg-[#1B5E20] z-10" rowSpan="2">Student Name</th>
                    {broadsheet.subjects.map(s => (
                      <th key={s.id} className="p-1 text-center font-medium text-[10px]" colSpan="4">{s.name}</th>
                    ))}
                    <th className="p-2 text-center font-medium text-[10px]" rowSpan="2">Total</th>
                    <th className="p-2 text-center font-medium text-[10px]" rowSpan="2">Avg</th>
                    <th className="p-2 text-center font-medium text-[10px]" rowSpan="2">Pos</th>
                    <th className="p-2 text-center font-medium text-[10px]" rowSpan="2">Comment</th>
                  </tr>
                  <tr className="bg-[#2E7D32] text-white">
                    <th className="p-1" colSpan="3"></th>
                    {broadsheet.subjects.map(s => (
                      <Fragment key={s.id}>
                        <th className="p-1 text-center font-medium text-[9px]">CA1</th>
                        <th className="p-1 text-center font-medium text-[9px]">CA2</th>
                        <th className="p-1 text-center font-medium text-[9px]">Exam</th>
                        <th className="p-1 text-center font-medium text-[9px]">Tot</th>
                      </Fragment>
                    ))}
                    <th className="p-1" colSpan="4"></th>
                  </tr>
                </thead>
                <tbody>
                  {broadsheet.students.map((row, i) => (
                    <tr key={row.student.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                      <td className="p-2 text-center font-bold sticky left-0 bg-inherit z-10">{i + 1}</td>
                      <td className="p-2 text-center text-[10px]">{row.student.regNo}</td>
                      <td className="p-2 font-medium whitespace-nowrap sticky left-[40px] bg-inherit z-10">{row.student.lastName} {row.student.firstName}</td>
                      {broadsheet.subjects.map(s => {
                        const d = row.details[s.id]
                        return d ? (
                          <Fragment key={s.id}>
                            <td className="p-1 text-center">{d.ca1}</td>
                            <td className="p-1 text-center">{d.ca2}</td>
                            <td className="p-1 text-center">{d.exam}</td>
                            <td className={`p-1 text-center font-bold ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{d.total}</td>
                          </Fragment>
                        ) : (
                          <Fragment key={s.id}>
                            <td className="p-1 text-center text-gray-300">-</td>
                            <td className="p-1 text-center text-gray-300">-</td>
                            <td className="p-1 text-center text-gray-300">-</td>
                            <td className="p-1 text-center text-gray-300">-</td>
                          </Fragment>
                        )
                      })}
                      <td className="p-2 text-center font-bold">{row.totalScore}</td>
                      <td className="p-2 text-center">{row.average}</td>
                      <td className="p-2 text-center font-bold">{row.position || '-'}</td>
                      <td className="p-2 text-left text-[10px] max-w-[150px]">
                        {row.resultId ? (
                          <input type="text" defaultValue={row.teacherComment || generateComment(row.totalScore, row.subjectCount)}
                            onBlur={(e) => handleSaveComment(row.resultId, e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded text-[10px] bg-transparent focus:bg-white focus:border-[#1B5E20] outline-none"
                            placeholder="Add comment..." />
                        ) : (
                          <span className="text-gray-400 text-[10px]">No result</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-[10px]">
                    <td className="p-2" colSpan="3"></td>
                    {broadsheet.subjects.map(s => (
                      <td key={s.id} className="p-1 text-center text-gray-500" colSpan="4">Max 110</td>
                    ))}
                    <td className="p-2" colSpan="4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No data found. Select session and term.</p>
          )}
          {savingComment && <p className="text-xs text-blue-600 mt-2">Saving comment...</p>}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-lg text-[#1B5E20] mb-4">Attendance & School Settings</h3>

          <div className="grid sm:grid-cols-2 gap-4 mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Days School Opened (this term)</label>
              <input type="number" min="0" value={daysOpen}
                onChange={(e) => setDaysOpen(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="e.g., 90" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Resumption Date</label>
              <input type="date" value={nextResDate}
                onChange={(e) => setNextResDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="sm:col-span-2">
              <button onClick={handleSaveSettings} disabled={savingSettings}
                className="bg-[#1B5E20] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm">
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          <h4 className="font-semibold text-gray-700 mb-3">Per-Student Attendance</h4>
          {broadsheet ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 font-medium text-gray-600">S/N</th>
                    <th className="text-left p-2 font-medium text-gray-600">Student Name</th>
                    <th className="text-center p-2 font-medium text-gray-600">Reg No</th>
                    <th className="text-center p-2 font-medium text-gray-600">Times Present</th>
                    <th className="text-center p-2 font-medium text-gray-600">Times Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {broadsheet.students.map((row, i) => (
                    <tr key={row.student.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-center">{i + 1}</td>
                      <td className="p-2 font-medium whitespace-nowrap">{row.student.lastName} {row.student.firstName}</td>
                      <td className="p-2 text-center text-xs">{row.student.regNo}</td>
                      <td className="p-2 text-center">
                        <input type="number" min="0"
                          value={attendanceData[row.student.id]?.present || ''}
                          onChange={(e) => setAttendanceData(prev => ({ ...prev, [row.student.id]: { ...prev[row.student.id], present: e.target.value } }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm" placeholder="-" />
                      </td>
                      <td className="p-2 text-center">
                        <input type="number" min="0"
                          value={attendanceData[row.student.id]?.absent || ''}
                          onChange={(e) => setAttendanceData(prev => ({ ...prev, [row.student.id]: { ...prev[row.student.id], absent: e.target.value } }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm" placeholder="-" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4">
                <button onClick={handleSaveAttendance} disabled={savingAttendance}
                  className="bg-[#1B5E20] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm">
                  {savingAttendance ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Load broadsheet data first.</p>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Register Student</h3>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <div className="flex gap-2">
                  <input type="text" required value={studentForm.regNo}
                    onChange={(e) => setStudentForm({ ...studentForm, regNo: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                    placeholder="PHS00001" />
                  <button type="button" onClick={generateExamNumbers}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap">
                    Generate Numbers
                  </button>
                </div>
              </div>
              {examNumbers.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-2">Click a number to use it:</p>
                  <div className="flex flex-wrap gap-1">
                    {examNumbers.map(num => (
                      <button key={num} type="button" onClick={() => useExamNumber(num)}
                        className="text-[10px] px-2 py-1 bg-white border border-yellow-300 rounded hover:bg-yellow-100 transition font-mono">
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" required value={studentForm.firstName}
                    onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" required value={studentForm.lastName}
                    onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arm</label>
                <select value={studentForm.arm} onChange={(e) => setStudentForm({ ...studentForm, arm: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </div>
              <button type="submit" disabled={studentLoading}
                className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm">
                {studentLoading ? 'Creating...' : 'Register Student'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Students in {myClass?.name || 'Class'}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 font-medium text-gray-600">Reg No</th>
                    <th className="text-left p-2 font-medium text-gray-600">Name</th>
                    <th className="text-center p-2 font-medium text-gray-600">Arm</th>
                  </tr>
                </thead>
                <tbody>
                  {broadsheet?.students?.map(s => (
                    <tr key={s.student.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-xs">{s.student.regNo}</td>
                      <td className="p-2 font-medium">{s.student.lastName} {s.student.firstName}</td>
                      <td className="p-2 text-center">{s.student.arm}</td>
                    </tr>
                  ))}
                  {(!broadsheet?.students?.length) && (
                    <tr><td colSpan="3" className="text-center p-4 text-gray-400">No students</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'submit' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Submit to Exam Officer</h3>

          {broadsheet ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{broadsheet.students.length}</p>
                  <p className="text-xs text-green-600">Students</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{broadsheet.subjects.length}</p>
                  <p className="text-xs text-blue-600">Subjects</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{broadsheet.students.filter(s => s.resultId).length}</p>
                  <p className="text-xs text-yellow-600">With Scores</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-700">{broadsheet.students.filter(s => s.status === 'SUBMITTED').length}</p>
                  <p className="text-xs text-purple-600">Submitted</p>
                </div>
              </div>

              {broadsheet.students.every(s => s.status === 'SUBMITTED') ? (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
                  This broadsheet has already been submitted to the exam officer.
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-3">
                    All scores will be locked and the broadsheet will be sent to the exam officer for review.
                    Positions and averages will be recalculated before submission.
                  </p>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm">
                    {submitting ? 'Submitting...' : 'Submit to Exam Officer'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No broadsheet data loaded.</p>
          )}
        </div>
      )}
    </div>
  )
}
