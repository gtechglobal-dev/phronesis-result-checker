import { useState, useEffect } from 'react'
import { classAPI, studentAPI, resultAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function ExamOfficerDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('students')
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [studentForm, setStudentForm] = useState({ regNo: '', firstName: '', lastName: '', classId: '', arm: 'A' })
  const [classForm, setClassForm] = useState({ name: '', level: 'PRIMARY' })
  const [subjectForm, setSubjectForm] = useState({ name: '', classId: '' })
  const [resultForm, setResultForm] = useState({ studentId: '', classId: '', sessionId: '', termId: '', scores: [] })
  const [sessionForm, setSessionForm] = useState({ name: '', isCurrent: false })
  const [termForm, setTermForm] = useState({ name: '', sessionId: '', isCurrent: false })
  const [teacherAssign, setTeacherAssign] = useState({ userId: '', classId: '' })
  const [positionsForm, setPositionsForm] = useState({ classId: '', sessionId: '', termId: '' })

  const tabs = [
    { id: 'students', label: 'Students' },
    { id: 'classes', label: 'Classes' },
    { id: 'subjects', label: 'Subjects' },
    { id: 'results', label: 'Results' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'teachers', label: 'Teachers' },
    { id: 'positions', label: 'Positions' }
  ]

  useEffect(() => {
    loadClasses()
    loadSessions()
  }, [])

  const loadClasses = async () => {
    try { const res = await classAPI.getAll(); setClasses(res.data) } catch (err) { console.error(err) }
  }
  const loadSessions = async () => {
    try { const res = await classAPI.getSessions(); setSessions(res.data) } catch (err) { console.error(err) }
  }
  const loadStudents = async (classId) => {
    try { setLoading(true); const res = await studentAPI.getAll({ classId }); setStudents(res.data) } catch (err) { console.error(err) } finally { setLoading(false) }
  }
  const loadSubjects = async (classId) => {
    try { const res = await classAPI.getSubjects(classId); setSubjects(res.data) } catch (err) { console.error(err) }
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault()
    try {
      await studentAPI.create(studentForm)
      setMessage('Student created successfully')
      setStudentForm({ regNo: '', firstName: '', lastName: '', classId: '', arm: 'A' })
      loadStudents(studentForm.classId)
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }
  const handleCreateClass = async (e) => {
    e.preventDefault()
    try {
      await classAPI.create(classForm)
      setMessage('Class created successfully')
      setClassForm({ name: '', level: 'PRIMARY' })
      loadClasses()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }
  const handleCreateSubject = async (e) => {
    e.preventDefault()
    try {
      await classAPI.createSubject(subjectForm)
      setMessage('Subject created successfully')
      setSubjectForm({ name: '', classId: '' })
      if (subjectForm.classId) loadSubjects(subjectForm.classId)
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }
  const handleCreateResult = async (e) => {
    e.preventDefault()
    try {
      await resultAPI.create(resultForm)
      setMessage('Result created successfully')
      setResultForm({ studentId: '', classId: '', sessionId: '', termId: '', scores: [] })
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }
  const handleCreateSession = async (e) => {
    e.preventDefault()
    try {
      await classAPI.createSession(sessionForm)
      setMessage('Session created successfully')
      setSessionForm({ name: '', isCurrent: false })
      loadSessions()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }
  const handleCreateTerm = async (e) => {
    e.preventDefault()
    try {
      await classAPI.createTerm(termForm)
      setMessage('Term created successfully')
      setTermForm({ name: '', sessionId: '', isCurrent: false })
      loadSessions()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }
  const handleAssignTeacher = async (e) => {
    e.preventDefault()
    try {
      await classAPI.assignTeacher(teacherAssign)
      setMessage('Teacher assigned successfully')
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }
  const handleUpdatePositions = async (e) => {
    e.preventDefault()
    try {
      await resultAPI.updatePositions(positionsForm)
      setMessage('Positions updated successfully')
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }

  const updateScore = (idx, field, value) => {
    const scores = [...resultForm.scores]
    const val = Math.min(Math.max(parseInt(value) || 0, 0), field === 'exam' ? 70 : 15)
    scores[idx] = { ...scores[idx], [field]: val }
    setResultForm({ ...resultForm, scores })
  }

  const addSubjectScore = () => {
    if (!resultForm.classId) return
    loadSubjects(resultForm.classId)
    setResultForm({ ...resultForm, scores: [...resultForm.scores, { subjectId: '', ca1: 0, ca2: 0, exam: 0 }] })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">Exam Officer Dashboard</h1>
        <p className="text-gray-500 text-sm sm:text-base">Welcome, {user?.firstName} {user?.lastName}</p>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-2 rounded mb-3 sm:mb-4 text-xs sm:text-sm flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="ml-2 font-bold text-lg">&times;</button>
        </div>
      )}

      <div className="flex flex-nowrap gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === t.id ? 'bg-[#1B5E20] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'students' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Add Student</h3>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <input type="text" placeholder="Registration No." required value={studentForm.regNo}
                onChange={(e) => setStudentForm({ ...studentForm, regNo: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First Name" required value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm" />
                <input type="text" placeholder="Last Name" required value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm" />
              </div>
              <select required value={studentForm.classId}
                onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" placeholder="Arm (A, B, C...)" value={studentForm.arm}
                onChange={(e) => setStudentForm({ ...studentForm, arm: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm" />
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">
                Add Student
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Students List</h3>
            <select onChange={(e) => loadStudents(e.target.value)} className="w-full mb-4 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Filter by Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c._count.students})</option>)}
            </select>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {students.map((s) => (
                <div key={s.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="truncate">
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="text-gray-500 text-xs ml-1 sm:ml-2">({s.regNo})</span>
                  </div>
                  <span className="text-[10px] sm:text-xs bg-[#1B5E20] text-white px-2 py-1 rounded self-start sm:self-center shrink-0">{s.class?.name} {s.arm}</span>
                </div>
              ))}
              {!loading && students.length === 0 && <p className="text-gray-400 text-xs sm:text-sm text-center py-4">No students found</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Add Class</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <select value={classForm.level}
                onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
              </select>
              <input type="text" placeholder="Class Name (e.g., Primary 1)" required value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm" />
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">
                Add Class
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">All Classes</h3>
            <div className="space-y-2">
              {classes.map((c) => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="font-medium">{c.name}</span>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{c._count.students} students</span>
                    <span>{c._count.subjects} subjects</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Add Subject</h3>
            <form onSubmit={handleCreateSubject} className="space-y-3">
              <select required value={subjectForm.classId}
                onChange={(e) => setSubjectForm({ ...subjectForm, classId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" placeholder="Subject Name" required value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm" />
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">
                Add Subject
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Subjects by Class</h3>
            <select onChange={(e) => loadSubjects(e.target.value)} className="w-full mb-3 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {subjects.map((s) => (
                <span key={s.id} className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs">{s.name}</span>
              ))}
              {subjects.length === 0 && <p className="text-gray-400 text-xs sm:text-sm">Select a class to view subjects</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Create Result</h3>
          <form onSubmit={handleCreateResult} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <select required value={resultForm.classId}
                onChange={(e) => setResultForm({ ...resultForm, classId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select required value={resultForm.sessionId}
                onChange={(e) => setResultForm({ ...resultForm, sessionId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Select Session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select required value={resultForm.termId}
                onChange={(e) => setResultForm({ ...resultForm, termId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Select Term</option>
                {sessions.filter(s => resultForm.sessionId && s.id === resultForm.sessionId).flatMap(s => s.terms).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <input type="text" placeholder="Student ID or Reg No." required value={resultForm.studentId}
                onChange={(e) => setResultForm({ ...resultForm, studentId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-700 text-sm">Subject Scores</h4>
                <button type="button" onClick={addSubjectScore} className="text-xs sm:text-sm bg-yellow-500 text-white px-2 sm:px-3 py-1 rounded hover:bg-yellow-600 transition">
                  + Add Subject
                </button>
              </div>
              {resultForm.scores.length > 0 && (
                <div className="space-y-2 sm:space-y-3">
                  {resultForm.scores.map((score, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-1 sm:gap-2 items-end">
                      <select required value={score.subjectId}
                        onChange={(e) => { const s = [...resultForm.scores]; s[idx].subjectId = e.target.value; setResultForm({ ...resultForm, scores: s }) }}
                        className="px-1.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm min-w-0">
                        <option value="">Subj</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name.length > 6 ? s.name.slice(0, 6)+'..' : s.name}</option>)}
                      </select>
                      <input type="number" placeholder="C1" min="0" max="15" value={score.ca1}
                        onChange={(e) => updateScore(idx, 'ca1', e.target.value)}
                        className="px-1 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm w-full" />
                      <input type="number" placeholder="C2" min="0" max="15" value={score.ca2}
                        onChange={(e) => updateScore(idx, 'ca2', e.target.value)}
                        className="px-1 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm w-full" />
                      <input type="number" placeholder="Ex" min="0" max="70" value={score.exam}
                        onChange={(e) => updateScore(idx, 'exam', e.target.value)}
                        className="px-1 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm w-full" />
                      <span className="text-[10px] sm:text-sm font-medium text-center">{score.ca1 + score.ca2 + score.exam}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={resultForm.scores.length === 0}
              className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm">
              Submit Result
            </button>
          </form>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">New Session</h3>
              <form onSubmit={handleCreateSession} className="space-y-3">
                <input type="text" placeholder="e.g., 2026/2027" required value={sessionForm.name}
                  onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm" />
                <label className="flex items-center gap-2 text-xs sm:text-sm">
                  <input type="checkbox" checked={sessionForm.isCurrent}
                    onChange={(e) => setSessionForm({ ...sessionForm, isCurrent: e.target.checked })} />
                  Set as current session
                </label>
                <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">
                  Create Session
                </button>
              </form>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">New Term</h3>
              <form onSubmit={handleCreateTerm} className="space-y-3">
                <select required value={termForm.sessionId}
                  onChange={(e) => setTermForm({ ...termForm, sessionId: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select Session</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="text" placeholder="e.g., 2nd Term" required value={termForm.name}
                  onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
                <label className="flex items-center gap-2 text-xs sm:text-sm">
                  <input type="checkbox" checked={termForm.isCurrent}
                    onChange={(e) => setTermForm({ ...termForm, isCurrent: e.target.checked })} />
                  Set as current term
                </label>
                <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">
                  Create Term
                </button>
              </form>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Sessions & Terms</h3>
            <div className="space-y-4">
              {sessions.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm sm:text-lg">{s.name}</span>
                    {s.isCurrent && <span className="bg-green-100 text-green-700 text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded">Current</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                    {s.terms.map((t) => (
                      <span key={t.id} className={`text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded ${t.isCurrent ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Assign Form Teacher</h3>
            <form onSubmit={handleAssignTeacher} className="space-y-3">
              <input type="text" placeholder="User ID" required value={teacherAssign.userId}
                onChange={(e) => setTeacherAssign({ ...teacherAssign, userId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <select required value={teacherAssign.classId}
                onChange={(e) => setTeacherAssign({ ...teacherAssign, classId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm">
                Assign Teacher
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Teacher Assignments</h3>
            <TeacherAssignments />
          </div>
        </div>
      )}

      {activeTab === 'positions' && (
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Update Student Positions</h3>
          <form onSubmit={handleUpdatePositions} className="space-y-3">
            <select required value={positionsForm.classId}
              onChange={(e) => setPositionsForm({ ...positionsForm, classId: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={positionsForm.sessionId}
              onChange={(e) => setPositionsForm({ ...positionsForm, sessionId: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select required value={positionsForm.termId}
              onChange={(e) => setPositionsForm({ ...positionsForm, termId: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Term</option>
              {sessions.filter(s => positionsForm.sessionId && s.id === positionsForm.sessionId).flatMap(s => s.terms).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-lg font-semibold transition text-sm">
              Update Positions
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function TeacherAssignments() {
  const [assignments, setAssignments] = useState([])
  useEffect(() => {
    classAPI.getTeachers().then(res => setAssignments(res.data)).catch(() => {})
  }, [])
  return (
    <div className="space-y-2">
      {assignments.map((a) => (
        <div key={a.id} className="p-3 bg-gray-50 rounded-lg flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-sm">
          <span className="font-medium">{a.user.firstName} {a.user.lastName}</span>
          <span className="text-xs text-gray-500">{a.class.name}</span>
        </div>
      ))}
      {assignments.length === 0 && <p className="text-gray-400 text-xs sm:text-sm text-center py-4">No assignments yet</p>}
    </div>
  )
}
