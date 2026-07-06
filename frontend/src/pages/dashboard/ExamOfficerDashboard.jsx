import { useState, useEffect } from 'react'
import { classAPI, studentAPI, resultAPI, authAPI, pinAPI, subjectAssignmentAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function ExamOfficerDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('students')
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [message, setMessage] = useState('')
  const [pageLoading, setPageLoading] = useState(false)
  const [studentLoading, setStudentLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [classLoading, setClassLoading] = useState(false)
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [resultLoading, setResultLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [termLoading, setTermLoading] = useState(false)
  const [teacherLoading, setTeacherLoading] = useState(false)
  const [positionLoading, setPositionLoading] = useState(false)
  const [withholdLoading, setWithholdLoading] = useState(null)

  const [studentForm, setStudentForm] = useState({ regNo: '', firstName: '', lastName: '', classId: '', arm: 'A' })
  const [classForm, setClassForm] = useState({ name: '', level: 'PRIMARY' })
  const [subjectForm, setSubjectForm] = useState({ name: '', classId: '' })
  const [resultForm, setResultForm] = useState({ studentId: '', classId: '', sessionId: '', termId: '', scores: [] })
  const [sessionForm, setSessionForm] = useState({ name: '', isCurrent: false })
  const [termForm, setTermForm] = useState({ name: '', sessionId: '', isCurrent: false })
  const [teacherForm, setTeacherForm] = useState({ firstName: '', lastName: '', email: '', password: '', classIds: [] })
  const [positionsForm, setPositionsForm] = useState({ classId: '', sessionId: '', termId: '' })
  const [bulkStudents, setBulkStudents] = useState('')
  const [bulkClassId, setBulkClassId] = useState('')

  const [pinRegNo, setPinRegNo] = useState('')
  const [pinCount, setPinCount] = useState(1)
  const [pinList, setPinList] = useState([])
  const [pinLoading, setPinLoading] = useState(false)

  const [subjectAssignForm, setSubjectAssignForm] = useState({ userId: '', subjectId: '', classId: '' })
  const [subjectAssignList, setSubjectAssignList] = useState([])
  const [teachers, setTeachers] = useState([])
  const [subjectAssignLoading, setSubjectAssignLoading] = useState(false)

  const [withholdList, setWithholdList] = useState([])
  const [withholdSession, setWithholdSession] = useState('')
  const [withholdTerm, setWithholdTerm] = useState('')
  const [withholdClass, setWithholdClass] = useState('')

  const tabs = [
    { id: 'students', label: 'Students' },
    { id: 'classes', label: 'Classes' },
    { id: 'subjects', label: 'Subjects' },
    { id: 'results', label: 'Results' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'teachers', label: 'Teachers' },
    { id: 'withhold', label: 'Withhold' },
    { id: 'bulk', label: 'Bulk Upload' },
    { id: 'pins', label: 'Generate PIN' },
    { id: 'subject-assign', label: 'Subject Assignments' }
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

  const loadWithholdResults = async () => {
    if (!withholdClass || !withholdSession || !withholdTerm) return
    try {
      const res = await resultAPI.getFormTeacherResults({ classId: withholdClass, sessionId: withholdSession, termId: withholdTerm })
      if (res.data.results) setWithholdList(res.data.results)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    if (withholdClass && withholdSession && withholdTerm) loadWithholdResults()
  }, [withholdClass, withholdSession, withholdTerm])

  useEffect(() => {
    if (activeTab === 'subject-assign') {
      loadTeachers()
      loadSubjectAssignments()
    }
  }, [activeTab])

  const loadTeachers = async () => {
    try { const res = await authAPI.getTeachers(); setTeachers(res.data) } catch {}
  }

  const loadSubjectAssignments = async () => {
    try {
      const res = await subjectAssignmentAPI.list()
      setSubjectAssignList(res.data)
    } catch {}
  }

  const handleCreateSubjectAssignment = async (e) => {
    e.preventDefault()
    setSubjectAssignLoading(true)
    try {
      await subjectAssignmentAPI.create(subjectAssignForm)
      setMessage('Subject assignment created')
      setSubjectAssignForm({ userId: '', subjectId: '', classId: '' })
      loadSubjectAssignments()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setSubjectAssignLoading(false) }
  }

  const handleRemoveSubjectAssignment = async (id) => {
    if (!window.confirm('Remove this assignment?')) return
    try {
      await subjectAssignmentAPI.remove(id)
      setMessage('Assignment removed')
      loadSubjectAssignments()
    } catch {}
  }

  const handleCreateStudent = async (e) => {
    e.preventDefault()
    setStudentLoading(true)
    try {
      await studentAPI.create(studentForm)
      setMessage('Student created')
      setStudentForm({ regNo: '', firstName: '', lastName: '', classId: '', arm: 'A' })
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setStudentLoading(false) }
  }

  const handleBulkUpload = async (e) => {
    e.preventDefault()
    setBulkLoading(true)
    try {
      const lines = bulkStudents.trim().split('\n').filter(Boolean)
      const students = lines.map(line => {
        const [regNo, firstName, lastName, arm] = line.split(',').map(s => s.trim())
        return { regNo, firstName, lastName, classId: bulkClassId, arm: arm || 'A' }
      })
      const res = await studentAPI.bulkCreate({ students })
      setMessage(res.data.message)
      setBulkStudents('')
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setBulkLoading(false) }
  }

  const handleCreateClass = async (e) => {
    e.preventDefault()
    setClassLoading(true)
    try {
      await classAPI.create(classForm)
      setMessage('Class created')
      setClassForm({ name: '', level: 'PRIMARY' })
      loadClasses()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setClassLoading(false) }
  }

  const handleCreateSubject = async (e) => {
    e.preventDefault()
    setSubjectLoading(true)
    try {
      await classAPI.createSubject(subjectForm)
      setMessage('Subject created')
      setSubjectForm({ name: '', classId: '' })
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setSubjectLoading(false) }
  }

  const handleCreateResult = async (e) => {
    e.preventDefault()
    setResultLoading(true)
    try {
      await resultAPI.create(resultForm)
      setMessage('Result created')
      setResultForm({ studentId: '', classId: '', sessionId: '', termId: '', scores: [] })
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setResultLoading(false) }
  }

  const handleCreateSession = async (e) => {
    e.preventDefault()
    setSessionLoading(true)
    try {
      await classAPI.createSession(sessionForm)
      setMessage('Session created')
      setSessionForm({ name: '', isCurrent: false })
      loadSessions()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setSessionLoading(false) }
  }

  const handleCreateTerm = async (e) => {
    e.preventDefault()
    setTermLoading(true)
    try {
      await classAPI.createTerm(termForm)
      setMessage('Term created')
      setTermForm({ name: '', sessionId: '', isCurrent: false })
      loadSessions()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setTermLoading(false) }
  }

  const handleCreateTeacher = async (e) => {
    e.preventDefault()
    setTeacherLoading(true)
    try {
      await authAPI.createTeacher(teacherForm)
      setMessage('Teacher created')
      setTeacherForm({ firstName: '', lastName: '', email: '', password: '', classIds: [] })
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setTeacherLoading(false) }
  }

  const handleUpdatePositions = async (e) => {
    e.preventDefault()
    setPositionLoading(true)
    try {
      await resultAPI.updatePositions(positionsForm)
      setMessage('Positions updated')
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setPositionLoading(false) }
  }

  const handleWithhold = async (resultId, withheld) => {
    setWithholdLoading(resultId)
    try {
      await resultAPI.toggleWithhold(resultId, { withheld })
      setMessage(withheld ? 'Result withheld' : 'Result released')
      loadWithholdResults()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setWithholdLoading(null) }
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

  const loadSubjects = async (classId) => {
    try { const res = await classAPI.getSubjects(classId); setSubjects(res.data) } catch (err) { console.error(err) }
  }

  const loadStudents = async (classId) => {
    try { setPageLoading(true); const res = await studentAPI.getAll({ classId }); setStudents(res.data) } catch (err) { console.error(err) } finally { setPageLoading(false) }
  }

  const loadPins = async () => {
    try { const res = await pinAPI.list(); setPinList(res.data) } catch (err) { console.error(err) }
  }

  const handleGeneratePin = async (e) => {
    e.preventDefault()
    setPinLoading(true)
    try {
      await pinAPI.generate({ regNo: pinRegNo, count: pinCount })
      setMessage(`PIN(s) generated for ${pinRegNo}`)
      setPinRegNo('')
      setPinCount(1)
      loadPins()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
    finally { setPinLoading(false) }
  }

  useEffect(() => {
    if (activeTab === 'pins') loadPins()
  }, [activeTab])

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

      <div className="flex flex-nowrap gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === t.id ? 'bg-[#1B5E20] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{t.label}</button>
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
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" placeholder="Arm (A, B, C...)" value={studentForm.arm}
                onChange={(e) => setStudentForm({ ...studentForm, arm: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <button type="submit" disabled={studentLoading}
                className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {studentLoading && <Spinner />} {studentLoading ? 'Adding...' : 'Add Student'}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Students List</h3>
            <select onChange={(e) => loadStudents(e.target.value)} className="w-full mb-4 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Filter by Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {students.map((s) => (
                <div key={s.id} className="flex justify-between items-center gap-1 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="truncate">
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="text-gray-500 text-xs ml-1 sm:ml-2">({s.regNo})</span>
                  </div>
                  <span className="text-[10px] sm:text-xs bg-[#1B5E20] text-white px-2 py-1 rounded shrink-0">{s.class?.name} {s.arm}</span>
                </div>
              ))}
              {!pageLoading && students.length === 0 && <p className="text-gray-400 text-xs sm:text-sm text-center py-4">No students found</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Bulk Upload Students</h3>
          <form onSubmit={handleBulkUpload} className="space-y-3">
            <select required value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <textarea rows={8} required value={bulkStudents} onChange={(e) => setBulkStudents(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono"
              placeholder="regNo, FirstName, LastName, Arm&#10;PHS001, John, Doe, A&#10;PHS002, Jane, Smith, B" />
            <p className="text-[10px] sm:text-xs text-gray-400">One student per line: regNo, FirstName, LastName, Arm</p>
            <button type="submit" disabled={bulkLoading}
              className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              {bulkLoading && <Spinner />} {bulkLoading ? 'Uploading...' : 'Upload Students'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Add Class</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <select value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                <option value="MONTESSORI">Montessori</option>
                <option value="NURSERY">Nursery</option>
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
              </select>
              <input type="text" placeholder="Class Name (e.g., Primary 1)" required value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <button type="submit" disabled={classLoading}
                className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {classLoading && <Spinner />} {classLoading ? 'Adding...' : 'Add Class'}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">All Classes</h3>
            <div className="space-y-2">
              {classes.map((c) => (
                <div key={c.id} className="flex justify-between items-center gap-1 p-3 bg-gray-50 rounded-lg text-sm">
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
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <button type="submit" disabled={subjectLoading}
                className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {subjectLoading && <Spinner />} {subjectLoading ? 'Adding...' : 'Add Subject'}
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
                {sessions.filter(s => s.id === resultForm.sessionId).flatMap(s => s.terms).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <input type="text" placeholder="Student ID" required value={resultForm.studentId}
                onChange={(e) => setResultForm({ ...resultForm, studentId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-700 text-sm">Subject Scores</h4>
                <button type="button" onClick={addSubjectScore} className="text-xs sm:text-sm bg-yellow-500 text-white px-2 sm:px-3 py-1 rounded hover:bg-yellow-600 transition">+ Add Subject</button>
              </div>
              {resultForm.scores.map((score, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-1 sm:gap-2 items-end mb-2">
                  <select required value={score.subjectId} onChange={(e) => { const s = [...resultForm.scores]; s[idx].subjectId = e.target.value; setResultForm({ ...resultForm, scores: s }) }}
                    className="px-1.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm">
                    <option value="">Subj</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name.length > 6 ? s.name.slice(0, 6)+'..' : s.name}</option>)}
                  </select>
                  <input type="number" placeholder="C1" min="0" max="15" value={score.ca1} onChange={(e) => updateScore(idx, 'ca1', e.target.value)}
                    className="px-1 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm w-full" />
                  <input type="number" placeholder="C2" min="0" max="15" value={score.ca2} onChange={(e) => updateScore(idx, 'ca2', e.target.value)}
                    className="px-1 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm w-full" />
                  <input type="number" placeholder="Ex" min="0" max="70" value={score.exam} onChange={(e) => updateScore(idx, 'exam', e.target.value)}
                    className="px-1 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-[10px] sm:text-sm w-full" />
                  <span className="text-[10px] sm:text-sm font-medium text-center">{score.ca1 + score.ca2 + score.exam}</span>
                </div>
              ))}
            </div>
            <button type="submit" disabled={resultForm.scores.length === 0 || resultLoading}
              className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              {resultLoading && <Spinner />} {resultLoading ? 'Submitting...' : 'Submit Result'}
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
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
                <label className="flex items-center gap-2 text-xs sm:text-sm">
                  <input type="checkbox" checked={sessionForm.isCurrent} onChange={(e) => setSessionForm({ ...sessionForm, isCurrent: e.target.checked })} />
                  Set as current session
                </label>
                <button type="submit" disabled={sessionLoading}
                  className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                  {sessionLoading && <Spinner />} {sessionLoading ? 'Creating...' : 'Create Session'}
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
                  <input type="checkbox" checked={termForm.isCurrent} onChange={(e) => setTermForm({ ...termForm, isCurrent: e.target.checked })} />
                  Set as current term
                </label>
                <button type="submit" disabled={termLoading}
                  className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                  {termLoading && <Spinner />} {termLoading ? 'Creating...' : 'Create Term'}
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
                      <span key={t.id} className={`text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded ${t.isCurrent ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>{t.name}</span>
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
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Create Form Teacher</h3>
            <form onSubmit={handleCreateTeacher} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First Name" required value={teacherForm.firstName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
                <input type="text" placeholder="Last Name" required value={teacherForm.lastName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <input type="email" placeholder="Email (login)" required value={teacherForm.email}
                onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <input type="text" placeholder="Temporary Password" required value={teacherForm.password}
                onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              <select multiple value={teacherForm.classIds}
                onChange={(e) => setTeacherForm({ ...teacherForm, classIds: Array.from(e.target.selectedOptions, o => o.value) })}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm h-32">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[10px] sm:text-xs text-gray-400">Hold Ctrl/Cmd to select multiple classes</p>
              <button type="submit" disabled={teacherLoading}
                className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {teacherLoading && <Spinner />} {teacherLoading ? 'Creating...' : 'Create Teacher'}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Teacher Assignments</h3>
            <TeacherAssignments />
          </div>
        </div>
      )}

      {activeTab === 'withhold' && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Withhold / Release Results</h3>
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
            <select value={withholdClass} onChange={(e) => setWithholdClass(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={withholdSession} onChange={(e) => setWithholdSession(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={withholdTerm} onChange={(e) => setWithholdTerm(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
              <option value="">Select Term</option>
              {sessions.filter(s => s.id === withholdSession).flatMap(s => s.terms).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 sm:p-3 font-medium">Student</th>
                  <th className="text-left p-2 sm:p-3 font-medium">Total</th>
                  <th className="text-left p-2 sm:p-3 font-medium">Status</th>
                  <th className="text-left p-2 sm:p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {withholdList.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{r.student?.firstName} {r.student?.lastName}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">{r.totalScore}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${r.withheld ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {r.withheld ? 'Withheld' : 'Released'}
                      </span>
                    </td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">
                      <button onClick={() => handleWithhold(r.id, !r.withheld)} disabled={withholdLoading === r.id}
                        className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded text-white font-medium transition disabled:opacity-50 flex items-center gap-1 ${
                          withholdLoading === r.id ? 'bg-gray-400' : r.withheld ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                        }`}>
                        {withholdLoading === r.id && <Spinner small />}
                        {withholdLoading === r.id ? '...' : r.withheld ? 'Release' : 'Withhold'}
                      </button>
                    </td>
                  </tr>
                ))}
                {withholdList.length === 0 && <tr><td colSpan="4" className="text-center p-4 text-gray-400">Select class/session/term to view results</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pins' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Generate Result PIN</h3>
            <form onSubmit={handleGeneratePin} className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input type="text" required value={pinRegNo}
                  onChange={(e) => setPinRegNo(e.target.value.toUpperCase())}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., PHS/2025/001" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Number of PINs</label>
                <input type="number" required min="1" max="10" value={pinCount}
                  onChange={(e) => setPinCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <button type="submit" disabled={pinLoading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {pinLoading && <Spinner />} {pinLoading ? 'Generating...' : 'Generate PIN(s)'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">Generated PINs</h3>
              <button onClick={loadPins} className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium transition">
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600">PIN</th>
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600">Reg No</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600">Used</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600">Status</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pinList.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 sm:p-3 font-mono font-bold">{p.pin}</td>
                      <td className="p-2 sm:p-3">{p.regNo}</td>
                      <td className="p-2 sm:p-3 text-center">{p.usedCount}/{p.maxUses}</td>
                      <td className="p-2 sm:p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {p.isActive ? 'Active' : 'Expired'}
                        </span>
                      </td>
                      <td className="p-2 sm:p-3 text-center">
                        {p.isActive ? (
                          <button onClick={() => pinAPI.revoke(p.id).then(loadPins)}
                            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition">
                            Revoke
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pinList.length === 0 && (
                    <tr><td colSpan="5" className="text-center p-4 text-gray-400">No PINs generated yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subject-assign' && (
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Assign Teacher to Subject</h3>
            <form onSubmit={handleCreateSubjectAssignment} className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Teacher</label>
                <select required value={subjectAssignForm.userId}
                  onChange={(e) => setSubjectAssignForm({ ...subjectAssignForm, userId: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select Teacher</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class</label>
                <select required value={subjectAssignForm.classId}
                  onChange={(e) => setSubjectAssignForm({ ...subjectAssignForm, classId: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select required value={subjectAssignForm.subjectId}
                  onChange={(e) => setSubjectAssignForm({ ...subjectAssignForm, subjectId: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">Select Subject</option>
                  {classes.filter(c => c.id === subjectAssignForm.classId).flatMap(c => c.subjects || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {!subjectAssignForm.classId && <p className="text-xs text-gray-400 mt-1">Select a class first</p>}
              </div>
              <button type="submit" disabled={subjectAssignLoading}
                className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {subjectAssignLoading && <Spinner />} {subjectAssignLoading ? 'Assigning...' : 'Assign Subject'}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">Subject Assignments</h3>
              <button onClick={loadSubjectAssignments} className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium transition">Refresh</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600">Teacher</th>
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600">Class</th>
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600">Subject</th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectAssignList.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 sm:p-3 whitespace-nowrap font-medium">{a.user?.firstName} {a.user?.lastName}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap">{a.class?.name}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap">{a.subject?.name}</td>
                      <td className="p-2 sm:p-3 text-center">
                        <button onClick={() => handleRemoveSubjectAssignment(a.id)}
                          className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition">Remove</button>
                      </td>
                    </tr>
                  ))}
                  {subjectAssignList.length === 0 && (
                    <tr><td colSpan="4" className="text-center p-4 text-gray-400">No assignments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
              {sessions.filter(s => s.id === positionsForm.sessionId).flatMap(s => s.terms).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button type="submit" disabled={positionLoading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
              {positionLoading && <Spinner />} {positionLoading ? 'Updating...' : 'Update Positions'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function Spinner({ small }) {
  return (
    <svg className={`animate-spin ${small ? 'h-3 w-3' : 'h-4 w-4'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
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
        <div key={a.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center gap-1 text-sm">
          <span className="font-medium">{a.user.firstName} {a.user.lastName}</span>
          <span className="text-xs text-gray-500">{a.class.name}</span>
        </div>
      ))}
      {assignments.length === 0 && <p className="text-gray-400 text-xs sm:text-sm text-center py-4">No assignments yet</p>}
    </div>
  )
}
