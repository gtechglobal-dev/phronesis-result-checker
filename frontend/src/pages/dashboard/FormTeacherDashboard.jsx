import { useState, useEffect, useRef, Fragment, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { classAPI, studentAPI, formTeacherAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useSocketListener } from '../../context/SocketContext'

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
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('ftActiveTab') || 'broadsheet')
  const broadsheetRef = useRef(null)

  const [studentForm, setStudentForm] = useState({ names: '' })
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentList, setStudentList] = useState([])
  const [editStudentId, setEditStudentId] = useState(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, student: null })
  const loadStudentList = useCallback(async () => {
    if (!myClass) return
    try {
      const classId = myClass.id || myClass._id
      if (!classId) return
      const res = await studentAPI.getAll({ classId })
      setStudentList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('loadStudentList error:', err?.response?.data || err.message)
    }
  }, [myClass])

  const [daysOpen, setDaysOpen] = useState('')
  const [nextResDate, setNextResDate] = useState('')
  const [attendanceData, setAttendanceData] = useState({})
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [reviewMessage, setReviewMessage] = useState({ type: '', text: '' })
  const [reopening, setReopening] = useState(null)
  const [reopenModal, setReopenModal] = useState({ show: false, subjectId: null, subjectName: '' })

  useEffect(() => { sessionStorage.setItem('ftActiveTab', activeTab) }, [activeTab])

  const tabs = [
    { id: 'broadsheet', label: 'Broadsheet' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'subjectReview', label: 'Subject Review' },
    { id: 'students', label: 'Students' },
    { id: 'submit', label: 'Submit' }
  ]

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
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
          setSelectedSession(curr._id || curr.id)
          if (curr.terms?.length) {
            const currentTerm = curr.terms.find(t => t.isCurrent)
            setSelectedTerm((currentTerm && (currentTerm._id || currentTerm.id)) || (curr.terms[0]._id || curr.terms[0].id))
          }
        }
      } catch { showMessage('error', 'Failed to load data') }
      finally { setLoading(false) }
    }
    init()
  }, [])

  const handleGenderToggle = async (student) => {
    const next = student.gender === 'M' ? 'F' : 'M'
    try {
      await studentAPI.update(student._id || student.id, { gender: next })
      setStudentList(prev => prev.map(s =>
        (s._id || s.id) === (student._id || student.id) ? { ...s, gender: next } : s
      ))
    } catch { showMessage('error', 'Failed to update gender') }
  }

  const handleDownloadXLSX = () => {
    if (!studentList.length) return
    const data = studentList.map((s, i) => ({
      'S/N': i + 1,
      'NAMES': `${s.lastName} ${s.firstName}`,
      'GENDER': s.gender || '',
      'EXAM NUMBER': s.regNo
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, `${myClass?.name || 'class'}_students.xlsx`)
  }

  const handleDownloadPDF = () => {
    if (!studentList.length) return
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm' })
    const pageW = pdf.internal.pageSize.getWidth()
    const margin = 10
    const colW = [(pageW - margin * 2) * 0.08, (pageW - margin * 2) * 0.4, (pageW - margin * 2) * 0.17, (pageW - margin * 2) * 0.35]
    const rowH = 8
    const header = ['S/N', 'NAMES', 'GENDER', 'EXAM NUMBER']
    let y = margin + 10
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    header.forEach((h, i) => {
      const x = margin + colW.slice(0, i).reduce((a, b) => a + b, 0)
      pdf.text(h, x + (i === 1 ? 2 : (colW[i] / 2)), y, { align: i === 1 ? 'left' : 'center' })
    })
    y += rowH
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    studentList.forEach((s, i) => {
      const cols = [String(i + 1), `${s.lastName} ${s.firstName}`, s.gender || '-', s.regNo]
      if (y + rowH > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage()
        y = margin + 10
      }
      cols.forEach((text, ci) => {
        const x = margin + colW.slice(0, ci).reduce((a, b) => a + b, 0)
        pdf.text(text, x + (ci === 1 ? 2 : (colW[ci] / 2)), y, { align: ci === 1 ? 'left' : 'center' })
      })
      y += rowH
    })
    pdf.save(`${myClass?.name || 'class'}_students.pdf`)
  }

  const handleStartEdit = (student) => {
    setEditStudentId(student._id || student.id)
    setEditName(`${student.lastName} ${student.firstName}`)
  }

  const handleSaveName = async (student) => {
    const parts = editName.trim().split(/\s+/)
    if (parts.length === 0) { setEditStudentId(null); return }
    const lastName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]
    const firstName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    try {
      await studentAPI.update(student._id || student.id, { firstName, lastName })
      setStudentList(prev => prev.map(s =>
        (s._id || s.id) === (student._id || student.id) ? { ...s, firstName: firstName.toUpperCase(), lastName: lastName.toUpperCase() } : s
      ))
    } catch { showMessage('error', 'Failed to update name') }
    setEditStudentId(null)
  }

  const handleEditKeyDown = (e, student) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSaveName(student) }
    if (e.key === 'Escape') setEditStudentId(null)
  }

  const handleDeleteStudent = async () => {
    const student = deleteConfirm.student
    if (!student) return
    try {
      await studentAPI.remove(student._id || student.id)
      setStudentList(prev => prev.filter(s => (s._id || s.id) !== (student._id || student.id)))
      showMessage('success', 'Student removed')
    } catch { showMessage('error', 'Failed to delete student') }
    setDeleteConfirm({ show: false, student: null })
  }

  const loadBroadsheet = useCallback(async () => {
    if (!selectedSession || !selectedTerm) return
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
  }, [selectedSession, selectedTerm])

  useEffect(() => {
    loadStudentList()
    if (myClass && selectedSession && selectedTerm) loadBroadsheet()
  }, [myClass, selectedSession, selectedTerm, loadStudentList, loadBroadsheet])

  const refreshBroadsheet = useCallback(() => {
    loadBroadsheet()
  }, [loadBroadsheet])

  useSocketListener('entity:updated', refreshBroadsheet)
  useSocketListener('result:status', refreshBroadsheet)
  useSocketListener('result:withheld', refreshBroadsheet)
  useSocketListener('scores:saved', refreshBroadsheet)
  useSocketListener('scores:submitted', refreshBroadsheet)

  const loadSessions = async () => {
    try { const res = await classAPI.getSessions(); setSessions(res.data) } catch {}
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault()
    if (!myClass) return

    const names = studentForm.names.split(',').map(s => s.trim()).filter(Boolean)
    if (!names.length) {
      showMessage('error', 'Enter at least one student name')
      return
    }

    const students = names.map(name => {
      const parts = name.trim().split(/\s+/)
      const lastName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]
      const firstName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
      return { firstName, lastName, classId: myClass.id || myClass._id }
    })

    setStudentLoading(true)
    try {
      await studentAPI.bulkCreate({ students })
      showMessage('success', `${students.length} student(s) created`)
      setStudentForm({ names: '' })
      await loadStudentList()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error creating students'
      showMessage('error', msg)
      console.error('create students error:', err?.response?.data || err.message)
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

  const handleReopenSubject = async () => {
    const { subjectId, subjectName } = reopenModal
    setReopenModal({ show: false, subjectId: null, subjectName: '' })
    setReopening(subjectId)
    try {
      await formTeacherAPI.reopenSubject({ sessionId: selectedSession, termId: selectedTerm, subjectId })
      setReviewMessage({ type: 'success', text: `"${subjectName}" reopened for editing` })
      setTimeout(() => setReviewMessage({ type: '', text: '' }), 4000)
      loadBroadsheet()
    } catch (err) {
      setReviewMessage({ type: 'error', text: err.response?.data?.message || 'Error reopening subject' })
      setTimeout(() => setReviewMessage({ type: '', text: '' }), 4000)
    } finally { setReopening(null) }
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
    const sessionName = sessions.find(s => (s._id || s.id) === selectedSession)?.name || ''
    const termName = sessions.filter(s => (s._id || s.id) === selectedSession).flatMap(s => s.terms || []).find(t => (t._id || t.id) === selectedTerm)?.name || ''

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
        <h2>${broadsheet?.class?.name || ''} - ${sessionName} (${termName})</h2>
        <h2>RESULT BROADSHEET</h2>
      </div>
      <table>
        <thead><tr>
          <th rowspan="2">S/N</th><th rowspan="2">Student Name</th><th rowspan="2">G</th>
          ${subjects.map(s => `<th colspan="4">${s.name}</th>`).join('')}
          <th rowspan="2">Total</th><th rowspan="2">Average</th><th rowspan="2">Pos</th><th rowspan="2">Comment</th>
        </tr><tr>
          ${subjects.map(() => '<th>CA1(20)</th><th>CA2(20)</th><th>EXAM(60)</th><th>Total(100)</th>').join('')}
        </tr></thead>
        <tbody>
          ${rows.map((row, i) => `<tr>
            <td>${i + 1}</td>
            <td class="name">${row.student.lastName} ${row.student.firstName}</td>
            <td>${row.student.gender || '-'}</td>
            ${subjects.map(s => {
              const d = row.details[s._id || s.id]
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

  const downloadBroadsheetPDF = () => {
    if (!broadsheet) return
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 8
    const colW = (pageW - margin * 2) / (3 + broadsheet.subjects.length * 4 + 3)
    const rowH = 7
    let y = margin + 12

    const drawHeader = () => {
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      let x = margin
      const cells = ['S/N', 'NAMES', 'G']
      cells.forEach((h, i) => {
        pdf.text(h, x + (i < 2 ? 2 : colW / 2), y + 3, { align: i < 2 ? 'left' : 'center' })
        x += colW
      })
      broadsheet.subjects.forEach(s => {
        const sx = x
        pdf.text(s.name, x + colW * 2, y + 3, { align: 'center' })
        pdf.rect(x, y - 5, colW * 4, rowH * 2)
        x += colW * 4
      })
      const lastCols = ['TOTAL', 'AVERAGE', 'POS']
      lastCols.forEach(h => {
        pdf.text(h, x + colW / 2, y + 3, { align: 'center' })
        pdf.rect(x, y - 5, colW, rowH * 2)
        x += colW
      })
    }

    const drawSubHeader = () => {
      let x = margin + colW * 3
      pdf.setFontSize(6)
      broadsheet.subjects.forEach(() => {
        ;['CA1(20)', 'CA2(20)', 'EXAM(60)', 'Total(100)'].forEach((h, i) => {
          pdf.text(h, x + colW / 2, y + 3, { align: 'center' })
          pdf.rect(x, y - 5, colW, rowH)
          x += colW
        })
      })
    }

    const drawRow = (row, i) => {
      if (y + rowH > pageH - margin) {
        pdf.addPage()
        y = margin + 12
        drawHeader()
        y += rowH
        drawSubHeader()
      }
      y += rowH
      let x = margin
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'normal')
      pdf.text(String(i + 1), x + colW / 2, y, { align: 'center' })
      pdf.rect(x, y - 5, colW, rowH)
      x += colW
      pdf.text(`${row.student.lastName} ${row.student.firstName}`, x + 2, y, { align: 'left' })
      pdf.rect(x, y - 5, colW, rowH)
      x += colW
      pdf.text(row.student.gender || '-', x + colW / 2, y, { align: 'center' })
      pdf.rect(x, y - 5, colW, rowH)
      x += colW
      broadsheet.subjects.forEach(s => {
        const d = row.details[s._id || s.id]
        const vals = d ? [d.ca1, d.ca2, d.exam, d.total] : ['-', '-', '-', '-']
        vals.forEach(v => {
          pdf.text(String(v), x + colW / 2, y, { align: 'center' })
          pdf.rect(x, y - 5, colW, rowH)
          x += colW
        })
      })
      ;[row.totalScore, row.average, row.position || '-'].forEach(v => {
        pdf.text(String(v), x + colW / 2, y, { align: 'center' })
        pdf.rect(x, y - 5, colW, rowH)
        x += colW
      })
    }

    drawHeader()
    y += rowH
    drawSubHeader()
    broadsheet.students.forEach((row, i) => drawRow(row, i))
    pdf.save(`${broadsheet.class.name}_broadsheet.pdf`)
  }

  const downloadBroadsheetXLSX = () => {
    if (!broadsheet) return
    const headers = ['S/N', 'STUDENT NAMES', 'G']
    broadsheet.subjects.forEach(s => {
      headers.push(`${s.name}-CA1`, `${s.name}-CA2`, `${s.name}-EXAM`, `${s.name}-TOTAL`)
    })
    headers.push('TOTAL', 'AVERAGE', 'POSITION')
    const data = broadsheet.students.map((row, i) => {
      const rowData = [i + 1, `${row.student.lastName} ${row.student.firstName}`, row.student.gender || '-']
      broadsheet.subjects.forEach(s => {
        const d = row.details[s._id || s.id]
        if (d) {
          rowData.push(d.ca1, d.ca2, d.exam, d.total)
        } else {
          rowData.push('-', '-', '-', '-')
        }
      })
      rowData.push(row.totalScore, row.average, row.position || '-')
      return rowData
    })
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    const colW = []
    colW.push({ wch: 4 })
    colW.push({ wch: 25 })
    colW.push({ wch: 3 })
    broadsheet.subjects.forEach(() => { colW.push({ wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }) })
    colW.push({ wch: 8 }, { wch: 8 }, { wch: 8 })
    ws['!cols'] = colW
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Broadsheet')
    XLSX.writeFile(wb, `${broadsheet.class.name}_broadsheet.xlsx`)
  }

  if (loading && !broadsheet) {
    return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1B5E20]" /></div>
  }

  return (
    <>
    <style>{`@keyframes fadeInUp{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">Form Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {myClass ? <span className="text-yellow-600 font-medium">Class: {myClass.name}</span> : 'Loading class...'}
        </p>
      </div>

      {message.text && (
        <div className="fixed bottom-12 sm:bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-xs sm:text-sm font-medium flex items-center gap-2 pointer-events-auto"
          style={{ animation: 'fadeInUp 0.3s ease-out', backgroundColor: message.type === 'error' ? '#FEE2E2' : '#D1FAE5', border: `1px solid ${message.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`, color: message.type === 'error' ? '#991B1B' : '#065F46' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {message.type === 'error'
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            }
          </svg>
          <span>{message.text}</span>
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
            {sessions.map(s => <option key={s._id || s.id} value={s.id || s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
          <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
            {sessions.filter(s => (s._id || s.id) === selectedSession).flatMap(s => s.terms || []).map(t => (
              <option key={t._id || t.id} value={t.id || t._id}>{t.name}</option>
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
              <button onClick={downloadBroadsheetXLSX}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition">XLSX</button>
              <button onClick={downloadBroadsheetPDF}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition">PDF</button>
              <button onClick={printBroadsheet}
                className="bg-[#1B5E20] text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-[#2E7D32] transition">Print</button>
            </div>
          </div>

          {broadsheet ? (
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead className="sticky top-0 z-20">
                    <tr className="bg-[#1B5E20] text-white">
                    <th className="p-2 text-center font-semibold text-xs sticky left-0 bg-[#1B5E20] z-30" rowSpan="2">S/N</th>
                    <th className="p-2 text-left font-semibold text-xs sticky left-[40px] bg-[#1B5E20] z-30" rowSpan="2">STUDENT'S NAMES</th>
                    <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">G</th>
                    {broadsheet.subjects.map(s => (
                      <th key={s._id || s.id} className="p-1 text-center font-semibold text-xs border-r border-green-800 bg-[#1B5E20]" colSpan="4">{s.name}</th>
                    ))}
                    <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">TOTAL</th>
                    <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">AVERAGE</th>
                    <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">POSITION</th>
                    <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">Comment</th>
                  </tr>
                  <tr className="bg-[#E8F5E9] text-gray-700 border-b border-gray-300">
                    {broadsheet.subjects.map(s => (
                      <Fragment key={s._id || s.id}>
                        <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">CA1(20)</th>
                        <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">CA2(20)</th>
                        <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">EXAM(60)</th>
                        <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">TOTAL(100)</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {broadsheet.students.map((row, i) => (
                    <tr key={row.student.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                      <td className="p-2 text-center font-bold sticky left-0 bg-inherit z-10">{i + 1}</td>
                      <td className="p-2 font-medium whitespace-nowrap sticky left-[30px] bg-inherit z-10">{row.student.lastName} {row.student.firstName}</td>
                      <td className="p-2 text-center font-bold">{row.student.gender || '-'}</td>
                      {broadsheet.subjects.map(s => {
                        const d = row.details[s._id || s.id]
                        return d ? (
                          <Fragment key={s._id || s.id}>
                            <td className="p-1 text-center">{d.ca1}</td>
                            <td className="p-1 text-center">{d.ca2}</td>
                            <td className="p-1 text-center">{d.exam}</td>
                            <td className={`p-1 text-center font-bold border-r border-gray-300 ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{d.total}</td>
                          </Fragment>
                        ) : (
                          <Fragment key={s._id || s.id}>
                            <td className="p-1 text-center text-gray-300">-</td>
                            <td className="p-1 text-center text-gray-300">-</td>
                            <td className="p-1 text-center text-gray-300">-</td>
                            <td className="p-1 text-center text-gray-300 border-r border-gray-300">-</td>
                          </Fragment>
                        )
                      })}
                      <td className="p-2 text-center font-bold">{row.totalScore}</td>
                      <td className="p-2 text-center">{row.average}</td>
                      <td className="p-2 text-center font-bold">{row.position || '-'}</td>
                      <td className="p-2 text-left text-xs max-w-[150px]">
                        {row.resultId ? (
                          <input type="text" defaultValue={row.teacherComment || generateComment(row.totalScore, row.subjectCount)}
                            onBlur={(e) => handleSaveComment(row.resultId, e.target.value)}
                            className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs bg-transparent focus:bg-white focus:border-[#1B5E20] outline-none"
                            placeholder="Add comment..." />
                        ) : (
                          <span className="text-gray-400 text-xs">No result</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-xs">
                    <td className="p-2" colSpan="3"></td>
                    {broadsheet.subjects.map(s => (
                      <td key={s._id || s.id} className="p-1 text-center text-gray-500" colSpan="4">Max 100</td>
                    ))}
                    <td className="p-2" colSpan="3"></td>
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

      {activeTab === 'subjectReview' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Subject Review</h3>
          <p className="text-sm text-gray-500 mb-4">Reopen a submitted subject so the subject teacher can make changes and resubmit.</p>

          {reviewMessage.text && (
            <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex justify-between items-center ${reviewMessage.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              <span>{reviewMessage.text}</span>
              <button onClick={() => setReviewMessage({ type: '', text: '' })} className="ml-2 font-bold text-lg">&times;</button>
            </div>
          )}

          {!broadsheet ? (
            <p className="text-gray-400 text-center py-8">Load the broadsheet first to see subject status.</p>
          ) : broadsheet.subjects.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No subjects found for this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3 font-medium text-gray-600">Subject</th>
                    <th className="text-center p-3 font-medium text-gray-600">Students with Scores</th>
                    <th className="text-center p-3 font-medium text-gray-600">Status</th>
                    <th className="text-center p-3 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {broadsheet.subjects.map(s => {
                    const sid = s._id || s.id
                    const studentsWithScores = broadsheet.students.filter(row => row.details[sid] != null)
                    const anySubmitted = studentsWithScores.some(row => row.details[sid]?.submitted)
                    return (
                      <tr key={sid} className="border-t hover:bg-gray-50">
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3 text-center text-gray-600">{studentsWithScores.length} / {broadsheet.students.length}</td>
                        <td className="p-3 text-center">
                          {anySubmitted ? (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2.5 py-1 rounded-full text-xs font-medium">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                              Submitted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full text-xs font-medium">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                              Not Submitted
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => setReopenModal({ show: true, subjectId: sid, subjectName: s.name })} disabled={reopening === sid || !anySubmitted}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${anySubmitted ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                            {reopening === sid ? 'Reopening...' : 'Reopen'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {reopenModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReopenModal({ show: false, subjectId: null, subjectName: '' })}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Reopen Subject</h3>
              <p className="text-sm text-gray-600 mb-1">Reopen <strong>{reopenModal.subjectName}</strong> for editing?</p>
              <p className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg mb-5">The subject teacher will be able to modify scores and resubmit.</p>
              <div className="flex gap-3">
                <button onClick={() => setReopenModal({ show: false, subjectId: null, subjectName: '' })}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handleReopenSubject}
                  className="flex-1 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition">
                  Reopen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Register Students</h3>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Names (comma separated)</label>
                <textarea required value={studentForm.names}
                  onChange={(e) => setStudentForm({ ...studentForm, names: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm min-h-[100px]"
                  placeholder="John Doe, Jane Smith, Bob Johnson, ..." />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-3">Each student will get a unique exam number (PHS/xxxxx) automatically.</p>
                <button type="submit" disabled={studentLoading}
                  className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm">
                  {studentLoading ? 'Creating...' : 'Register Students'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">Students in {myClass?.name || 'Class'}</h3>
              <div className="flex gap-2">
                <button onClick={handleDownloadXLSX}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer">
                  Download XLSX
                </button>
                <button onClick={handleDownloadPDF}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#1B5E20] rounded-lg hover:bg-[#2E7D32] transition cursor-pointer">
                  Download PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table id="student-list-table" className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-center p-2 font-medium text-gray-600 w-10">S/N</th>
                    <th className="text-left p-2 pr-8 font-medium text-gray-600">NAMES<div className="text-[10px] font-normal text-gray-400">(click on names to edit)</div></th>
                    <th className="text-center p-2 pl-8 font-medium text-gray-600 w-28">GENDER<div className="text-[10px] font-normal text-gray-400 whitespace-nowrap">click to change</div></th>
                    <th className="text-center p-2 font-medium text-gray-600 pr-6">EXAM NUMBER</th>
                    <th className="text-center p-2 font-medium text-gray-600 w-16">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {studentList.map((s, i) => {
                    const sid = s._id || s.id
                    const isEditing = editStudentId === sid
                    return (
                    <tr key={sid} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-center text-xs">{i + 1}</td>
                      <td className="p-2 pr-8 font-medium whitespace-nowrap">
                        {isEditing ? (
                          <input type="text" value={editName} autoFocus
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleSaveName(s)}
                            onKeyDown={(e) => handleEditKeyDown(e, s)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                        ) : (
                          <button type="button" onClick={() => handleStartEdit(s)}
                            className="text-left w-full hover:text-[#1B5E20] transition cursor-pointer">
                            {s.lastName} {s.firstName}
                          </button>
                        )}
                      </td>
                      <td className="p-2 pl-8 text-center w-28">
                        <button type="button" onClick={() => handleGenderToggle(s)}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white transition cursor-pointer ${s.gender === 'M' ? 'bg-blue-500' : s.gender === 'F' ? 'bg-pink-500' : 'bg-gray-300'}`}>
                          {s.gender || '?'}
                        </button>
                      </td>
                      <td className="p-2 text-xs text-center pr-6">{s.regNo}</td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => setDeleteConfirm({ show: true, student: s })}
                          className="px-2 py-1 text-xs font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 transition cursor-pointer">
                          Delete
                        </button>
                      </td>
                    </tr>
                  )})}
                  {!studentList.length && (
                    <tr><td colSpan="5" className="text-center p-4 text-gray-400">No students</td></tr>
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
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Student</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to remove <strong>{deleteConfirm.student?.lastName} {deleteConfirm.student?.firstName}</strong>?
            </p>
            <p className="text-sm text-red-600 font-medium mb-5">
              Every exam record of this student will be deleted from the system.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm({ show: false, student: null })}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDeleteStudent}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
