import { useState, useEffect } from 'react'
import { classAPI, studentAPI, resultAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function FormTeacherDashboard() {
  const { user } = useAuth()
  const [myClass, setMyClass] = useState(null)
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [sessions, setSessions] = useState([])
  const [activeTab, setActiveTab] = useState('students')
  const [message, setMessage] = useState('')

  const [studentForm, setStudentForm] = useState({ regNo: '', firstName: '', lastName: '', arm: 'A' })
  const [subjectForm, setSubjectForm] = useState({ name: '' })
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [results, setResults] = useState([])
  const [commentForm, setCommentForm] = useState({ resultId: '', comment: '' })
  const [scoreForms, setScoreForms] = useState({})

  useEffect(() => {
    loadTeacherData()
    loadSessions()
  }, [])

  const loadTeacherData = async () => {
    try {
      const res = await classAPI.getTeachers()
      const my = res.data.find(a => a.userId === user.id)
      if (my) {
        setMyClass(my.class)
        const stdRes = await studentAPI.getByClass(my.class.id)
        setStudents(stdRes.data)
        const subRes = await classAPI.getSubjects(my.class.id)
        setSubjects(subRes.data)
      }
    } catch (err) { console.error(err) }
  }

  const loadSessions = async () => {
    try { const res = await classAPI.getSessions(); setSessions(res.data) } catch (err) { console.error(err) }
  }

  const loadResults = async () => {
    if (!selectedSession || !selectedTerm || !myClass) return
    try {
      const res = await resultAPI.getFormTeacherResults({ sessionId: selectedSession, termId: selectedTerm })
      if (res.data.results) {
        setResults(res.data.results)
        setScoreForms({})
      }
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    if (selectedSession && selectedTerm) loadResults()
  }, [selectedSession, selectedTerm])

  const handleAddStudent = async (e) => {
    e.preventDefault()
    if (!myClass) return
    try {
      await studentAPI.create({ ...studentForm, classId: myClass.id })
      setMessage(`Student ${studentForm.firstName} ${studentForm.lastName} added`)
      setStudentForm({ regNo: '', firstName: '', lastName: '', arm: 'A' })
      const res = await studentAPI.getByClass(myClass.id)
      setStudents(res.data)
    } catch (err) { setMessage(err.response?.data?.message || 'Error adding student') }
  }

  const handleAddSubject = async (e) => {
    e.preventDefault()
    if (!myClass) return
    try {
      await classAPI.createSubject({ name: subjectForm.name, classId: myClass.id })
      setMessage(`Subject "${subjectForm.name}" added`)
      setSubjectForm({ name: '' })
      const res = await classAPI.getSubjects(myClass.id)
      setSubjects(res.data)
    } catch (err) { setMessage(err.response?.data?.message || 'Error adding subject') }
  }

  const handleSubmitResult = async (studentId) => {
    if (!myClass || !selectedSession || !selectedTerm) return
    const scores = scoreForms[studentId]
    if (!scores || scores.length === 0) return

    try {
      await resultAPI.create({ studentId, classId: myClass.id, sessionId: selectedSession, termId: selectedTerm, scores })
      setMessage('Result submitted')
      setScoreForms(prev => ({ ...prev, [studentId]: undefined }))
      loadResults()
    } catch (err) { setMessage(err.response?.data?.message || 'Error submitting result') }
  }

  const initScoreForm = (studentId) => {
    if (scoreForms[studentId]) return
    const scores = subjects.map(s => ({ subjectId: s.id, ca1: 0, ca2: 0, exam: 0 }))
    setScoreForms(prev => ({ ...prev, [studentId]: scores }))
  }

  const updateScore = (studentId, idx, field, value) => {
    const scores = [...(scoreForms[studentId] || [])]
    const val = Math.min(Math.max(parseInt(value) || 0, 0), field === 'exam' ? 70 : 15)
    scores[idx] = { ...scores[idx], [field]: val }
    setScoreForms(prev => ({ ...prev, [studentId]: scores }))
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    try {
      await resultAPI.addComment(commentForm.resultId, { teacherComment: commentForm.comment })
      setMessage('Comment added')
      setCommentForm({ resultId: '', comment: '' })
      loadResults()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }

  const existingResultStudentIds = new Set(results.map(r => r.studentId))

  const tabs = [
    { id: 'students', label: 'Students' },
    { id: 'subjects', label: 'Subjects' },
    { id: 'results', label: 'Submit Results' },
    { id: 'comments', label: 'Comments' }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">Form Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm sm:text-base">Welcome, {user?.firstName} {user?.lastName}</p>
        {myClass && <p className="text-xs sm:text-sm text-yellow-600 font-medium mt-1">Class: {myClass.name}</p>}
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

      {activeTab === 'students' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Register Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <input type="text" placeholder="Registration No." required value={studentForm.regNo}
                onChange={(e) => setStudentForm({ ...studentForm, regNo: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First Name" required value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
                <input type="text" placeholder="Last Name" required value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <input type="text" placeholder="Arm (A, B...)" value={studentForm.arm}
                onChange={(e) => setStudentForm({ ...studentForm, arm: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">Add Student</button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">My Students ({students.length})</h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {students.map((s) => (
                <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="text-gray-500 text-xs ml-2">({s.regNo})</span>
                  </div>
                  <span className="text-[10px] bg-[#1B5E20] text-white px-2 py-1 rounded">{s.arm}</span>
                </div>
              ))}
              {students.length === 0 && <p className="text-gray-400 text-xs text-center py-4">No students yet</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Add Subject</h3>
            <form onSubmit={handleAddSubject} className="space-y-3">
              <input type="text" placeholder="Subject Name" required value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">Add Subject</button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Subjects ({subjects.length})</h3>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <span key={s.id} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs">{s.name}</span>
              ))}
              {subjects.length === 0 && <p className="text-gray-400 text-xs">No subjects yet</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Submit Results</h3>
          <p className="text-xs sm:text-sm text-gray-500 mb-4">1st Test (CA1: 15), 2nd Test (CA2: 15), Exam (70), Total = 100</p>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
            <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Term</option>
              {sessions.filter(s => s.id === selectedSession).flatMap(s => s.terms).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {selectedSession && selectedTerm && subjects.length === 0 && (
            <p className="text-yellow-600 text-sm">Add subjects first in the Subjects tab</p>
          )}

          {students.filter(s => !existingResultStudentIds.has(s.id)).length === 0 && selectedSession && selectedTerm && (
            <p className="text-green-600 text-sm">All students have results for this session/term</p>
          )}

          {students.filter(s => !existingResultStudentIds.has(s.id)).map((student) => (
            <div key={student.id} className="border rounded-lg mb-4 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 font-medium text-sm flex justify-between items-center">
                <span>{student.firstName} {student.lastName} ({student.regNo})</span>
                {!scoreForms[student.id] ? (
                  <button onClick={() => initScoreForm(student.id)}
                    className="text-[10px] sm:text-xs bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition">Enter Scores</button>
                ) : (
                  <button onClick={() => handleSubmitResult(student.id)}
                    className="text-[10px] sm:text-xs bg-[#1B5E20] text-white px-3 py-1 rounded hover:bg-[#2E7D32] transition">Submit</button>
                )}
              </div>
              {scoreForms[student.id] && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm min-w-[400px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-2 font-medium">Subject</th>
                        <th className="text-center p-2 font-medium">1st Test (15)</th>
                        <th className="text-center p-2 font-medium">2nd Test (15)</th>
                        <th className="text-center p-2 font-medium">Exam (70)</th>
                        <th className="text-center p-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoreForms[student.id].map((score, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 font-medium whitespace-nowrap">{subjects.find(s => s.id === score.subjectId)?.name || 'Subject'}</td>
                          <td className="p-2">
                            <input type="number" min="0" max="15" value={score.ca1}
                              onChange={(e) => updateScore(student.id, idx, 'ca1', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" />
                          </td>
                          <td className="p-2">
                            <input type="number" min="0" max="15" value={score.ca2}
                              onChange={(e) => updateScore(student.id, idx, 'ca2', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" />
                          </td>
                          <td className="p-2">
                            <input type="number" min="0" max="70" value={score.exam}
                              onChange={(e) => updateScore(student.id, idx, 'exam', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" />
                          </td>
                          <td className="p-2 text-center font-bold">{score.ca1 + score.ca2 + score.exam}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'comments' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Results & Comments</h3>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
            <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Term</option>
              {sessions.filter(s => s.id === selectedSession).flatMap(s => s.terms).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 sm:p-3 font-medium">Student</th>
                    <th className="text-left p-2 sm:p-3 font-medium">Total</th>
                    <th className="text-left p-2 sm:p-3 font-medium">Average</th>
                    <th className="text-left p-2 sm:p-3 font-medium">Position</th>
                    <th className="text-left p-2 sm:p-3 font-medium">Comment</th>
                    <th className="text-left p-2 sm:p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.filter(r => !r.teacherComment).map((r) => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{r.student.firstName} {r.student.lastName}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap">{r.totalScore}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap">{r.average}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap">{r.position || '-'}</td>
                      <td className="p-2 sm:p-3 text-gray-400 italic text-[10px] sm:text-xs whitespace-nowrap">Pending</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap">
                        <button onClick={() => setCommentForm({ resultId: r.id, comment: '' })}
                          className="text-[10px] sm:text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-2 sm:px-3 py-1 rounded transition">Comment</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {results.length === 0 && selectedSession && selectedTerm && (
            <p className="text-gray-400 text-xs sm:text-sm text-center py-4">No results found</p>
          )}

          {commentForm.resultId && (
            <form onSubmit={handleSubmitComment} className="mt-4 sm:mt-6 p-4 sm:p-6 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-sm sm:text-base text-[#1B5E20] mb-2">Add Teacher Comment</h4>
              <textarea rows={3} required value={commentForm.comment}
                onChange={(e) => setCommentForm({ ...commentForm, comment: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                placeholder="Write your comment about the student's performance..." />
              <div className="flex gap-2 mt-2">
                <button type="submit" className="bg-[#1B5E20] text-white px-4 sm:px-6 py-2 rounded-lg font-medium hover:bg-[#2E7D32] transition text-sm">Submit</button>
                <button type="button" onClick={() => setCommentForm({ resultId: '', comment: '' })}
                  className="bg-gray-200 text-gray-700 px-4 sm:px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition text-sm">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
