import { useState, useEffect, useRef, useCallback } from 'react'
import { subjectTeacherAPI, classAPI } from '../../services/api'
import { useSocketListener } from '../../context/SocketContext'

export default function SubjectTeacherDashboard() {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [students, setStudents] = useState([])
  const [scores, setScores] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedTermName, setSelectedTermName] = useState('')
  const [selectedSessionName, setSelectedSessionName] = useState('')
  const timerRef = useRef(null)
  const pendingSaveRef = useRef(null)

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 4000)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [classRes, sessRes] = await Promise.all([
          classAPI.getAll(),
          classAPI.getSessions()
        ])
        setClasses(classRes.data)
        setSessions(sessRes.data)
        if (sessRes.data.length) {
          const current = sessRes.data.find(s => s.isCurrent) || sessRes.data[0]
          setSelectedSession(current._id || current.id)
          setSelectedSessionName(current.name)
          if (current.terms?.length) {
            const t = current.terms.find(t => t.isCurrent) || current.terms[0]
            setSelectedTerm(t._id || t.id)
            setSelectedTermName(t.name)
          }
        }
      } catch {
        showMessage('error', 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedClassId) { setSubjects([]); return }
    classAPI.getSubjects(selectedClassId).then(res => setSubjects(Array.isArray(res.data) ? res.data : [])).catch(err => {
      console.error('Failed to load subjects:', err?.response?.data || err.message)
    })
  }, [selectedClassId])

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId || !selectedSession || !selectedTerm) {
      console.log('loadScores skip:', { selectedClassId, selectedSubjectId, selectedSession, selectedTerm })
      return
    }
    loadScores()
  }, [selectedClassId, selectedSubjectId, selectedSession, selectedTerm])

  const refreshClasses = useCallback(() => {
    classAPI.getAll().then(res => setClasses(res.data)).catch(() => {})
  }, [])

  const refreshSubjects = useCallback(() => {
    if (!selectedClassId) { setSubjects([]); return }
    classAPI.getSubjects(selectedClassId).then(res => setSubjects(Array.isArray(res.data) ? res.data : [])).catch(err => {
      console.error('refreshSubjects error:', err?.response?.data || err.message)
    })
  }, [selectedClassId])

  const refreshScores = useCallback(() => {
    if (selectedClassId && selectedSubjectId && selectedSession && selectedTerm) loadScores()
  }, [selectedClassId, selectedSubjectId, selectedSession, selectedTerm])

  const handleEntityUpdated = useCallback((data) => {
    if (data?.type === 'class') refreshClasses()
    if (data?.type === 'subject' || data?.type === 'subjectAssignment') refreshSubjects()
    if (!data?.type || data?.type === 'result') refreshScores()
    if (data?.type === 'subjectSubmission') {
      if (data.subjectId === selectedSubjectId && data.classId === selectedClassId) {
        showMessage('success', 'Subject reopened by form teacher. You can now edit scores.')
        refreshScores()
      }
    }
  }, [refreshClasses, refreshSubjects, refreshScores, selectedSubjectId, selectedClassId])

  useSocketListener('entity:updated', handleEntityUpdated)
  useSocketListener('scores:saved', refreshScores)
  useSocketListener('scores:submitted', refreshScores)

  const loadScores = async () => {
    try {
      setLoading(true)
      const res = await subjectTeacherAPI.getScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      })
      console.log('loadScores response:', { students: res.data.students?.length, scores: res.data.scores, submitted: res.data.submitted })
      setStudents(res.data.students || [])
      setScores(res.data.scores || {})
      setSubmitted(res.data.submitted || false)
    } catch (err) {
      console.error('loadScores error:', err?.response?.data || err.message)
      showMessage('error', 'Failed to load scores')
    } finally {
      setLoading(false)
    }
  }

  const updateScore = useCallback((studentId, field, value) => {
    if (submitted) return
    const max = field === 'exam' ? 60 : field === 'ca1' || field === 'ca2' ? 20 : 0
    const val = Math.min(Math.max(parseInt(value) || 0, 0), max)
    const updated = { ...scores, [studentId]: { ...(scores[studentId] || {}), [field]: val } }
    setScores(updated)

    if (timerRef.current) clearTimeout(timerRef.current)
    pendingSaveRef.current = updated
    timerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current
      if (!pending) return
      const scoresArr = students
        .filter(s => pending[s._id || s.id] != null)
        .map(s => ({
          studentId: s._id || s.id,
          ca1: pending[s._id || s.id]?.ca1 || 0,
          ca2: pending[s._id || s.id]?.ca2 || 0,
          exam: pending[s._id || s.id]?.exam || 0
        }))
      setSaving(true)
      subjectTeacherAPI.saveScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        scores: scoresArr
      }).then(() => {
        showMessage('success', 'Scores saved')
      }).catch((err) => {
        showMessage('error', err.response?.data?.message || 'Error saving scores')
      }).finally(() => setSaving(false))
    }, 100)
  }, [scores, students, submitted, selectedSession, selectedTerm, selectedClassId, selectedSubjectId])

  const confirmSubmit = async () => {
    setShowConfirm(false)
    try {
      setSubmitting(true)
      await subjectTeacherAPI.submitScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      })
      setSubmitted(true)
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error submitting scores')
    } finally {
      setSubmitting(false)
    }
  }

  const getTotal = (form) => (form?.ca1 || 0) + (form?.ca2 || 0) + (form?.exam || 0)

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1B5E20]" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">Subject Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Enter and submit your subject scores</p>
      </div>

      {message.text && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex justify-between items-center ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-2 font-bold text-lg">&times;</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Session</label>
            <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 font-medium text-[#1B5E20]">
              {selectedSessionName || '-'}
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
            <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 font-medium text-[#1B5E20]">
              {selectedTermName || '-'}
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class</label>
            <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedSubjectId('') }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Class</option>
              {classes.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" disabled={!selectedClassId}>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {!selectedClassId || !selectedSubjectId ? (
          <p className="text-gray-400 text-center py-8">Select a class and subject to begin.</p>
        ) : submitted ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
            Scores already submitted. Cannot make further changes. Contact the Form Teacher.
          </div>
        ) : students.length > 0 ? (
          <>
            <div className="overflow-auto max-h-[calc(100vh-320px)] border border-gray-200 rounded-lg">
              <table className="w-full text-xs sm:text-sm min-w-[700px]">
                <thead className="sticky top-0 z-20 bg-gray-50">
                  <tr>
                    <th className="sticky left-0 z-30 bg-gray-50 text-center p-2 sm:p-3 font-medium text-gray-600 w-12 min-w-[48px]">S/N</th>
                    <th className="sticky left-[48px] z-30 bg-gray-50 text-left p-2 sm:p-3 font-medium text-gray-600 min-w-[160px]">Student Name</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Exam No</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA1 (20)</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA2 (20)</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">EXAM (60)</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const sid = student._id || student.id
                    const form = scores[sid] || {}
                    return (
                      <tr key={sid} className="border-t hover:bg-gray-50 group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 text-center p-2 sm:p-3 text-gray-500">{idx + 1}</td>
                        <td className="sticky left-[48px] z-10 bg-white group-hover:bg-gray-50 p-2 sm:p-3 font-medium whitespace-nowrap">{student.lastName} {student.firstName}</td>
                        <td className="text-center p-2 sm:p-3 text-gray-500 text-xs">{student.regNo}</td>
                        <td className="p-2 sm:p-3 text-center">
                          <input type="number" min="0" max="20" value={form.ca1 || ''}
                            onChange={(e) => updateScore(sid, 'ca1', e.target.value)}
                            disabled={submitted}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <input type="number" min="0" max="20" value={form.ca2 || ''}
                            onChange={(e) => updateScore(sid, 'ca2', e.target.value)}
                            disabled={submitted}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <input type="number" min="0" max="60" value={form.exam || ''}
                            onChange={(e) => updateScore(sid, 'exam', e.target.value)}
                            disabled={submitted}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        </td>
                        <td className="p-2 sm:p-3 text-center font-bold">{getTotal(form)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="sticky left-0 z-10 bg-gray-50 p-2 sm:p-3" colSpan="2"></td>
                    <td className="p-2 sm:p-3 text-center text-xs text-gray-500" colSpan="5">Max: CA1=20, CA2=20, EXAM=60, Total=100</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <button onClick={() => setShowConfirm(true)} disabled={saving || submitting}
                className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm">
                {submitting ? 'Submitting...' : saving ? 'Saving...' : 'Submit to Form Teacher'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-yellow-600 text-sm text-center py-4">No students found in this class.</p>
        )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Confirm Submission</h3>
              <p className="text-sm text-gray-600 mb-1">You are about to submit scores for <strong>{subjects.find(s => (s._id || s.id) === selectedSubjectId)?.name || selectedSubjectId}</strong> to the Form Teacher.</p>
              <p className="text-sm text-red-600 font-semibold mb-6">Scores cannot be modified after submission.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={confirmSubmit}
                  className="flex-1 px-4 py-2.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg text-sm font-semibold transition">
                  Confirm Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitting && !showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#1B5E20]" />
            <p className="text-sm font-medium text-gray-700">Submitting scores...</p>
          </div>
        </div>
      )}

      {submitSuccess && (
        <div className="fixed bottom-12 sm:bottom-16 left-1/2 -translate-x-1/2 z-50 animate-[fadeInUp_0.3s_ease-out]">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Scores submitted successfully
          </div>
        </div>
      )}
      </div>
    </div>
  )
}