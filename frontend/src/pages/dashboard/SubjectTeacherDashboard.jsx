import { useState, useEffect } from 'react'
import { classAPI, studentAPI, resultAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const CLASS_OPTIONS = [
  'JSS1A', 'JSS1B', 'JSS2A', 'JSS2B', 'JSS3A', 'JSS3B',
  'SS1A', 'SS1B', 'SS2(SCIENCE)', 'SS2(ARTS)', 'SS3(SCIENCE)', 'SS3(ARTS)'
]

export default function SubjectTeacherDashboard() {
  useAuth()
  const [myClass, setMyClass] = useState(null)
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedClass, setSelectedClass] = useState('')

  const [scoreForms, setScoreForms] = useState({})

  const loadTeacherData = async () => {
    try {
      const res = await classAPI.getMyAssignment()
      if (res.data.class) {
        setMyClass(res.data.class)
        const [stdRes, subRes] = await Promise.all([
          studentAPI.getByClass(res.data.class.id),
          classAPI.getSubjects(res.data.class.id)
        ])
        setStudents(stdRes.data)
        setSubjects(subRes.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadSessions = async () => {
    try { const res = await classAPI.getSessions(); setSessions(res.data) } catch (err) { console.error(err) }
  }

  const loadStudentsByClass = async (className) => {
    if (!className) { setStudents([]); return }
    try {
      const res = await studentAPI.getAll({ className })
      setStudents(res.data)
    } catch (err) { console.error(err) }
  }

  const loadExistingScores = async () => {
    if (!selectedSession || !selectedTerm || !selectedSubject || !selectedClass) return
    try {
      const res = await resultAPI.getFormTeacherResults({ sessionId: selectedSession, termId: selectedTerm, className: selectedClass })
      if (res.data.results) {
        const forms = {}
        res.data.results.forEach(r => {
          const detail = r.details.find(d => d.subjectId === selectedSubject)
          if (detail) {
            forms[r.studentId] = { id: r.id, ca1: detail.ca1, ca2: detail.ca2, exam: detail.exam }
          }
        })
        setScoreForms(forms)
      } else {
        setScoreForms({})
      }
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    if (sessions.length > 0) {
      const currentSession = sessions.find(s => s.isCurrent) || sessions[0]
      setSelectedSession(currentSession.id)
      if (currentSession.terms && currentSession.terms.length > 0) {
        const currentTerm = currentSession.terms.find(t => t.isCurrent) || currentSession.terms[0]
        setSelectedTerm(currentTerm.id)
      }
    }
  }, [sessions])

  useEffect(() => {
    loadTeacherData()
    loadSessions()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      loadStudentsByClass(selectedClass)
    } else {
      setStudents([])
    }
  }, [selectedClass])

  useEffect(() => {
    loadExistingScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession, selectedTerm, selectedSubject, selectedClass])

  const updateScore = (studentId, field, value) => {
    const val = Math.min(Math.max(parseInt(value) || 0, 0), field === 'exam' ? 60 : 20)
    setScoreForms(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: val } }))
  }

  const getTotal = (form) => {
    if (!form) return 0
    return (form.ca1 || 0) + (form.ca2 || 0) + (form.exam || 0)
  }

  const handleSave = async () => {
    if (!selectedSession || !selectedTerm || !selectedSubject || !selectedClass) return
    setSaving(true)
    try {
      for (const student of students) {
        const form = scoreForms[student.id]
        if (form && (form.ca1 || form.ca2 || form.exam)) {
          const scores = [{ subjectId: selectedSubject, ca1: form.ca1 || 0, ca2: form.ca2 || 0, exam: form.exam || 0 }]
          if (form.id) {
            await resultAPI.addComment(form.id, { teacherComment: '' })
          } else {
            await resultAPI.create({ studentId: student.id, classId: selectedClass, sessionId: selectedSession, termId: selectedTerm, scores })
          }
        }
      }
      setMessage('Scores saved successfully')
      loadExistingScores()
    } catch (err) { setMessage(err.response?.data?.message || 'Error saving scores') }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'scores', label: 'Enter Scores' }
  ]

  const [activeTab, setActiveTab] = useState('scores')

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">Subject Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm sm:text-base mt-1">Welcome, Please carefully upload your subject scores</p>
        {myClass && <p className="text-xs sm:text-sm text-yellow-600 font-medium mt-1">Assigned Class: {myClass.name}</p>}
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-2 rounded mb-3 sm:mb-4 text-xs sm:text-sm flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="ml-2 font-bold text-lg">&times;</button>
        </div>
      )}

      <div className="flex flex-nowrap gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === t.id ? 'bg-[#1B5E20] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'scores' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Enter Scores</h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Session (Year)</label>
                <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} disabled
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 appearance-none cursor-not-allowed">
                  <option value="">Select Session</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
                <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} disabled
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 appearance-none cursor-not-allowed">
                  <option value="">Select Term</option>
                  {sessions.filter(s => s.id === selectedSession).flatMap(s => s.terms).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select Subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select Class</option>
                  {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={loadExistingScores} disabled={loading}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                  Load Scores
                </button>
              </div>
            </div>

            {selectedSession && selectedTerm && selectedSubject && selectedClass && students.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-12">S/N</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-gray-600">Student Name</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA1 (20)</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">CA2 (20)</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Exam (60)</th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600 w-24">Total (100)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => {
                      const form = scoreForms[student.id] || {}
                      return (
                        <tr key={student.id} className="border-t hover:bg-gray-50">
                          <td className="text-center p-2 sm:p-3 text-gray-500">{idx + 1}</td>
                          <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{student.firstName} {student.lastName}</td>
                          <td className="p-2 sm:p-3 text-center">
                            <input type="number" min="0" max="20" value={form.ca1 || ''}
                              onChange={(e) => updateScore(student.id, 'ca1', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" />
                          </td>
                          <td className="p-2 sm:p-3 text-center">
                            <input type="number" min="0" max="20" value={form.ca2 || ''}
                              onChange={(e) => updateScore(student.id, 'ca2', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" />
                          </td>
                          <td className="p-2 sm:p-3 text-center">
                            <input type="number" min="0" max="60" value={form.exam || ''}
                              onChange={(e) => updateScore(student.id, 'exam', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" />
                          </td>
                          <td className="p-2 sm:p-3 text-center font-bold text-lg">
                            {getTotal(form)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="p-2 sm:p-3" colSpan="2"></td>
                      <td className="p-2 sm:p-3 text-center">Max 20</td>
                      <td className="p-2 sm:p-3 text-center">Max 20</td>
                      <td className="p-2 sm:p-3 text-center">Max 60</td>
                      <td className="p-2 sm:p-3 text-center">Max 100</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {selectedSession && selectedTerm && selectedSubject && selectedClass && students.length === 0 && (
              <p className="text-yellow-600 text-sm text-center py-4">No students found for this class. Select a class first.</p>
            )}

            {(!selectedSession || !selectedTerm || !selectedSubject || !selectedClass) && (
              <p className="text-gray-400 text-xs sm:text-sm text-center py-4">Select Session, Term, Subject, and Class to enter scores</p>
            )}

            {(selectedSession && selectedTerm && selectedSubject && selectedClass && students.length > 0) && (
              <div className="mt-4 text-right">
                <button onClick={handleSave} disabled={saving}
                  className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-6 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm flex items-center gap-2 mx-auto">
                  Save All Scores
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}