import { useState, useEffect } from 'react'
import { resultAPI, classAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

function ResultView({ result, onClose }) {
  if (result.withheld || result._message) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center">
          <div className="text-5xl sm:text-6xl mb-4">&#128533;</div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1B5E20] mb-2">Result Withheld</h2>
          <p className="text-gray-600 text-sm sm:text-base">{result._message || 'Please contact the school to clear fees.'}</p>
          <button onClick={onClose} className="mt-6 bg-[#1B5E20] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#2E7D32] transition text-sm">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
        <div className="bg-[#1B5E20] text-white p-4 sm:p-6 rounded-t-2xl">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold">Academic Report</h2>
              <p className="text-yellow-400 text-sm sm:text-base truncate">{result.student?.firstName} {result.student?.lastName}</p>
              <p className="text-[10px] sm:text-sm text-gray-300">{result.class?.name || result.student?.class?.name} - {result.session.name} ({result.term.name})</p>
            </div>
            <button onClick={onClose} className="text-white hover:text-yellow-400 text-xl sm:text-2xl shrink-0">&times;</button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[400px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Subject</th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">1st Test</th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">2nd Test</th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Exam</th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Total</th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600 whitespace-nowrap">Grade</th>
                </tr>
              </thead>
              <tbody>
                {result.details?.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{d.subject.name}</td>
                    <td className="p-2 sm:p-3 text-center whitespace-nowrap">{d.ca1}</td>
                    <td className="p-2 sm:p-3 text-center whitespace-nowrap">{d.ca2}</td>
                    <td className="p-2 sm:p-3 text-center whitespace-nowrap">{d.exam}</td>
                    <td className="p-2 sm:p-3 text-center font-bold whitespace-nowrap">{d.total}</td>
                    <td className="p-2 sm:p-3 text-center whitespace-nowrap">
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${
                        d.grade === 'A' ? 'bg-green-100 text-green-700' :
                        d.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                        d.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{d.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="p-2 sm:p-3 text-xs sm:text-sm" colSpan="4">Total: {result.totalScore}</td>
                  <td className="p-2 sm:p-3 text-center text-xs sm:text-sm">Avg: {result.average}</td>
                  <td className="p-2 sm:p-3 text-center text-xs sm:text-sm">Pos: {result.position || '-'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {result.teacherComment && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-sm sm:text-base text-[#1B5E20] mb-1">Teacher's Comment</h4>
              <p className="text-gray-700 text-xs sm:text-sm">{result.teacherComment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ParentDashboard() {
  const { user } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [viewingResult, setViewingResult] = useState(null)
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')

  useEffect(() => {
    loadChildren()
    classAPI.getSessions().then(res => setSessions(res.data)).catch(() => {})
  }, [])

  const loadChildren = async () => {
    try {
      const res = await resultAPI.getParentChildrenResults()
      setChildren(res.data)
    } catch (err) { console.error(err) }
  }

  const getFilteredResults = (child) => {
    if (!child.results) return []
    return child.results.filter(r => {
      if (selectedSession && r.sessionId !== selectedSession) return false
      if (selectedTerm && r.termId !== selectedTerm) return false
      return true
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">Parent Dashboard</h1>
        <p className="text-gray-500 text-sm sm:text-base">Welcome, {user?.firstName} {user?.lastName}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6">
        <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
          className="w-full sm:w-auto px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
          <option value="">All Sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}
          className="w-full sm:w-auto px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
          <option value="">All Terms</option>
          {sessions.filter(s => !selectedSession || s.id === selectedSession).flatMap(s => s.terms).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">My Children</h3>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {children.map((child) => (
                <button key={child.id} onClick={() => setSelectedChild(child)}
                  className={`shrink-0 lg:w-full text-left p-3 rounded-lg transition ${
                    selectedChild?.id === child.id ? 'bg-[#1B5E20] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}>
                  <div className="font-medium text-sm whitespace-nowrap">{child.firstName} {child.lastName}</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 ${selectedChild?.id === child.id ? 'text-yellow-300' : 'text-gray-500'}`}>
                    {child.class?.name}
                  </div>
                </button>
              ))}
              {children.length === 0 && (
                <p className="text-gray-400 text-xs sm:text-sm text-center py-4 w-full">No children linked</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedChild ? (
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
              <div className="mb-4">
                <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">
                  {selectedChild.firstName} {selectedChild.lastName}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  {selectedChild.class?.name} - Reg No: {selectedChild.regNo}
                </p>
              </div>

              {getFilteredResults(selectedChild).length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {getFilteredResults(selectedChild).map((r) => (
                    <div key={r.id} className={`border rounded-lg p-3 sm:p-4 transition cursor-pointer ${
                      r.withheld ? 'border-red-300 hover:border-red-500' : 'hover:border-[#1B5E20]'
                    }`} onClick={() => setViewingResult(r)}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <div className="text-sm sm:text-base">
                          <span className="font-semibold">{r.session.name}</span>
                          <span className="text-gray-500 ml-1 sm:ml-2">- {r.term.name}</span>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4">
                          {r.withheld ? (
                            <span className="text-red-600 font-medium text-xs sm:text-sm">Fees Not Cleared</span>
                          ) : (
                            <>
                              <span className="text-xs sm:text-sm text-gray-500">Avg: {r.average}</span>
                              <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${
                                r.average >= 70 ? 'bg-green-100 text-green-700' :
                                r.average >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>Pos: {r.position || '-'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-xs sm:text-sm text-center py-6 sm:py-8">No results match your filter</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-6 flex items-center justify-center min-h-[200px] sm:min-h-[260px]">
              <div className="text-center text-gray-400">
                <p className="text-3xl sm:text-4xl mb-2">&#128070;</p>
                <p className="text-xs sm:text-sm">Select a child from the list to view their results</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingResult && <ResultView result={viewingResult} onClose={() => setViewingResult(null)} />}
    </div>
  )
}
