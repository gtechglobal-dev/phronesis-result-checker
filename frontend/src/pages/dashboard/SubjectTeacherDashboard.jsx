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
  const [saveStatus, setSaveStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const timerRef = useRef(null)
  const pendingSaveRef = useRef(null)
  const dirtyRef = useRef(false)

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
    classAPI.getSubjects(selectedClassId, { params: { sessionId: selectedSession } }).then(res => setSubjects(Array.isArray(res.data) ? res.data : [])).catch(err => {
      console.error('Failed to load subjects:', err?.response?.data || err.message)
    })
  }, [selectedClassId, selectedSession])

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
    classAPI.getSubjects(selectedClassId, { params: { sessionId: selectedSession } }).then(res => setSubjects(Array.isArray(res.data) ? res.data : [])).catch(err => {
      console.error('refreshSubjects error:', err?.response?.data || err.message)
    })
  }, [selectedClassId, selectedSession])

  const refreshScores = useCallback((silent = true) => {
    if (selectedClassId && selectedSubjectId && selectedSession && selectedTerm) loadScores(silent)
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
  useSocketListener('scores:saved', () => refreshScores())
  useSocketListener('scores:submitted', () => refreshScores())

  const loadScores = async (silent) => {
    try {
      if (!silent) setLoading(true)
      const res = await subjectTeacherAPI.getScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      })
      setStudents(res.data.students || [])
      const loaded = res.data.scores || {}
      setScores(loaded)
      pendingSaveRef.current = loaded
      dirtyRef.current = false
      setSubmitted(res.data.submitted || false)
    } catch (err) {
      console.error('loadScores error:', err?.response?.data || err.message)
      if (!silent) showMessage('error', 'Failed to load scores')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const getEmptyScores = useCallback(() => {
    const empty = []
    for (const student of students) {
      const sid = student._id || student.id
      const form = scores[sid] || {}
      const ca1 = form.ca1
      const ca2 = form.ca2
      const exam = form.exam
      if (ca1 == null || ca1 === '' || (ca1 === 0 && !form._ca1Touched) ||
          ca2 == null || ca2 === '' || (ca2 === 0 && !form._ca2Touched) ||
          exam == null || exam === '' || (exam === 0 && !form._examTouched)) {
        empty.push({ id: sid, name: `${student.lastName} ${student.firstName}`, ca1, ca2, exam })
      }
    }
    return empty
  }, [students, scores])

  const updateScore = useCallback((studentId, field, value) => {
    if (submitted) return
    const max = field === 'exam' ? 60 : field === 'ca1' || field === 'ca2' ? 20 : 0
    const raw = value === '' ? '' : value
    const val = raw === '' ? '' : Math.min(Math.max(parseInt(raw) || 0, 0), max)
    const touchField = `_${field}Touched`
    const updated = {
      ...scores,
      [studentId]: {
        ...(scores[studentId] || {}),
        [field]: val === '' ? 0 : val,
        [touchField]: true
      }
    }
    setScores(updated)

    if (timerRef.current) clearTimeout(timerRef.current)
    pendingSaveRef.current = updated
    dirtyRef.current = true
    setSaveStatus('')
    timerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current
      if (!pending) return
      setSaveStatus('saving')
      const scoresArr = students
        .filter(s => pending[s._id || s.id] != null)
        .map(s => ({
          studentId: s._id || s.id,
          ca1: pending[s._id || s.id]?.ca1 || 0,
          ca2: pending[s._id || s.id]?.ca2 || 0,
          exam: pending[s._id || s.id]?.exam || 0
        }))
      subjectTeacherAPI.saveScores({
        sessionId: selectedSession,
        termId: selectedTerm,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        scores: scoresArr
      }).then(() => {
        dirtyRef.current = false
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(''), 2000)
      }).catch((err) => {
        console.error('Auto-save failed:', err?.response?.data || err.message)
        setSaveStatus('error')
      })
    }, 500)
  }, [scores, students, submitted, selectedSession, selectedTerm, selectedClassId, selectedSubjectId])

  const confirmSubmit = async () => {
    setShowConfirm(false)
    try {
      setSubmitting(true)

      if (timerRef.current) clearTimeout(timerRef.current)
      if (dirtyRef.current) {
        const pending = pendingSaveRef.current
        if (pending) {
          const scoresArr = students
            .filter(s => pending[s._id || s.id] != null)
            .map(s => ({
              studentId: s._id || s.id,
              ca1: pending[s._id || s.id]?.ca1 || 0,
              ca2: pending[s._id || s.id]?.ca2 || 0,
              exam: pending[s._id || s.id]?.exam || 0
            }))
          if (scoresArr.length) {
            try {
              await subjectTeacherAPI.saveScores({
                sessionId: selectedSession,
                termId: selectedTerm,
                classId: selectedClassId,
                subjectId: selectedSubjectId,
                scores: scoresArr
              })
            } catch (saveErr) {
              console.error('Save before submit failed:', saveErr?.response?.data || saveErr.message)
            }
          }
        }
        dirtyRef.current = false
      }

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

  const filteredStudents = searchQuery.trim()
    ? students.filter(s => {
        const q = searchQuery.toLowerCase()
        const name = `${s.lastName} ${s.firstName}`.toLowerCase()
        const regNo = (s.regNo || '').toLowerCase()
        return name.includes(q) || regNo.includes(q)
      })
    : students

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
            <div className="mb-4">
              <div className="relative max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or reg no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 mt-1">{filteredStudents.length} of {students.length} students</p>
              )}
            </div>
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-gray-500 text-sm">No students match "<span className="font-medium">{searchQuery}</span>"</p>
                <button onClick={() => setSearchQuery('')} className="text-xs text-[#1B5E20] mt-1 hover:underline">Clear search</button>
              </div>
            ) : (
            <>
            <div className="hidden sm:block relative overflow-x-auto max-h-[calc(100vh-320px)] border border-gray-200 rounded-lg">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="sticky top-0 z-20 bg-gray-50">
                  <tr>
                    <th className="sticky left-0 z-30 bg-gray-50 text-center p-3 font-medium text-gray-600 w-12 min-w-[48px]">S/N</th>
                    <th className="sticky left-[48px] z-30 bg-gray-50 text-left p-3 font-medium text-gray-600 min-w-[140px]">Student Name</th>
                    <th className="text-center p-3 font-medium text-gray-600 w-20">Exam No</th>
                    <th className="text-center p-3 font-medium text-gray-600 w-20">CA1 (20)</th>
                    <th className="text-center p-3 font-medium text-gray-600 w-20">CA2 (20)</th>
                    <th className="text-center p-3 font-medium text-gray-600 w-20">EXAM (60)</th>
                    <th className="text-center p-3 font-medium text-gray-600 w-16">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, idx) => {
                    const sid = student._id || student.id
                    const form = scores[sid] || {}
                    const ca1Empty = form.ca1 == null || form.ca1 === ''
                    const ca2Empty = form.ca2 == null || form.ca2 === ''
                    const examEmpty = form.exam == null || form.exam === ''
                    return (
                      <tr key={sid} className="border-t hover:bg-gray-50 group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 text-center p-3 text-gray-500">{idx + 1}</td>
                        <td className="sticky left-[48px] z-10 bg-white group-hover:bg-gray-50 p-3 font-medium">{student.lastName} {student.firstName}</td>
                        <td className="text-center p-3 text-gray-500 text-xs">{student.regNo}</td>
                        <td className="p-3 text-center">
                          <input type="number" min="0" max="20" value={form.ca1 === 0 || form.ca1 == null || form.ca1 === '' ? '' : form.ca1}
                            onChange={(e) => updateScore(sid, 'ca1', e.target.value)}
                            disabled={submitted}
                            className={`w-16 px-2 py-1.5 border rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${ca1Empty && !submitted ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`} />
                        </td>
                        <td className="p-3 text-center">
                          <input type="number" min="0" max="20" value={form.ca2 === 0 || form.ca2 == null || form.ca2 === '' ? '' : form.ca2}
                            onChange={(e) => updateScore(sid, 'ca2', e.target.value)}
                            disabled={submitted}
                            className={`w-16 px-2 py-1.5 border rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${ca2Empty && !submitted ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`} />
                        </td>
                        <td className="p-3 text-center">
                          <input type="number" min="0" max="60" value={form.exam === 0 || form.exam == null || form.exam === '' ? '' : form.exam}
                            onChange={(e) => updateScore(sid, 'exam', e.target.value)}
                            disabled={submitted}
                            className={`w-16 px-2 py-1.5 border rounded text-center text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${examEmpty && !submitted ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`} />
                        </td>
                        <td className="p-3 text-center font-bold">{getTotal(form)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="sticky left-0 z-10 bg-gray-50 p-3" colSpan="2"></td>
                    <td className="p-3 text-center text-xs text-gray-500" colSpan="5">Max: CA1=20, CA2=20, EXAM=60, Total=100</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="sm:hidden space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredStudents.map((student, idx) => {
                const sid = student._id || student.id
                const form = scores[sid] || {}
                const ca1Empty = form.ca1 == null || form.ca1 === ''
                const ca2Empty = form.ca2 == null || form.ca2 === ''
                const examEmpty = form.exam == null || form.exam === ''
                return (
                  <div key={sid} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white bg-[#1B5E20] rounded-full w-6 h-6 flex items-center justify-center">{idx + 1}</span>
                        <span className="font-semibold text-sm text-gray-800">{student.lastName} {student.firstName}</span>
                      </div>
                      <span className="text-xs text-gray-400">{student.regNo}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">CA1 <span className="text-gray-400">(20)</span></label>
                        <input type="number" min="0" max="20" placeholder="0"
                          value={form.ca1 === 0 || form.ca1 == null || form.ca1 === '' ? '' : form.ca1}
                          onChange={(e) => updateScore(sid, 'ca1', e.target.value)}
                          disabled={submitted}
                          className={`w-full px-3 py-2.5 border rounded-lg text-center text-sm font-medium disabled:bg-gray-100 disabled:cursor-not-allowed ${ca1Empty && !submitted ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">CA2 <span className="text-gray-400">(20)</span></label>
                        <input type="number" min="0" max="20" placeholder="0"
                          value={form.ca2 === 0 || form.ca2 == null || form.ca2 === '' ? '' : form.ca2}
                          onChange={(e) => updateScore(sid, 'ca2', e.target.value)}
                          disabled={submitted}
                          className={`w-full px-3 py-2.5 border rounded-lg text-center text-sm font-medium disabled:bg-gray-100 disabled:cursor-not-allowed ${ca2Empty && !submitted ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">EXAM <span className="text-gray-400">(60)</span></label>
                        <input type="number" min="0" max="60" placeholder="0"
                          value={form.exam === 0 || form.exam == null || form.exam === '' ? '' : form.exam}
                          onChange={(e) => updateScore(sid, 'exam', e.target.value)}
                          disabled={submitted}
                          className={`w-full px-3 py-2.5 border rounded-lg text-center text-sm font-medium disabled:bg-gray-100 disabled:cursor-not-allowed ${examEmpty && !submitted ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`} />
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="text-center">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                          <div className="text-lg font-bold text-[#1B5E20] py-1">{getTotal(form)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            </>
            )}
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                {saveStatus === 'saving' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full" />
                    Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Saved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Save failed
                  </span>
                )}
                <button onClick={() => setShowConfirm(true)} disabled={saving || submitting}
                  className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-8 py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm">
                  {submitting ? 'Submitting...' : saving ? 'Saving...' : 'Submit to Form Teacher'}
                </button>
              </div>
              {dirtyRef.current && saveStatus !== 'saving' && (
                <p className="text-xs text-amber-600">You have unsaved changes. They will auto-save shortly.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-yellow-600 text-sm text-center py-4">No students found in this class.</p>
        )}

      {showConfirm && (() => {
        const emptyScores = getEmptyScores()
        const hasEmpty = emptyScores.length > 0
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className={`mx-auto w-12 h-12 ${hasEmpty ? 'bg-red-100' : 'bg-yellow-100'} rounded-full flex items-center justify-center mb-4`}>
                {hasEmpty ? (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Confirm Submission</h3>
              <p className="text-sm text-gray-600 mb-1">You are about to submit scores for <strong>{subjects.find(s => (s._id || s.id) === selectedSubjectId)?.name || selectedSubjectId}</strong> to the Form Teacher.</p>
              
              {hasEmpty && (
                <div className="mt-3 mb-3 text-left bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-700 mb-2">The following students have missing scores (will be submitted as 0):</p>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-red-600 border-b border-red-200">
                          <th className="py-1 text-left font-medium">Student</th>
                          <th className="py-1 text-center font-medium">CA1</th>
                          <th className="py-1 text-center font-medium">CA2</th>
                          <th className="py-1 text-center font-medium">EXAM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emptyScores.map(s => (
                          <tr key={s.id} className="border-b border-red-100 last:border-0">
                            <td className="py-1 text-red-800">{s.name}</td>
                            <td className={`py-1 text-center font-medium ${(s.ca1 == null || s.ca1 === '') ? 'text-red-600' : 'text-gray-500'}`}>
                              {s.ca1 == null || s.ca1 === '' ? '-' : s.ca1}
                            </td>
                            <td className={`py-1 text-center font-medium ${(s.ca2 == null || s.ca2 === '') ? 'text-red-600' : 'text-gray-500'}`}>
                              {s.ca2 == null || s.ca2 === '' ? '-' : s.ca2}
                            </td>
                            <td className={`py-1 text-center font-medium ${(s.exam == null || s.exam === '') ? 'text-red-600' : 'text-gray-500'}`}>
                              {s.exam == null || s.exam === '' ? '-' : s.exam}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-sm text-red-600 font-semibold mb-4">Scores cannot be modified after submission.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  {hasEmpty ? 'Go Back & Fix' : 'Cancel'}
                </button>
                <button onClick={confirmSubmit}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition ${hasEmpty ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1B5E20] hover:bg-[#2E7D32]'}`}>
                  {hasEmpty ? 'Submit Anyway' : 'Confirm Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

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