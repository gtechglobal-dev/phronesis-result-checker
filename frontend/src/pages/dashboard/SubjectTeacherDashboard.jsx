import { useState, useEffect, useRef, useCallback } from 'react'
import { subjectTeacherAPI, classAPI } from '../../services/api'

export default function SubjectTeacherDashboard() {
  const [assignments, setAssignments] = useState([])
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [students, setStudents] = useState([])
  const [scores, setScores] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const timerRef = useRef(null)
  const pendingSaveRef = useRef(null)

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 4000)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [assignRes, sessRes] = await Promise.all([
          subjectTeacherAPI.getAssignment(),
          classAPI.getSessions()
        ])
        setAssignments(assignRes.data)
        setSessions(sessRes.data)
        if (assignRes.data.length) {
          setSelectedAssignment(assignRes.data[0])
        }
      } catch {
        showMessage('error', 'Failed to load assignment data')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (sessions.length > 0) {
      const current = sessions.find(s => s.isCurrent) || sessions[0]
      setSelectedSession(current.id)
      if (current.terms?.length) {
        setSelectedTerm(current.terms.find(t => t.isCurrent)?.id || current.terms[0].id)
      }
    }
  }, [sessions])

  useEffect(() => {
    if (!selectedAssignment || !selectedSession || !selectedTerm) return
    loadScores()
  }, [selectedAssignment, selectedSession, selectedTerm])

  const loadScores = async () => {
    try {
      setLoading(true)
      const res = await subjectTeacherAPI.getScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedAssignment.class.id,
        subjectId: selectedAssignment.subject.id
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
    const max = field === 'exam' ? 70 : field === 'ca1' || field === 'ca2' ? 20 : 0
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
        classId: selectedAssignment.class.id,
        subjectId: selectedAssignment.subject.id,
        scores: scoresArr
      }).then(() => {
        showMessage('success', 'Scores saved')
      }).catch((err) => {
        showMessage('error', err.response?.data?.message || 'Error saving scores')
      }).finally(() => setSaving(false))
    }, 1500)
  }, [scores, students, submitted, selectedSession, selectedTerm, selectedAssignment])

  const handleSubmit = async () => {
    if (!window.confirm('Submit scores? This action cannot be undone.')) return
    try {
      setSaving(true)
      await subjectTeacherAPI.submitScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedAssignment.class.id,
        subjectId: selectedAssignment.subject.id
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

      {!assignments.length ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          You have no subject assignments. Contact the exam officer.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            {assignments.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Assignment</label>
                <select value={selectedAssignment?.id || ''} onChange={(e) => {
                  const a = assignments.find(x => x.id === e.target.value)
                  setSelectedAssignment(a)
                }} className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.class.name} - {a.subject.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class</label>
                <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 font-medium text-[#1B5E20]">
                  {selectedAssignment?.class?.name || '-'}
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
                <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 font-medium text-[#1B5E20]">
                  {selectedAssignment?.subject?.name || '-'}
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Students</label>
                <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 font-medium">
                  {students.length} students
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Session</label>
                <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
                <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  {sessions.filter(s => s.id === selectedSession).flatMap(s => s.terms || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {submitted && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
                Scores already submitted. Cannot make further changes.
              </div>
            )}

            {students.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-12">S/N</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-gray-600">Student Name</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Reg No</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA1 (20)</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA2 (20)</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Exam (70)</th>
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
                            <input type="number" min="0" max="70" value={form.exam ?? ''}
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
            ) : (
              <p className="text-yellow-600 text-sm text-center py-4">No students found in this class.</p>
            )}

            {students.length > 0 && !submitted && (
              <div className="mt-6 flex justify-center gap-4">
                <button onClick={handleSubmit} disabled={saving}
                  className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm">
                  {saving ? 'Submitting...' : 'Submit Scores'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
