import { useState, useEffect, useRef, Fragment, useCallback, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { classAPI, studentAPI, formTeacherAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useSocketListener } from '../../context/SocketContext'

const getClassSortOrder = (name) => {
  const n = (name || '').toLowerCase().trim()
  if (n.startsWith('montesorri') || n.startsWith('montessori')) return 1
  if (n.startsWith('nursery')) return 2
  if (n.startsWith('basic')) {
    const num = parseInt(n.match(/\d+/)?.[0] || '1')
    if (num <= 2) return 2 + num
    return 4 + (num - 2)
  }
  if (n.startsWith('jss')) {
    const num = parseInt(n.match(/\d+/)?.[0] || '1')
    const isB = n.includes('b')
    return 9 + (num - 1) * 2 + (isB ? 1 : 0)
  }
  if (n.startsWith('sss')) {
    const num = parseInt(n.match(/\d+/)?.[0] || '1')
    if (num === 1) return n.includes('b') ? 16 : 15
    if (num === 2) return 17
    if (num === 3) return 18
    return 14 + num
  }
  if (n.startsWith('graduat')) return 19
  return 99
}

export default function FormTeacherDashboard() {
  const { user } = useAuth()
  const [myClass, setMyClass] = useState(null)
  const [broadsheet, setBroadsheet] = useState(null)
  const [broadsheetSearch, setBroadsheetSearch] = useState('')
  const filteredStudents = useMemo(() => {
    if (!broadsheet || !broadsheetSearch) return broadsheet?.students || []
    return broadsheet.students.filter(row =>
      `${row.student?.lastName || ''} ${row.student?.firstName || ''} ${row.student?.regNo || ''}`
        .toLowerCase().includes(broadsheetSearch.toLowerCase())
    )
  }, [broadsheet, broadsheetSearch])
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('ftActiveTab') || 'broadsheet')
  const broadsheetRef = useRef(null)

  const [studentForm, setStudentForm] = useState({ names: '' })
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentList, setStudentList] = useState([])
  const [editStudentId, setEditStudentId] = useState(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, student: null })
  const [transferStudents, setTransferStudents] = useState([])
  const [selectedTransfer, setSelectedTransfer] = useState(new Set())
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)
  const [prevSessionId, setPrevSessionId] = useState('')
  const [transferMessage, setTransferMessage] = useState(null)
  const [publishedNotification, setPublishedNotification] = useState(null)
  const [availableClasses, setAvailableClasses] = useState([])
  const [transferTargetClassId, setTransferTargetClassId] = useState('')
  const [showAllTransfer, setShowAllTransfer] = useState(false)

  useEffect(() => {
    if (transferMessage) {
      const t = setTimeout(() => setTransferMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [transferMessage])

  useEffect(() => {
    if (publishedNotification) {
      const t = setTimeout(() => setPublishedNotification(null), 8000)
      return () => clearTimeout(t)
    }
  }, [publishedNotification])

  const loadTransferSources = useCallback(async () => {
    if (!myClass || !sessions.length || !selectedSession) return
    const classId = myClass.id || myClass._id
    const idx = sessions.findIndex(s => (s._id || s.id) === selectedSession)
    if (idx < 0 || idx >= sessions.length - 1) { setPrevSessionId(''); setTransferStudents([]); return }
    const prev = sessions[idx + 1]
    setPrevSessionId(prev._id || prev.id)
    setTransferLoading(true)
    try {
      const [prevRes, currRes] = await Promise.all([
        studentAPI.getAll({ classId, sessionId: prev._id || prev.id }),
        studentAPI.getAll({ sessionId: selectedSession })
      ])
      const prevList = Array.isArray(prevRes.data) ? prevRes.data : []
      const currRegNos = new Set(
        (Array.isArray(currRes.data) ? currRes.data : []).map(s => s.regNo)
      )
      setTransferStudents(prevList.map(s => ({
        ...s,
        alreadyTransferred: currRegNos.has(s.regNo)
      })))
    } catch { setTransferStudents([]) }
    setTransferLoading(false)
  }, [myClass, sessions, selectedSession])

  useEffect(() => {
    if (myClass && availableClasses.length) {
      const currentOrder = getClassSortOrder(myClass.name)
      const next = availableClasses.find(c => getClassSortOrder(c.name) > currentOrder)
      setTransferTargetClassId(next ? (next._id || next.id) : '')
    }
  }, [myClass, availableClasses])

  const loadStudentList = useCallback(async () => {
    if (!myClass) return
    try {
      const classId = myClass.id || myClass._id
      if (!classId) return
      const res = await studentAPI.getAll({ classId, sessionId: selectedSession })
      setStudentList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('loadStudentList error:', err?.response?.data || err.message)
    }
  }, [myClass, selectedSession])

  const [daysOpen, setDaysOpen] = useState('')
  const [nextResDate, setNextResDate] = useState('')
  const [attendanceData, setAttendanceData] = useState({})
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [reviewMessage, setReviewMessage] = useState({ type: '', text: '' })
  const [reopening, setReopening] = useState(null)
  const [reopenModal, setReopenModal] = useState({ show: false, subjectId: null, subjectName: '' })
  const [commentModal, setCommentModal] = useState({ show: false, resultId: null, comment: '', studentName: '' })
  const [editPositionId, setEditPositionId] = useState(null)

  useEffect(() => { sessionStorage.setItem('ftActiveTab', activeTab) }, [activeTab])

  const tabs = [
    { id: 'broadsheet', label: 'Broadsheet' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'subjectReview', label: 'Subject Review' },
    { id: 'students', label: 'Students' },
    { id: 'transfer', label: 'Transfer Students' },
    { id: 'submit', label: 'Submit' }
  ]

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [assignRes, sessRes, clsRes] = await Promise.all([
          classAPI.getMyAssignment(),
          classAPI.getSessions(),
          classAPI.getAll()
        ])
        if (assignRes.data.class) setMyClass(assignRes.data.class)
        setSessions(sessRes.data)
        setAvailableClasses((Array.isArray(clsRes.data) ? clsRes.data : []).sort((a, b) => getClassSortOrder(a.name) - getClassSortOrder(b.name)))
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

  useEffect(() => { loadTransferSources() }, [loadTransferSources])

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

  const handleDownloadPDF = async () => {
    if (!studentList.length) return
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const margin = 15
    const contentW = pageW - margin * 2
    const colW = [contentW * 0.08, contentW * 0.38, contentW * 0.17, contentW * 0.37]
    const rowH = 8
    const header = ['S/N', 'NAMES', 'GENDER', 'EXAM NUMBER']

    const loadLogo = () => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => resolve(null)
      img.src = '/school logo.png'
    })
    const logoData = await loadLogo()

    let y = margin
    if (logoData) {
      const logoW = 22
      const logoH = 22
      pdf.addImage(logoData, 'PNG', pageW / 2 - logoW / 2, y, logoW, logoH)
      y += logoH + 6
    }
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PHRONESIS INTERNATIONAL SCHOOL', pageW / 2, y, { align: 'center' })
    y += 6
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Divine wisdom for excellence', pageW / 2, y, { align: 'center' })
    y += 8
    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${myClass?.name || 'Class'} - Student List`, pageW / 2, y, { align: 'center' })
    y += 4

    pdf.setDrawColor(0)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageW - margin, y)
    y += 6

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

  const loadBroadsheet = useCallback(async (isBackground) => {
    if (!selectedSession || !selectedTerm) return
    try {
      if (isBackground) setRefreshing(true); else setLoading(true)
      const res = await formTeacherAPI.getBroadsheet({ sessionId: selectedSession, termId: selectedTerm })
      res.data.students = (res.data.students || []).filter(s => s.student != null)
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
    } finally { if (isBackground) setRefreshing(false); else setLoading(false) }
  }, [selectedSession, selectedTerm])

  useEffect(() => {
    loadStudentList()
    if (myClass && selectedSession && selectedTerm) loadBroadsheet()
  }, [myClass, selectedSession, selectedTerm, loadStudentList, loadBroadsheet])

  const refreshBroadsheet = useCallback(() => {
    loadBroadsheet(true)
  }, [loadBroadsheet])

  useSocketListener('entity:updated', refreshBroadsheet)
  useSocketListener('result:status', refreshBroadsheet)
  useSocketListener('result:withheld', refreshBroadsheet)
  useSocketListener('scores:saved', refreshBroadsheet)
  useSocketListener('scores:submitted', refreshBroadsheet)

  useSocketListener('result:published', (data) => {
    if (data.className) {
      setPublishedNotification(data)
      loadBroadsheet(true)
    }
  })

  useSocketListener('result:sentForReview', (data) => {
    if (data.className) {
      setPublishedNotification({ ...data, type: 'review' })
      loadBroadsheet(true)
    }
  })

  const loadSessions = async () => {
    try { const res = await classAPI.getSessions(); setSessions(res.data) } catch {}
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault()
    if (!myClass) return
    if (!selectedSession) {
      showMessage('error', 'Please select a session first')
      return
    }

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
      await studentAPI.bulkCreate({ students, sessionId: selectedSession })
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

  const handleSavePosition = async (resultId, position) => {
    if (!resultId) return
    try {
      await formTeacherAPI.updatePosition({ resultId, position: parseInt(position) || 0 })
    } catch {}
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
    const records = broadsheet.students.filter(s => s.student).map(s => ({
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
      await formTeacherAPI.updateAttendance({ records, termId: selectedTerm })
      showMessage('success', 'Attendance saved')
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error saving attendance')
    } finally { setSavingAttendance(false) }
  }

  const handleSubmit = async () => {
    setShowSubmitModal(false)
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

  const formatPosition = (pos) => {
    if (!pos) return '-'
    const s = ['th', 'st', 'nd', 'rd']
    const v = pos % 100
    return pos + (s[(v - 20) % 10] || s[v] || s[0])
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
          <th rowspan="2">GRAND TOTAL</th><th rowspan="2">Average</th><th rowspan="2">Pos</th><th rowspan="2">Comment</th>
        </tr><tr>
          ${subjects.map(() => '<th>CA1(20)</th><th>CA2(20)</th><th>EXAM(60)</th><th>Total(100)</th>').join('')}
        </tr></thead>
        <tbody>
          ${rows.map((row, i) => `<tr>
            <td>${i + 1}</td>
            <td class="name">${row.student?.lastName || ''} ${row.student?.firstName || ''}</td>
            <td>${row.student?.gender || '-'}</td>
            ${subjects.map(s => {
              const d = row.details[s._id || s.id]
              const sv = (v) => d && d.submitted ? v : (v || '-')
              return d ? `<td>${sv(d.ca1)}</td><td>${sv(d.ca2)}</td><td>${sv(d.exam)}</td><td class="total">${sv(d.total)}</td>`
                : '<td>-</td><td>-</td><td>-</td><td>-</td>'
            }).join('')}
            <td class="total">${row.totalScore}</td>
            <td>${row.average}</td>
            <td>${formatPosition(row.position)}</td>
            <td style="font-size:7px;text-align:left">${row.teacherComment || generateComment(row.totalScore, row.subjectCount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">Generated on ${new Date().toLocaleDateString()} - Phronesis Int'l School Result Management System</div>
    </body></html>`)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  const downloadBroadsheetPDF = async () => {
    if (!broadsheet) return
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 8
    const contentW = pageW - margin * 2

    const loadLogo = () => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => resolve(null)
      img.src = '/school logo.png'
    })
    const logoData = await loadLogo()

    const fixedW = 8 + 38 + 8
    const summaryW = 14 + 11 + 9
    const subjectsAreaW = contentW - fixedW - summaryW
    const subCols = broadsheet.subjects.length * 4
    const subColW = subCols > 0 ? subjectsAreaW / subCols : 10
    const rowH = 5.5

    const colW = {
      sn: 8,
      name: 38,
      gender: 8,
      score: subColW,
      grandTotal: 14,
      average: 11,
      pos: 9,
    }

    const scaled = (key) => {
      if (typeof key === 'number') return key
      return colW[key]
    }

    const drawRect = (x, y, w, h) => pdf.rect(x, y, w, h)
    const cellText = (text, x, y, w, h, align = 'center') => {
      const tx = align === 'left' ? x + 1 : x + w / 2
      const maxLen = Math.floor(w / 1.8)
      let displayText = String(text)
      if (displayText.length > maxLen) displayText = displayText.slice(0, maxLen - 2) + '..'
      pdf.text(displayText, tx, y + h - 1.2, { align, maxWidth: w - 2 })
    }

    const drawHeaderBlock = (startY) => {
      let y = startY
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')

      let x = margin
      drawRect(x, y, scaled('sn'), rowH * 2)
      cellText('S/N', x, y, scaled('sn'), rowH * 2); x += scaled('sn')

      drawRect(x, y, scaled('name'), rowH * 2)
      cellText('NAMES', x, y, scaled('name'), rowH * 2); x += scaled('name')

      drawRect(x, y, scaled('gender'), rowH * 2)
      cellText('G', x, y, scaled('gender'), rowH * 2); x += scaled('gender')

      broadsheet.subjects.forEach(s => {
        drawRect(x, y, scaled('score') * 4, rowH * 2)
        cellText(s.name, x, y, scaled('score') * 4, rowH * 2)
        x += scaled('score') * 4
      })

      drawRect(x, y, scaled('grandTotal'), rowH * 2)
      cellText('GRAND\nTOTAL', x, y, scaled('grandTotal'), rowH * 2); x += scaled('grandTotal')

      drawRect(x, y, scaled('average'), rowH * 2)
      cellText('AVG', x, y, scaled('average'), rowH * 2); x += scaled('average')

      drawRect(x, y, scaled('pos'), rowH * 2)
      cellText('POS', x, y, scaled('pos'), rowH * 2)

      y += rowH
      let sx = margin + scaled('sn') + scaled('name') + scaled('gender')
      pdf.setFontSize(5)
      pdf.setFont('helvetica', 'bold')
      broadsheet.subjects.forEach(() => {
        ;['CA1', 'CA2', 'EXAM', 'TOT'].forEach(h => {
          drawRect(sx, y, scaled('score'), rowH)
          cellText(h, sx, y, scaled('score'), rowH)
          sx += scaled('score')
        })
      })

      return y + rowH
    }

    const drawStudentRow = (row, i, startY) => {
      let y = startY
      let x = margin
      pdf.setFontSize(5)
      pdf.setFont('helvetica', 'normal')

      drawRect(x, y, scaled('sn'), rowH)
      cellText(String(i + 1), x, y, scaled('sn'), rowH); x += scaled('sn')

      drawRect(x, y, scaled('name'), rowH)
      cellText(`${row.student?.lastName || ''} ${row.student?.firstName || ''}`, x, y, scaled('name'), rowH, 'left'); x += scaled('name')

      drawRect(x, y, scaled('gender'), rowH)
      cellText(row.student?.gender || '-', x, y, scaled('gender'), rowH); x += scaled('gender')

      broadsheet.subjects.forEach(s => {
        const d = row.details[s._id || s.id]
        const sv = (v) => d && d.submitted ? v : (v || '-')
        const vals = d ? [sv(d.ca1), sv(d.ca2), sv(d.exam), sv(d.total)] : ['-', '-', '-', '-']
        vals.forEach(v => {
          drawRect(x, y, scaled('score'), rowH)
          cellText(String(v), x, y, scaled('score'), rowH)
          x += scaled('score')
        })
      })

      drawRect(x, y, scaled('grandTotal'), rowH)
      cellText(String(row.totalScore), x, y, scaled('grandTotal'), rowH); x += scaled('grandTotal')

      drawRect(x, y, scaled('average'), rowH)
      cellText(String(row.average), x, y, scaled('average'), rowH); x += scaled('average')

      drawRect(x, y, scaled('pos'), rowH)
      cellText(formatPosition(row.position), x, y, scaled('pos'), rowH)

      return y + rowH
    }

    let y = margin
    if (logoData) {
      const logoW = 16
      const logoH = 16
      pdf.addImage(logoData, 'PNG', margin, y, logoW, logoH)
      y += logoH + 2
    }
    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PHRONESIS INTERNATIONAL SCHOOL', margin, y)
    y += 5
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Divine wisdom for excellence', margin, y)
    y += 5

    const sessionName = sessions.find(s => (s._id || s.id) === selectedSession)?.name || ''
    const termName = sessions.filter(s => (s._id || s.id) === selectedSession).flatMap(s => s.terms || []).find(t => (t._id || t.id) === selectedTerm)?.name || ''
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${broadsheet.class?.name || 'Class'} - RESULT BROADSHEET`, pageW - margin, margin + 4, { align: 'right' })
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`${sessionName} | ${termName}`, pageW - margin, margin + 9, { align: 'right' })

    pdf.setDrawColor(0)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageW - margin, y)
    y += 4

    y = drawHeaderBlock(y)
    let currentY = y

    broadsheet.students.forEach((row, i) => {
      if (currentY + rowH > pageH - margin) {
        pdf.addPage()
        currentY = margin + 4
        currentY = drawHeaderBlock(currentY)
      }
      currentY = drawStudentRow(row, i, currentY)
    })

    pdf.setDrawColor(0)
    pdf.setLineWidth(0.3)
    pdf.line(margin, currentY + 1, pageW - margin, currentY + 1)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'italic')
    pdf.text(`Generated on ${new Date().toLocaleDateString()} - Phronesis Int'l School Result Management System`, pageW / 2, currentY + 5, { align: 'center' })

    pdf.save(`${broadsheet.class.name}_broadsheet.pdf`)
  }

  const downloadBroadsheetXLSX = () => {
    if (!broadsheet) return
    const headers = ['S/N', 'STUDENT NAMES', 'G']
    broadsheet.subjects.forEach(s => {
      headers.push(`${s.name}-CA1`, `${s.name}-CA2`, `${s.name}-EXAM`, `${s.name}-TOTAL`)
    })
    headers.push('GRAND TOTAL', 'AVERAGE', 'POSITION')
    const data = broadsheet.students.map((row, i) => {
      const rowData = [i + 1, `${row.student?.lastName || ''} ${row.student?.firstName || ''}`, row.student?.gender || '-']
      broadsheet.subjects.forEach(s => {
        const d = row.details[s._id || s.id]
        if (d) {
          const sv = (v) => d.submitted ? v : (v || '-')
          rowData.push(sv(d.ca1), sv(d.ca2), sv(d.exam), sv(d.total))
        } else {
          rowData.push('-', '-', '-', '-')
        }
      })
      rowData.push(row.totalScore, row.average, formatPosition(row.position))
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
    XLSX.writeFile(wb, `${broadsheet.class?.name || 'Class'}_broadsheet.xlsx`)
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
          {myClass ? (
            <>
              <span className="text-yellow-600 font-medium">Class: {myClass.name}</span>
              <span className="text-gray-400 mx-2">|</span>
              <span className="text-gray-600">Teacher: {user?.firstName} {user?.lastName}</span>
            </>
          ) : 'Loading class...'}
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

      {publishedNotification && (
        <div className="fixed top-4 right-4 z-50 w-80 bg-white rounded-xl shadow-2xl border overflow-hidden"
          style={{ animation: 'fadeInUp 0.3s ease-out', borderColor: publishedNotification.type === 'review' ? '#FCD34D' : '#86EFAC' }}>
          <div className={`px-4 py-2.5 flex items-center justify-between ${publishedNotification.type === 'review' ? 'bg-yellow-500' : 'bg-green-600'}`}>
            <div className="flex items-center gap-2">
              {publishedNotification.type === 'review' ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-white font-semibold text-sm">{publishedNotification.type === 'review' ? 'Sent for Review' : 'Results Published'}</span>
            </div>
            <button onClick={() => setPublishedNotification(null)} className="text-white/70 hover:text-white transition text-lg leading-none">&times;</button>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <p className="text-xs text-gray-500">
              {publishedNotification.type === 'review'
                ? 'The exam officer has sent your results back for review:'
                : 'The exam officer has published your results for:'}
            </p>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-800">{publishedNotification.className}</p>
              <p className="text-xs text-gray-600">Session: <span className="font-medium">{publishedNotification.sessionName}</span></p>
              <p className="text-xs text-gray-600">Term: <span className="font-medium">{publishedNotification.termName}</span></p>
              <p className="text-xs text-gray-600">Students: <span className="font-medium">{publishedNotification.studentCount}</span></p>
              {publishedNotification.withheldCount > 0 && (
                <p className="text-xs text-red-600 font-medium">{publishedNotification.withheldCount} result(s) withheld</p>
              )}
              <p className="text-xs text-gray-400">{new Date(publishedNotification.publishedAt || publishedNotification.sentAt).toLocaleString()}</p>
            </div>
          </div>
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
          <select value={selectedSession} disabled
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed">
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
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6 overflow-hidden min-w-0" ref={broadsheetRef}>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h3 className="font-bold text-lg text-[#1B5E20]">Result Broadsheet</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => loadBroadsheet()} className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium transition">Refresh</button>
              {refreshing && <div className="w-3 h-3 border-2 border-[#1B5E20] border-t-transparent rounded-full animate-spin" />}
              <button onClick={downloadBroadsheetXLSX}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition">XLSX</button>
              <button onClick={downloadBroadsheetPDF}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition">PDF</button>
              <button onClick={printBroadsheet}
                className="bg-[#1B5E20] text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-[#2E7D32] transition">Print</button>
            </div>
          </div>

          {broadsheet ? (
            <>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search student by name..."
                  value={broadsheetSearch}
                  onChange={(e) => setBroadsheetSearch(e.target.value)}
                  className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent"
                />
              </div>
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
                    <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">GRAND TOTAL</th>
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
                  {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7 + broadsheet.subjects.length * 4} className="text-center py-12 text-gray-400">
                          {broadsheetSearch ? 'No students match your search.' : 'No students transferred yet. Use the Transfer Students tab to carry forward students.'}
                        </td>
                      </tr>
                    ) : filteredStudents.map((row, i) => (
                    <tr key={row.student.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                      <td className="p-2 text-center font-bold sticky left-0 bg-inherit z-10">{i + 1}</td>
                      <td className="p-2 font-medium whitespace-nowrap sticky left-[30px] bg-inherit z-10">{row.student.lastName} {row.student.firstName}</td>
                      <td className="p-2 text-center font-bold">{row.student.gender || '-'}</td>
                      {broadsheet.subjects.map(s => {
                        const d = row.details[s._id || s.id]
                        const showVal = (v) => d.submitted ? v : (v || '-')
                        const showTotal = (v) => d.submitted ? v : (v || '-')
                        return d ? (
                          <Fragment key={s._id || s.id}>
                            <td className="p-1 text-center">{showVal(d.ca1)}</td>
                            <td className="p-1 text-center">{showVal(d.ca2)}</td>
                            <td className="p-1 text-center">{showVal(d.exam)}</td>
                            <td className={`p-1 text-center font-bold border-r border-gray-300 ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{showTotal(d.total)}</td>
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
                      <td className="p-2 text-center font-bold">
                        {row.resultId ? (
                          editPositionId === row.resultId ? (
                            <input type="number" min="0" defaultValue={row.position || ''} autoFocus
                              onBlur={(e) => { setEditPositionId(null); handleSavePosition(row.resultId, e.target.value) }}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditPositionId(null) }}
                              className="w-14 px-1 py-0.5 border border-[#1B5E20] rounded text-xs text-center font-bold outline-none" />
                          ) : (
                            <button onClick={() => setEditPositionId(row.resultId)}
                              className="cursor-pointer hover:text-[#1B5E20] transition">
                              {formatPosition(row.position)}
                            </button>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-left text-xs max-w-[150px]">
                        {row.resultId ? (
                          <button onClick={() => setCommentModal({ show: true, resultId: row.resultId, comment: row.teacherComment || generateComment(row.totalScore, row.subjectCount), studentName: `${row.student.lastName} ${row.student.firstName}` })}
                            className="w-full text-left px-1 py-0.5 rounded text-xs bg-transparent hover:bg-gray-100 transition cursor-pointer truncate"
                            title="Click to edit comment">
                            {row.teacherComment || generateComment(row.totalScore, row.subjectCount)}
                          </button>
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
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-2">No students in this class for the current session.</p>
              <p className="text-sm text-gray-500">Go to the <button onClick={() => setActiveTab('transfer')} className="text-[#1B5E20] underline hover:text-yellow-600 font-medium">Transfer Students</button> tab to carry forward students from the previous session.</p>
            </div>
          )}
          {savingComment && <p className="text-xs text-blue-600 mt-2">Saving comment...</p>}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-lg text-[#1B5E20] mb-4">Attendance & School Settings</h3>

          <div className="grid sm:grid-cols-2 gap-4 mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No of times school Opened</label>
              <input type="number" min="0" value={daysOpen}
                onChange={(e) => setDaysOpen(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="e.g., 90" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resumption Date</label>
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
                    <th className="text-center p-2 font-medium text-gray-600">No of Times Present</th>
                    <th className="text-center p-2 font-medium text-gray-600">No of Times Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {broadsheet.students.map((row, i) => (
                    <tr key={row.student.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-center">{i + 1}</td>
                      <td className="p-2 font-medium whitespace-nowrap">{row.student.lastName} {row.student.firstName}</td>
                      <td className="p-2 text-center text-xs">{row.student.regNo}</td>
                      <td className="p-2 text-center">
                        <input type="number" min="0" max={daysOpen || undefined}
                          value={attendanceData[row.student.id]?.present || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const maxD = Number(daysOpen) || Infinity;
                            const num = val === '' ? '' : Math.min(Math.max(0, Number(val)), maxD);
                            const absent = (num !== '' && maxD < Infinity) ? String(maxD - num) : '';
                            setAttendanceData(prev => ({ ...prev, [row.student.id]: { ...prev[row.student.id], present: num, absent } }))
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm" placeholder="-" />
                      </td>
                      <td className="p-2 text-center">
                        <input type="number" min="0" readOnly
                          value={attendanceData[row.student.id]?.absent || ''}
                          className="w-20 px-2 py-1 border border-gray-200 rounded text-center text-sm bg-gray-50 text-gray-500 cursor-not-allowed" placeholder="-" />
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

      {commentModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCommentModal({ show: false, resultId: null, comment: '', studentName: '' })}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Teacher's Comment</h3>
              <button onClick={() => setCommentModal({ show: false, resultId: null, comment: '', studentName: '' })}
                className="text-gray-400 hover:text-gray-600 transition cursor-pointer text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Student: <strong>{commentModal.studentName}</strong>
            </p>
            <textarea value={commentModal.comment}
              onChange={(e) => setCommentModal(prev => ({ ...prev, comment: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm min-h-[120px] resize-y focus:border-[#1B5E20] outline-none"
              placeholder="Enter teacher comment..." />
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setCommentModal({ show: false, resultId: null, comment: '', studentName: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                Cancel
              </button>
              <button onClick={async () => {
                await handleSaveComment(commentModal.resultId, commentModal.comment)
                setCommentModal({ show: false, resultId: null, comment: '', studentName: '' })
              }}
                className="px-4 py-2 bg-[#1B5E20] text-white rounded-lg text-sm font-semibold hover:bg-[#2E7D32] transition cursor-pointer">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6 overflow-hidden min-w-0">
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

          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6 overflow-hidden min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">Students in {myClass?.name || 'Class'}</h3>
              <div className="flex flex-wrap gap-2">
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
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
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

              {broadsheet.students.length > 0 && broadsheet.students.every(s => s.status === 'SUBMITTED') ? (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
                  This broadsheet has already been submitted to the exam officer.
                </div>
              ) : broadsheet.students.some(s => s.status === 'SUBMITTED') ? (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    The exam officer sent this broadsheet back for review. Some results are still submitted. You can update scores and re-submit.
                  </div>
                  <button onClick={() => setShowSubmitModal(true)} disabled={submitting}
                    className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm">
                    {submitting ? 'Submitting...' : 'Re-Submit to Exam Officer'}
                  </button>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-3">
                    All scores will be locked and the broadsheet will be sent to the exam officer for review.
                    Positions and averages will be recalculated before submission.
                  </p>
                  <button onClick={() => setShowSubmitModal(true)} disabled={submitting}
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
      {activeTab === 'transfer' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-2">Transfer Students</h3>

          {!prevSessionId ? (
            <p className="text-gray-400 text-center py-8">No previous session found to transfer from.</p>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  Transferring students from <strong>{sessions.find(s => (s._id || s.id) === prevSessionId)?.name || 'previous session'}</strong>
                  {' '}to <strong>{sessions.find(s => (s._id || s.id) === selectedSession)?.name || 'current session'}</strong>.
                  Their names, exam numbers, and gender records will be carried forward into this session.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Transfer to Class</label>
                <select value={transferTargetClassId}
                  onChange={(e) => setTransferTargetClassId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  {(() => {
                    const currentOrder = myClass ? getClassSortOrder(myClass.name) : 0
                    return availableClasses
                      .filter(c => getClassSortOrder(c.name) > currentOrder)
                      .map(c => (
                        <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                      ))
                  })()}
                </select>
                <p className="text-xs text-gray-400 mt-1">Only higher classes are shown. The current class is excluded.</p>
              </div>

              {transferLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1B5E20]" />
                </div>
              ) : transferStudents.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No students found in the previous session for this class.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">
                      {transferStudents.filter(s => !s.alreadyTransferred).length} pending · {transferStudents.filter(s => s.alreadyTransferred).length} already transferred
                    </p>
                    <button onClick={() => setShowAllTransfer(v => !v)}
                      className="text-xs text-[#1B5E20] hover:underline font-medium cursor-pointer">
                      {showAllTransfer ? 'Show pending only' : 'Show all students'}
                    </button>
                  </div>
                  {(() => {
                    const visible = showAllTransfer ? transferStudents : transferStudents.filter(s => !s.alreadyTransferred)
                    return (
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="p-2 text-center font-medium text-gray-600 w-10">
                                <input type="checkbox"
                                  checked={selectedTransfer.size > 0 && selectedTransfer.size === transferStudents.filter(s => !s.alreadyTransferred).length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTransfer(new Set(transferStudents.filter(s => !s.alreadyTransferred).map(s => s._id || s.id)))
                                    } else {
                                      setSelectedTransfer(new Set())
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-[#1B5E20] focus:ring-[#1B5E20]" />
                              </th>
                              <th className="text-center p-2 font-medium text-gray-600 w-10">S/N</th>
                              <th className="text-left p-2 font-medium text-gray-600">Student's Name</th>
                              <th className="text-center p-2 font-medium text-gray-600 w-20">Gender</th>
                              <th className="text-center p-2 font-medium text-gray-600">Exam No</th>
                              <th className="text-center p-2 font-medium text-gray-600 w-24">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((s, i) => {
                              const sid = s._id || s.id
                              const alreadyTransferred = s.alreadyTransferred
                              return (
                                <tr key={sid} className={`border-t hover:bg-gray-50 ${alreadyTransferred ? 'bg-green-50' : ''}`}>
                                  <td className="p-2 text-center">
                                    <input type="checkbox"
                                      checked={selectedTransfer.has(sid)}
                                      disabled={alreadyTransferred}
                                      onChange={(e) => {
                                        const next = new Set(selectedTransfer)
                                        e.target.checked ? next.add(sid) : next.delete(sid)
                                        setSelectedTransfer(next)
                                      }}
                                      className="w-4 h-4 rounded border-gray-300 text-[#1B5E20] focus:ring-[#1B5E20] disabled:opacity-50" />
                                  </td>
                                  <td className="p-2 text-center text-xs">{i + 1}</td>
                                  <td className="p-2 font-medium whitespace-nowrap">{s.lastName} {s.firstName}</td>
                                  <td className="p-2 text-center">{s.gender || '-'}</td>
                                  <td className="p-2 text-center text-xs">{s.regNo}</td>
                                  <td className="p-2 text-center">
                                    {alreadyTransferred ? (
                                      <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2.5 py-1 rounded-full text-xs font-medium">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Transferred
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">Pending</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {selectedTransfer.size} of {transferStudents.filter(s => !s.alreadyTransferred).length} pending student(s) selected
                    </p>
                    <button onClick={() => {
                      if (selectedTransfer.size === 0) {
                        setTransferMessage({ type: 'error', text: 'Please select at least one student to transfer' })
                        return
                      }
                      setShowTransferConfirm(true)
                    }}
                      disabled={selectedTransfer.size === 0 || transferring}
                      className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-6 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm">
                      {transferring ? 'Transferring...' : 'Transfer Selected'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {transferMessage && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-[fadeInUp_0.3s_ease-out]">
              <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${transferMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {transferMessage.type === 'success'
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  }
                </svg>
                {transferMessage.text}
              </div>
            </div>
          )}
        </div>
      )}

      {showTransferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTransferConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Confirm Transfer</h3>
              <p className="text-sm text-gray-600 mb-3">
                You are about to transfer <strong>{selectedTransfer.size}</strong> student(s) from{' '}
                <strong>{sessions.find(s => (s._id || s.id) === prevSessionId)?.name || 'previous session'}</strong>{' '}
                to <strong>{sessions.find(s => (s._id || s.id) === selectedSession)?.name || 'current session'}</strong>.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5 text-left text-sm text-yellow-800">
                <p className="font-medium mb-1">What will happen:</p>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li>Each selected student's name, gender, and exam number will be carried forward</li>
                  <li>They will be registered in the current session under your class</li>
                  <li>Subject teachers will be able to enter scores for them</li>
                  <li>The broadsheet will update to reflect the new students</li>
                  <li>Students already transferred will not be duplicated</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowTransferConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                  Cancel
                </button>
                <button onClick={async () => {
                  setShowTransferConfirm(false)
                  setTransferring(true)
                  const studentIds = Array.from(selectedTransfer)
                  const fromClassId = myClass?.id || myClass?._id
                  const toClassId = transferTargetClassId
                  try {
                    await studentAPI.carryForward({
                      fromSessionId: prevSessionId,
                      toSessionId: selectedSession,
                      classMappings: [{ fromClassId, toClassId, studentIds }]
                    })
                    setTransferMessage({ type: 'success', text: `${studentIds.length} student(s) transferred successfully` })
                    setSelectedTransfer(new Set())
                    loadTransferSources()
                    loadBroadsheet(true)
                  } catch (err) {
                    setTransferMessage({ type: 'error', text: err.response?.data?.message || 'Error transferring students' })
                  } finally {
                    setTransferring(false)
                  }
                }}
                  className="flex-1 px-4 py-2.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg text-sm font-semibold transition cursor-pointer">
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
          <p className="text-white font-semibold text-sm">Submitting broadsheet...</p>
        </div>
      )}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSubmitModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-[#1B5E20] rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">Submit to Exam Officer</h3>
              <p className="text-sm text-gray-500 mb-4">This will lock all scores and send the broadsheet for review.</p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-green-700">{broadsheet?.students.length || 0}</p>
                  <p className="text-xs text-green-600">Students</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-blue-700">{broadsheet?.subjects.length || 0}</p>
                  <p className="text-xs text-blue-600">Subjects</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-yellow-700">{broadsheet?.students.filter(s => s.resultId).length || 0}</p>
                  <p className="text-xs text-yellow-600">With Scores</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSubmitModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleSubmit}
                  className="flex-1 px-4 py-2.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg text-sm font-semibold transition cursor-pointer">
                  Confirm Submit
                </button>
              </div>
            </div>
          </div>
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
