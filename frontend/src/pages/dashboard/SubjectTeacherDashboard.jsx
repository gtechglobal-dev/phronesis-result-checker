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
          setSelectedSession(current.id)
          setSelectedSessionName(current.name)
          if (current.terms?.length) {
            const t = current.terms.find(t => t.isCurrent) || current.terms[0]
            setSelectedTerm(t.id)
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
    classAPI.getSubjects(selectedClassId).then(res => setSubjects(res.data)).catch(() => {})
  }, [selectedClassId])

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId || !selectedSession || !selectedTerm) return
    loadScores()
  }, [selectedClassId, selectedSubjectId, selectedSession, selectedTerm])

  const refreshScores = useCallback(() => {
    if (selectedClassId && selectedSubjectId && selectedSession && selectedTerm) loadScores()
  }, [selectedClassId, selectedSubjectId, selectedSession, selectedTerm])

  useSocketListener('entity:updated', refreshScores)
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
      setStudents(res.data.students || [])
      setScores(res.data.scores || {})
      setSubmitted(res.data.submitted || false)
    } catch {
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
      const scoresArr = students.map(s => ({
        studentId: s.id,
        ca1: pending[s.id]?.ca1 || 0,
        ca2: pending[s.id]?.ca2 || 0,
        exam: pending[s.id]?.exam || 0
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
    }, 1500)
  }, [scores, students, submitted, selectedSession, selectedTerm, selectedClassId, selectedSubjectId])

  const handleSubmit = async () => {
    if (!window.confirm('Submit scores? This action cannot be undone.')) return
    try {
      setSaving(true)
      await subjectTeacherAPI.submitScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      })
      setSubmitted(true)
      showMessage('success', 'Scores submitted successfully')
    } catch (err) {
      showMessage('error', err.response?.data?.message || 'Error submitting scores')
    } finally {
      setSaving(false)
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

      {saving && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-700" />
          Saving...
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
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" disabled={!selectedClassId}>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {!selectedClassId || !selectedSubjectId ? (
          <p className="text-gray-400 text-center py-8">Select a class and subject to begin.</p>
        ) : submitted ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
            Scores already submitted. Cannot make further changes.
          </div>
        ) : students.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-12">S/N</th>
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600">Student Name</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Reg No</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA1 (20)</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA2 (20)</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">EXAM (60)</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const form = scores[student.id] || {}
                    return (
                      <tr key={student.id} className="border-t hover:bg-gray-50">
                        <td className="text-center p-2 sm:p-3 text-gray-500">{idx + 1}</td>
                        <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{student.firstName} {student.lastName}</td>
                        <td className="text-center p-2 sm:p-3 text-gray-500 text-xs">{student.regNo}</td>
                        <td className="p-2 sm:p-3 text-center">
                          <input type="number" min="0" max="20" value={form.ca1 ?? ''}
                            onChange={(e) => updateScore(student.id, 'ca1', e.target.value)}
                            disabled={submitted}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <input type="number" min="0" max="20" value={form.ca2 ?? ''}
                            onChange={(e) => updateScore(student.id, 'ca2', e.target.value)}
                            disabled={submitted}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed" />
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <input type="number" min="0" max="60" value={form.exam ?? ''}
                            onChange={(e) => updateScore(student.id, 'exam', e.target.value)}
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
                    <td className="p-2 sm:p-3" colSpan="3"></td>
                    <td className="p-2 sm:p-3 text-center text-xs text-gray-500">Max 20</td>
                    <td className="p-2 sm:p-3 text-center text-xs text-gray-500">Max 20</td>
                    <td className="p-2 sm:p-3 text-center text-xs text-gray-500">Max 70</td>
                    <td className="p-2 sm:p-3 text-center text-xs text-gray-500">Max 110</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <button onClick={handleSubmit} disabled={saving}
                className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm">
                {saving ? 'Submitting...' : 'Submit Scores'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-yellow-600 text-sm text-center py-4">No students found in this class.</p>
        )}
      </div>
    </div>
  )
}