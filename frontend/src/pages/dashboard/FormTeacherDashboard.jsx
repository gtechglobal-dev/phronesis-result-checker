import { useState, useEffect } from 'react'
import { classAPI, studentAPI, resultAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

export default function FormTeacherDashboard() {
  const { user } = useAuth()
  const [myClass, setMyClass] = useState(null)
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [results, setResults] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [commentForm, setCommentForm] = useState({ resultId: '', comment: '' })
  const [message, setMessage] = useState('')

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
      }
    } catch (err) { console.error(err) }
  }

  const loadSessions = async () => {
    try { const res = await classAPI.getSessions(); setSessions(res.data) } catch (err) { console.error(err) }
  }

  const loadResults = async () => {
    if (!selectedSession || !selectedTerm) return
    try {
      const res = await resultAPI.getFormTeacherResults({ sessionId: selectedSession, termId: selectedTerm })
      if (res.data.results) setResults(res.data.results)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    if (selectedSession && selectedTerm) loadResults()
  }, [selectedSession, selectedTerm])

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    try {
      await resultAPI.addComment(commentForm.resultId, { teacherComment: commentForm.comment })
      setMessage('Comment added successfully')
      setCommentForm({ resultId: '', comment: '' })
      loadResults()
    } catch (err) { setMessage(err.response?.data?.message || 'Error') }
  }

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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-[10px] sm:text-sm text-gray-500 uppercase">My Class</h3>
          <p className="text-xl sm:text-2xl font-bold text-[#1B5E20] mt-1">{myClass?.name || '-'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-[10px] sm:text-sm text-gray-500 uppercase">Students</h3>
          <p className="text-xl sm:text-2xl font-bold text-[#1B5E20] mt-1">{students.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 col-span-2 sm:col-span-1">
          <h3 className="text-[10px] sm:text-sm text-gray-500 uppercase">Results</h3>
          <p className="text-xl sm:text-2xl font-bold text-[#1B5E20] mt-1">{results.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-5 sm:p-6 mb-6 sm:mb-8">
        <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">Class Students</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[300px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Reg No</th>
                <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Name</th>
                <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Arm</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 sm:p-3 whitespace-nowrap">{s.regNo}</td>
                  <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{s.firstName} {s.lastName}</td>
                  <td className="p-2 sm:p-3 whitespace-nowrap">{s.arm}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan="3" className="text-center p-4 sm:p-6 text-gray-400 text-xs sm:text-sm">No students in your class</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
            {sessions.filter(s => selectedSession === s.id).flatMap(s => s.terms).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[500px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Student</th>
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Total</th>
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Average</th>
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Position</th>
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Comment</th>
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Action</th>
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
                      <button
                        onClick={() => setCommentForm({ resultId: r.id, comment: '' })}
                        className="text-[10px] sm:text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-2 sm:px-3 py-1 rounded transition"
                      >
                        Comment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {commentForm.resultId && (
          <form onSubmit={handleSubmitComment} className="mt-4 sm:mt-6 p-4 sm:p-6 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="font-semibold text-sm sm:text-base text-[#1B5E20] mb-2">Add Teacher Comment</h4>
            <textarea
              rows={3}
              required
              value={commentForm.comment}
              onChange={(e) => setCommentForm({ ...commentForm, comment: e.target.value })}
              className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B5E20] outline-none text-sm"
              placeholder="Write your comment about the student's performance..."
            />
            <div className="flex gap-2 mt-2">
              <button type="submit" className="bg-[#1B5E20] text-white px-4 sm:px-6 py-2 rounded-lg font-medium hover:bg-[#2E7D32] transition text-sm">
                Submit
              </button>
              <button type="button" onClick={() => setCommentForm({ resultId: '', comment: '' })}
                className="bg-gray-200 text-gray-700 px-4 sm:px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        {results.length === 0 && (selectedSession && selectedTerm) && (
          <p className="text-gray-400 text-xs sm:text-sm text-center py-4 sm:py-6">No results found for this session/term</p>
        )}
      </div>
    </div>
  )
}
