import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  classAPI,
  studentAPI,
  resultAPI,
  authAPI,
  pinAPI,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useSocketListener, useSocket } from '../../context/SocketContext'

const SUBJECTS_LIST = [
  "ENGLISH STUDIES", "MATHEMATICS", "GENERAL MATHEMATICS", "PHONICS",
  "READING", "READING READINESS", "HANDWRITING", "CREATIVE WRITING",
  "VERBAL REASONING", "QUANTITATIVE REASONING", "NUMERACY",
  "GENERAL KNOWLEDGE", "NIGERIAN LANGUAGE", "YORUBA", "IGBO", "HAUSA",
  "FRENCH", "ARABIC LANGUAGE", "BASIC SCIENCE", "INTERMEDIATE SCIENCE",
  "BIOLOGY", "CHEMISTRY", "PHYSICS", "FURTHER MATHEMATICS",
  "BASIC TECHNOLOGY", "DIGITAL TECHNOLOGIES", "BASIC DIGITAL LITERACY",
  "COMPUTER SCIENCE", "DATA PROCESSING", "PROGRAMMING",
  "ARTIFICIAL INTELLIGENCE", "CYBERSECURITY", "ROBOTICS",
  "COMPUTER HARDWARE AND GSM REPAIRS", "SOCIAL AND CITIZENSHIP STUDIES",
  "CIVIC EDUCATION", "CITIZENSHIP AND HERITAGE STUDIES",
  "NIGERIAN HISTORY", "HISTORY", "GEOGRAPHY", "GOVERNMENT", "ECONOMICS",
  "COMMERCE", "BUSINESS STUDIES", "FINANCIAL ACCOUNTING", "MARKETING",
  "OFFICE PRACTICE", "INSURANCE", "STORE MANAGEMENT", "SALESMANSHIP",
  "LITERATURE IN ENGLISH", "CHRISTIAN RELIGIOUS STUDIES",
  "ISLAMIC STUDIES", "CULTURAL AND CREATIVE ARTS", "FINE ARTS",
  "VISUAL ARTS", "MUSIC", "THEATRE ARTS", "PHYSICAL AND HEALTH EDUCATION",
  "HEALTH EDUCATION", "HOME ECONOMICS", "HOME MANAGEMENT",
  "FOOD AND NUTRITION", "AGRICULTURAL SCIENCE", "LIVESTOCK FARMING",
  "ANIMAL HUSBANDRY", "FISHERIES", "FORESTRY",
  "HORTICULTURE AND CROP PRODUCTION", "TECHNICAL DRAWING",
  "BUILDING CONSTRUCTION", "BLOCKLAYING, BRICKLAYING AND CONCRETING",
  "CARPENTRY AND JOINERY", "FURNITURE MAKING", "WOODWORK",
  "MACHINE WOODWORKING", "ELECTRICAL INSTALLATION AND MAINTENANCE",
  "ELECTRONICS", "AUTO MECHANICAL WORK", "AUTO ELECTRICAL WORK",
  "AUTO BODY REPAIR AND SPRAY PAINTING", "AUTO PARTS MERCHANDISING",
  "WELDING AND FABRICATION", "PLUMBING", "PAINTING AND DECORATION",
  "REFRIGERATION AND AIR CONDITIONING",
  "SOLAR PHOTOVOLTAIC INSTALLATION AND MAINTENANCE",
  "BEAUTY AND COSMETOLOGY", "FASHION DESIGN AND GARMENT MAKING",
  "GARMENT MAKING", "TEXTILE TRADE", "DYEING AND BLEACHING",
  "LEATHER GOODS MANUFACTURING AND REPAIR", "CATERING CRAFT PRACTICE",
  "TOURISM", "PRINTING CRAFT PRACTICE", "MINING", "PHOTOGRAPHY",
  "INTERIOR DECORATION", "ENTREPRENEURSHIP", "TRADE SUBJECT",
  "NATURE STUDY", "SENSORIAL ACTIVITIES", "PRACTICAL LIFE",
  "CULTURAL STUDIES", "SOCIAL HABITS", "HEALTH HABITS",
  "MORAL INSTRUCTION", "BIBLE KNOWLEDGE", "RHYMES", "STORYTELLING",
  "DRAWING", "PAINTING", "COLOURING", "ART AND CRAFT",
  "SPEECH AND DRAMA", "SWIMMING", "CHESS", "STEM"
]

export default function ExamOfficerDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "sessions";
  const setActiveTab = (tab) => setSearchParams({ tab });

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [termLoading, setTermLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [withholdLoading, setWithholdLoading] = useState(null);

  const [pendingResults, setPendingResults] = useState([]);
  const [pendingSession, setPendingSession] = useState("");
  const [pendingTerm, setPendingTerm] = useState("");
  const [pendingClass, setPendingClass] = useState("");
  const [pendingLoading, setPendingLoading] = useState(false);
  const [principalCommentText, setPrincipalCommentText] = useState({});
  const [principalSaving, setPrincipalSaving] = useState(null);

  const [resultForm, setResultForm] = useState({
    studentId: "",
    classId: "",
    sessionId: "",
    termId: "",
    scores: [],
  });
  const [sessionForm, setSessionForm] = useState({
    name: "",
    isCurrent: false,
  });
  const [termForm, setTermForm] = useState({
    name: "",
    sessionId: "",
    isCurrent: false,
  });
  const [teacherForm, setTeacherForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    classId: "",
  });
  const [pinCount, setPinCount] = useState(1);
  const [pinList, setPinList] = useState([]);
  const [pinLoading, setPinLoading] = useState(false);

  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [withholdList, setWithholdList] = useState([]);
  const [withholdSession, setWithholdSession] = useState("");
  const [withholdTerm, setWithholdTerm] = useState("");
  const [withholdClass, setWithholdClass] = useState("");

  const [manageResults, setManageResults] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageGroup, setManageGroup] = useState(null);
  const [manageClass, setManageClass] = useState(null);

  const [classRegForm, setClassRegForm] = useState({
    name: "",
    level: "PRIMARY",
  });
  const [classRegLoading, setClassRegLoading] = useState(false);
  const [subjectRegForm, setSubjectRegForm] = useState({
    name: "",
    classId: "",
  });
  const [subjectRegLoading, setSubjectRegLoading] = useState(false);
  const [regClassSubjects, setRegClassSubjects] = useState([]);
  const [regClassSubjectsLoading, setRegClassSubjectsLoading] = useState(false);
  const [bulkSubjectsText, setBulkSubjectsText] = useState("");
  const [bulkSubjectsLoading, setBulkSubjectsLoading] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  const refreshCurrentTab = useCallback(() => {
    if (activeTab === 'sessions') { loadClasses(); loadSessions() }
    else if (activeTab === 'results') loadManageResults()
    else if (activeTab === 'pending' && pendingSession && pendingTerm) loadPendingResults()
    else if (activeTab === 'pins') loadPins()
  }, [activeTab, pendingSession, pendingTerm])

  useSocketListener('entity:updated', refreshCurrentTab)
  useSocketListener('result:status', refreshCurrentTab)
  useSocketListener('result:withheld', refreshCurrentTab)
  useSocketListener('pin:generated', refreshCurrentTab)
  useSocketListener('pin:revoked', refreshCurrentTab)

  const tabs = [
    { id: "sessions", label: "Sessions" },
    { id: "results", label: "Results" },
    { id: "classes-reg", label: "Register Classes" },
    { id: "subjects-reg", label: "Register Subjects" },
    { id: "teachers", label: "Form Teachers" },
    { id: "pending", label: "Pending" },
    { id: "withhold", label: "Withhold" },
    { id: "pins", label: "Generate PIN" },
  ];

  useEffect(() => {
    loadClasses();
    loadSessions();
  }, []);

  const loadClasses = async () => {
    try {
      const res = await classAPI.getAll();
      setClasses(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  const loadSessions = async () => {
    try {
      const res = await classAPI.getSessions();
      setSessions(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  const loadManageResults = async () => {
    setManageLoading(true);
    try {
      const res = await resultAPI.getManageResults();
      setManageResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setManageLoading(false);
    }
  };

  const loadWithholdResults = async () => {
    if (!withholdClass || !withholdSession || !withholdTerm) return;
    try {
      const res = await resultAPI.getFormTeacherResults({
        classId: withholdClass,
        sessionId: withholdSession,
        termId: withholdTerm,
      });
      if (res.data.results) setWithholdList(res.data.results);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (withholdClass && withholdSession && withholdTerm) loadWithholdResults();
  }, [withholdClass, withholdSession, withholdTerm]);

  const loadPendingResults = async () => {
    if (!pendingSession || !pendingTerm) return;
    setPendingLoading(true);
    try {
      const params = { sessionId: pendingSession, termId: pendingTerm };
      if (pendingClass) params.classId = pendingClass;
      const res = await resultAPI.getPendingResults(params);
      setPendingResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleSavePrincipalComment = async (resultId) => {
    setPrincipalSaving(resultId);
    try {
      await resultAPI.updatePrincipalComment(resultId, {
        principalComment: principalCommentText[resultId] || "",
      });
      setMessage({ type: "success", text: "Principal comment saved" });
      loadPendingResults();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Server error",
      });
    } finally {
      setPrincipalSaving(null);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setSessionLoading(true);
    try {
      await classAPI.createSession(sessionForm);
      setMessage("Session created");
      setSessionForm({ name: "", isCurrent: false });
      loadSessions();
    } catch (err) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Server error",
      });
    } finally {
      setSessionLoading(false);
    }
  };

  const handleCreateTerm = async (e) => {
    e.preventDefault();
    setTermLoading(true);
    try {
      await classAPI.createTerm(termForm);
      setMessage("Term created");
      setTermForm({ name: "", sessionId: "", isCurrent: false });
      loadSessions();
    } catch (err) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Server error",
      });
    } finally {
      setTermLoading(false);
    }
  };

  const promptDelete = (type, id, label) => {
    setConfirmModal({
      show: true,
      title: `Delete ${type === "session" ? "Session" : "Term"}`,
      message: `Delete "${label}"? This will also remove all results linked to it.`,
      onConfirm: () => {
        setDeleteLoading(id);
        const apiCall =
          type === "session"
            ? classAPI.deleteSession(id)
            : classAPI.deleteTerm(id);
        apiCall
          .then(() => {
            setMessage({
              type: "success",
              text: `${type === "session" ? "Session" : "Term"} deleted`,
            });
            loadSessions();
          })
          .catch((err) =>
            setMessage({
              type: "error",
              text: err.response?.data?.message || "Server error",
            }),
          )
          .finally(() => setDeleteLoading(null));
      },
    });
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    setTeacherLoading(true);
    try {
      await authAPI.createTeacher(teacherForm);
      setMessage("Teacher created");
      setTeacherForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        classId: "",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Server error",
      });
    } finally {
      setTeacherLoading(false);
    }
  };

  const handleWithhold = async (resultId, withheld) => {
    setWithholdLoading(resultId);
    try {
      await resultAPI.toggleWithhold(resultId, { withheld });
      setMessage(withheld ? "Result withheld" : "Result released");
      loadWithholdResults();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Server error",
      });
    } finally {
      setWithholdLoading(null);
    }
  };

  const loadPins = async () => {
    try {
      const res = await pinAPI.list();
      setPinList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const [generatedPins, setGeneratedPins] = useState([]);
  const [showAllPins, setShowAllPins] = useState(false);
  const [showAllPinHistory, setShowAllPinHistory] = useState(false);
  const [pinMessage, setPinMessage] = useState(null);
  useEffect(() => {
    if (pinMessage) {
      const t = setTimeout(() => setPinMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [pinMessage]);
  const handleGeneratePin = async (e) => {
    e.preventDefault();
    setPinLoading(true);
    setGeneratedPins([]);
    setPinMessage(null);
    try {
      const res = await pinAPI.generate({ count: pinCount });
      setPinMessage({ type: "success", text: `${res.data.pins.length} PIN(s) generated` });
      setGeneratedPins(res.data.pins);
      setShowAllPins(false);
      setPinCount(1);
      loadPins();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Server error",
      });
    } finally {
      setPinLoading(false);
    }
  };

  const copyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    setGeneratedPins(prev => prev.filter(p => p.pin !== pin));
    setPinMessage({ type: "success", text: "PIN copied to clipboard" });
  };

  const copyAllPins = () => {
    const text = generatedPins.map((p) => p.pin).join("\n");
    navigator.clipboard.writeText(text);
    setGeneratedPins([]);
    setPinMessage({ type: "success", text: "All PINs copied to clipboard" });
  };

  useEffect(() => {
    if (activeTab === "pins") loadPins();
    if (activeTab === "results") loadManageResults();
    if (activeTab === "classes-reg" || activeTab === "subjects-reg")
      loadClasses();

  }, [activeTab]);

  return (
    <>
    <style>{`@keyframes fadeInUp{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1B5E20]">
          Exam Officer Dashboard
        </h1>
        <p className="text-gray-500 text-sm sm:text-base">
          Welcome, {user?.firstName} {user?.lastName}
        </p>
      </div>

      {message && (
        <div
          className={`px-3 sm:px-4 py-2 rounded mb-3 sm:mb-4 text-xs sm:text-sm flex justify-between items-center ${typeof message === "string" ? "bg-green-50 border border-green-200 text-green-700" : message.type === "error" ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}
        >
          <span>{typeof message === "string" ? message : message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="ml-2 font-bold text-lg"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex flex-nowrap gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
              activeTab === t.id
                ? "bg-[#1B5E20] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>



      {activeTab === "sessions" && (
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6 text-center">
            {sessions.length > 0 ? (
              (() => {
                const curSession =
                  sessions.find((s) => s.isCurrent) || sessions[0];
                const curTerm = curSession?.terms?.find((t) => t.isCurrent);
                return (
                  <>
                    {curTerm ? (
                      <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Active
                      </div>
                    ) : curSession.isCurrent ? (
                      <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full text-sm font-medium mb-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        Session Active - No Active Term
                      </div>
                    ) : null}
                    <p className="text-lg sm:text-xl font-bold text-gray-800">
                      {curSession.name}
                    </p>
                    {curTerm && (
                      <p className="text-sm text-gray-500">{curTerm.name}</p>
                    )}
                  </>
                );
              })()
            ) : (
              <p className="text-gray-400 text-sm sm:text-base py-4">
                No session created yet
              </p>
            )}

            <button
              onClick={() => setShowSessionForm(!showSessionForm)}
              className="mt-4 w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition text-sm"
            >
              {showSessionForm ? "Cancel" : "Create new session / Term"}
            </button>

            {sessions.length > 0 && (
              <button
                onClick={() => setShowRemoveModal(true)}
                className="mt-2 w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg text-sm hover:bg-red-100 transition"
              >
                Remove Session / Term
              </button>
            )}

            {showSessionForm && (
              <div className="mt-6 border-t pt-6 text-left">
                <form onSubmit={handleCreateSession} className="space-y-3 mb-6">
                  <h4 className="font-semibold text-sm text-gray-700">
                    New Session
                  </h4>
                  <input
                    type="text"
                    placeholder="e.g., 2026/2027"
                    required
                    value={sessionForm.name}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, name: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      checked={sessionForm.isCurrent}
                      onChange={(e) =>
                        setSessionForm({
                          ...sessionForm,
                          isCurrent: e.target.checked,
                        })
                      }
                    />
                    Set as current session
                  </label>
                  <button
                    type="submit"
                    disabled={sessionLoading}
                    className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {sessionLoading && <Spinner />}{" "}
                    {sessionLoading ? "Creating..." : "Create Session"}
                  </button>
                </form>

                {sessions.length > 0 && (
                  <form onSubmit={handleCreateTerm} className="space-y-3">
                    <h4 className="font-semibold text-sm text-gray-700 border-t pt-4">
                      New Term
                    </h4>
                    <select
                      required
                      value={termForm.sessionId}
                      onChange={(e) =>
                        setTermForm({
                          ...termForm,
                          sessionId: e.target.value,
                          name: "",
                        })
                      }
                      className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select Session</option>
                      {sessions.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    {(() => {
                      const existingTerms = termForm.sessionId
                        ? (
                            sessions.find((s) => s._id === termForm.sessionId)
                              ?.terms || []
                          ).map((t) => t.name)
                        : [];
                      const allTerms = [
                        "First Term",
                        "Second Term",
                        "Third Term",
                      ];
                      const availableTerms = allTerms.filter(
                        (t) => !existingTerms.includes(t),
                      );
                      return (
                        <select
                          required
                          value={termForm.name}
                          onChange={(e) =>
                            setTermForm({ ...termForm, name: e.target.value })
                          }
                          className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">
                            {availableTerms.length === 0
                              ? "All terms exist for this session"
                              : "Select Term"}
                          </option>
                          {availableTerms.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      );
                    })()}

                    <label className="flex items-center gap-2 text-xs sm:text-sm">
                      <input
                        type="checkbox"
                        checked={termForm.isCurrent}
                        onChange={(e) =>
                          setTermForm({
                            ...termForm,
                            isCurrent: e.target.checked,
                          })
                        }
                      />
                      Set as current term
                    </label>
                    <button
                      type="submit"
                      disabled={termLoading || termForm.name === ""}
                      className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                    >
                      {termLoading && <Spinner />}{" "}
                      {termLoading ? "Creating..." : "Create Term"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {sessions.filter((s) => !s.isCurrent).length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
              <h3 className="font-semibold text-sm text-gray-500 mb-3 text-center">
                Previous Sessions / Terms
              </h3>
              <div className="space-y-2">
                {sessions
                  .filter((s) => !s.isCurrent)
                  .reverse()
                  .map((s) => (
                    <div key={s._id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{s.name}</span>
                      </div>
                      {s.terms?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {s.terms.map((t) => (
                            <span
                              key={t._id}
                              className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showRemoveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowRemoveModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-gray-800">
                Remove Session / Term
              </h3>
              <button
                onClick={() => setShowRemoveModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">
                No sessions available.
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s._id}
                  className={`border rounded-lg p-3 mb-2 ${s.isCurrent ? "border-green-200 bg-green-50/50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{s.name}</span>
                      {s.isCurrent && (
                        <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => promptDelete("session", s._id, s.name)}
                      disabled={deleteLoading === s._id}
                      className="text-red-400 hover:text-red-600 transition disabled:opacity-30 text-xs border border-red-200 rounded px-2 py-1 hover:bg-red-50"
                    >
                      {deleteLoading === s._id ? <Spinner small /> : "Delete"}
                    </button>
                  </div>
                  {s.terms?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.terms.map((t) => (
                        <span
                          key={t._id}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500"
                        >
                          {t.name}
                          <button
                            onClick={() =>
                              promptDelete(
                                "term",
                                t._id,
                                `${s.name} - ${t.name}`,
                              )
                            }
                            disabled={deleteLoading === t._id}
                            className="text-red-400 hover:text-red-600 transition disabled:opacity-30 font-bold leading-none"
                            title="Delete term"
                          >
                            {deleteLoading === t._id ? <Spinner small /> : "×"}
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() =>
            setConfirmModal({
              show: false,
              message: "",
              onConfirm: null,
              title: "",
            })
          }
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h4 className="font-semibold text-base text-gray-800 mb-1">
              {confirmModal.title}
            </h4>
            <p className="text-sm text-gray-500 mb-5">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    message: "",
                    onConfirm: null,
                    title: "",
                  })
                }
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm?.();
                  setConfirmModal({
                    show: false,
                    message: "",
                    onConfirm: null,
                    title: "",
                  });
                }}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "results" && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
            Manage Results
          </h3>
          {manageLoading ? (
            <div className="text-center py-8">
              <Spinner />
            </div>
          ) : !manageGroup ? (
            <>
              {manageResults.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">
                  No approved results yet. Approve results from the Pending tab
                  first.
                </p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const groups = {};
                    manageResults.forEach((r) => {
                      const key = `${r.session?._id || r.session}|${r.term?._id || r.term}`;
                      if (!groups[key])
                        groups[key] = {
                          session: r.session,
                          term: r.term,
                          classes: new Set(),
                          results: [],
                        };
                      groups[key].classes.add(r.class?._id);
                      groups[key].results.push(r);
                    });
                    return Object.values(groups).map((g) => {
                      const classCount = g.classes.size;
                      const published = g.results.filter(
                        (r) => r.status === "PUBLISHED",
                      ).length;
                      return (
                        <button
                          key={`${g.session?._id}-${g.term?._id}`}
                          onClick={() => setManageGroup(g)}
                          className="w-full text-left border rounded-lg p-3 hover:bg-gray-50 transition flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium text-sm">
                              {g.session?.name} - {g.term?.name}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">
                              {classCount} class{classCount > 1 ? "es" : ""},{" "}
                              {g.results.length} student
                              {g.results.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              {published} published
                            </span>
                            <span className="text-gray-400">&rarr;</span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          ) : !manageClass ? (
            <div>
              <button
                onClick={() => setManageGroup(null)}
                className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium mb-3 flex items-center gap-1"
              >
                &larr; Back to Sessions
              </button>
              <p className="font-semibold text-sm text-gray-700 mb-3">
                {manageGroup.session?.name} - {manageGroup.term?.name}
              </p>
              <div className="space-y-2">
                {(() => {
                  const classMap = {};
                  manageGroup.results.forEach((r) => {
                    const cid = r.class?._id;
                    if (!classMap[cid])
                      classMap[cid] = { class: r.class, results: [] };
                    classMap[cid].results.push(r);
                  });
                  return Object.values(classMap).map((cg) => {
                    const withheld = cg.results.filter(
                      (r) => r.withheld,
                    ).length;
                    const notPublished = cg.results.filter(
                      (r) => r.status === "APPROVED",
                    ).length;
                    return (
                      <div
                        key={cg.class?._id}
                        className="border rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setManageClass(cg)}
                            className="font-medium text-sm hover:text-[#1B5E20] text-left"
                          >
                            {cg.class?.name}
                          </button>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">
                              {cg.results.length} students
                            </span>
                            {withheld > 0 && (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                {withheld} withheld
                              </span>
                            )}
                            {notPublished > 0 && (
                              <button
                                onClick={async () => {
                                  try {
                                    for (const r of cg.results) {
                                      if (r.status === "APPROVED")
                                        await resultAPI.updateStatus(
                                          r.id || r._id,
                                          { status: "PUBLISHED" },
                                        );
                                    }
                                    loadManageResults();
                                  } catch (err) {
                                    setMessage({
                                      type: "error",
                                      text: "Failed to publish",
                                    });
                                  }
                                }}
                                className="bg-[#1B5E20] text-white px-3 py-1 rounded hover:bg-[#2E7D32] transition"
                              >
                                Publish All
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setManageClass(null)}
                className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium mb-3 flex items-center gap-1"
              >
                &larr; Back to Classes
              </button>
              <p className="font-semibold text-sm text-gray-700 mb-3">
                {manageGroup.session?.name} - {manageGroup.term?.name} &gt;{" "}
                {manageClass.class?.name}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2 sm:p-3 font-medium text-gray-600">
                        Student
                      </th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                        Total
                      </th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                        Average
                      </th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                        Position
                      </th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                        Status
                      </th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                        Withheld
                      </th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageClass.results.map((r) => (
                      <tr
                        key={r.id || r._id}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="p-2 sm:p-3 font-medium whitespace-nowrap">
                          {r.student?.firstName} {r.student?.lastName}
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          {r.totalScore}
                        </td>
                        <td className="p-2 sm:p-3 text-center">{r.average}</td>
                        <td className="p-2 sm:p-3 text-center">
                          {r.position || "-"}
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.withheld ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}
                          >
                            {r.withheld ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <div className="flex gap-1 justify-center">
                            {r.status === "APPROVED" && (
                              <button
                                onClick={async () => {
                                  try {
                                    await resultAPI.updateStatus(
                                      r.id || r._id,
                                      { status: "PUBLISHED" },
                                    );
                                    loadManageResults();
                                  } catch (err) {
                                    setMessage({
                                      type: "error",
                                      text: "Failed to publish",
                                    });
                                  }
                                }}
                                className="text-[10px] px-2 py-1 rounded bg-[#1B5E20] text-white font-medium hover:bg-[#2E7D32] transition"
                              >
                                Publish
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                try {
                                  await resultAPI.toggleWithhold(
                                    r.id || r._id,
                                    { withheld: !r.withheld },
                                  );
                                  loadManageResults();
                                } catch (err) {
                                  setMessage({ type: "error", text: "Failed" });
                                }
                              }}
                              className={`text-[10px] px-2 py-1 rounded font-medium text-white transition ${r.withheld ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                            >
                              {r.withheld ? "Release" : "Withhold"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "classes-reg" && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
            Register Classes
          </h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setClassRegLoading(true);
              try {
                await classAPI.create(classRegForm);
                setClassRegForm({ name: "", level: "PRIMARY" });
                loadClasses();
    } catch (err) {
      setPinMessage({
        type: "error",
        text: err.response?.data?.message || "Server error",
      });
    } finally {
                setClassRegLoading(false);
              }
            }}
            className="mb-6"
          >
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Class Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Basic 1"
                  required
                  value={classRegForm.name}
                  onChange={(e) =>
                    setClassRegForm({ ...classRegForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Level
                </label>
                <select
                  value={classRegForm.level}
                  onChange={(e) =>
                    setClassRegForm({ ...classRegForm, level: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="MONTESSORI">Montessori</option>
                  <option value="NURSERY">Nursery</option>
                  <option value="PRIMARY">Primary</option>
                  <option value="SECONDARY">Secondary</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={classRegLoading}
                className="bg-[#1B5E20] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50 shrink-0"
              >
                {classRegLoading ? "..." : "Add"}
              </button>
            </div>
          </form>
          <div className="space-y-1.5">
            {classes.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm"
              >
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-[10px] text-gray-400 uppercase">
                    {c.level}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete class "${c.name}"?`)) return;
                    try {
                      await classAPI.deleteClass(c._id);
                      loadClasses();
                    } catch (err) {
                      setMessage({
                        type: "error",
                        text: err.response?.data?.message || "Error",
                      });
                    }
                  }}
                  className="text-red-400 hover:text-red-600 text-xs font-medium transition"
                >
                  Remove
                </button>
              </div>
            ))}
            {classes.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                No classes registered
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "subjects-reg" && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
            Register Subjects
          </h3>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Class
            </label>
            <select
              required
              value={subjectRegForm.classId}
              onChange={async (e) => {
                const cid = e.target.value;
                setSubjectRegForm({ name: "", classId: cid });
                setSubjectSearch("");
                setShowSubjectDropdown(false);
                setBulkSubjectsText("");
                if (cid) {
                  setRegClassSubjectsLoading(true);
                  try {
                    const res = await classAPI.getSubjects(cid);
                    setRegClassSubjects(res.data);
                  } catch (err) {
                    setMessage({ type: "error", text: err.response?.data?.message || "Failed to load subjects" });
                  } finally {
                    setRegClassSubjectsLoading(false);
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {subjectRegForm.classId && (
            <>
              <div className="border rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">
                  Add Single Subject
                </h4>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!subjectRegForm.name.trim()) return;
                    setShowSubjectDropdown(false);
                    setSubjectRegLoading(true);
                    try {
                      await classAPI.createSubject(subjectRegForm);
                      setSubjectRegForm({ name: "", classId: subjectRegForm.classId });
                      setSubjectSearch("");
                      setMessage({ type: "success", text: "Subject added successfully" });
                      try {
                        const res = await classAPI.getSubjects(subjectRegForm.classId);
                        setRegClassSubjects(res.data);
                      } catch (refreshErr) {
                        console.error("Failed to refresh subjects list", refreshErr);
                      }
                    } catch (err) {
                      setMessage({ type: "error", text: err.response?.data?.message || "Error adding subject" });
                    } finally {
                      setSubjectRegLoading(false);
                    }
                  }}
                  className="flex gap-2 items-end"
                >
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search subject..."
                      required
                      value={subjectRegForm.name}
                      onFocus={() => { setShowSubjectDropdown(true); setSubjectSearch(subjectRegForm.name) }}
                      onBlur={() => setTimeout(() => setShowSubjectDropdown(false), 200)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setShowSubjectDropdown(false) }}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSubjectSearch(val);
                        setSubjectRegForm({ ...subjectRegForm, name: val });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    {showSubjectDropdown && (() => {
                      const filtered = SUBJECTS_LIST.filter(s => !subjectSearch || s.includes(subjectSearch));
                      return (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filtered.map(s => (
                            <button type="button" key={s}
                                onClick={async () => {
                                  setShowSubjectDropdown(false);
                                  setSubjectRegLoading(true);
                                  try {
                                    await classAPI.createSubject({ name: s, classId: subjectRegForm.classId });
                                    setSubjectRegForm({ name: "", classId: subjectRegForm.classId });
                                    setSubjectSearch("");
                                    setMessage({ type: "success", text: "Subject added successfully" });
                                    try {
                                      const res = await classAPI.getSubjects(subjectRegForm.classId);
                                      setRegClassSubjects(res.data);
                                    } catch (refreshErr) {
                                      console.error("Failed to refresh subjects list", refreshErr);
                                    }
                                  } catch (err) {
                                    setMessage({ type: "error", text: err.response?.data?.message || "Error adding subject" });
                                  } finally {
                                    setSubjectRegLoading(false);
                                  }
                                }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                          {filtered.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    type="submit"
                    disabled={subjectRegLoading || !subjectRegForm.name.trim()}
                    className="bg-[#1B5E20] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50 shrink-0"
                  >
                    {subjectRegLoading ? "..." : "Add"}
                  </button>
                </form>
              </div>

              <div className="border rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">
                  Bulk Add Subjects
                </h4>
                <p className="text-[10px] text-gray-400 mb-2">
                  Separate subjects with commas
                </p>
                <textarea
                  rows={3}
                  value={bulkSubjectsText}
                  onChange={(e) => setBulkSubjectsText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono mb-3"
                  placeholder={"Mathematics, English Language, Basic Science"}
                />
                <button
                  onClick={async () => {
                    const names = bulkSubjectsText
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (names.length === 0) {
                      setMessage({
                        type: "error",
                        text: "Enter at least one subject",
                      });
                      return;
                    }
                    setBulkSubjectsLoading(true);
                    try {
                      const res = await classAPI.bulkCreateSubjects({
                        names,
                        classId: subjectRegForm.classId,
                      });
                      setMessage({
                        type: "success",
                        text: `${res.data.count} subject(s) added`,
                      });
                      setBulkSubjectsText("");
                      const subjectsRes = await classAPI.getSubjects(
                        subjectRegForm.classId,
                      );
                      setRegClassSubjects(subjectsRes.data);
                    } catch (err) {
                      setMessage({
                        type: "error",
                        text:
                          err.response?.data?.message ||
                          "Error adding subjects",
                      });
                    } finally {
                      setBulkSubjectsLoading(false);
                    }
                  }}
                  disabled={
                    bulkSubjectsLoading || !bulkSubjectsText.trim()
                  }
                  className="w-full bg-[#1B5E20] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50"
                >
                  {bulkSubjectsLoading
                    ? "Adding..."
                    : `Add ${bulkSubjectsText.split(",").filter((s) => s.trim()).length > 1 ? `${bulkSubjectsText.split(",").filter((s) => s.trim()).length} Subjects` : "Subjects"}`}
                </button>
              </div>
            </>
          )}

          <div className="space-y-1.5 border-t pt-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">
              Registered Subjects
            </h4>
            {subjectRegForm.classId ? (
              regClassSubjectsLoading ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  Loading...
                </p>
              ) : regClassSubjects.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  No subjects for this class
                </p>
              ) : (
                regClassSubjects.map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm"
                  >
                    <span className="font-medium">{s.name}</span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete subject "${s.name}"?`)) return;
                        try {
                          await classAPI.deleteSubject(s._id);
                          setMessage({ type: "success", text: "Subject removed" });
                          const res = await classAPI.getSubjects(
                            subjectRegForm.classId,
                          );
                          setRegClassSubjects(res.data);
                        } catch (err) {
                          setMessage({
                            type: "error",
                            text: err.response?.data?.message || "Error",
                          });
                        }
                      }}
                      className="text-red-400 hover:text-red-600 text-xs font-medium transition"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">
                Select a class to view its subjects
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "teachers" && (
        <>
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
                Create Form Teacher
              </h3>
              <form onSubmit={handleCreateTeacher} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="First Name"
                    required
                    value={teacherForm.firstName}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        firstName: e.target.value,
                      })
                    }
                    className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    required
                    value={teacherForm.lastName}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        lastName: e.target.value,
                      })
                    }
                    className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Username (login)"
                  required
                  value={teacherForm.email}
                  onChange={(e) =>
                    setTeacherForm({ ...teacherForm, email: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Temporary Password"
                  required
                  value={teacherForm.password}
                  onChange={(e) =>
                    setTeacherForm({ ...teacherForm, password: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  required
                  value={teacherForm.classId}
                  onChange={(e) =>
                    setTeacherForm({ ...teacherForm, classId: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Assign Class</option>
                  {classes.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={teacherLoading}
                  className="w-full bg-[#1B5E20] text-white py-2.5 rounded-lg font-semibold hover:bg-[#2E7D32] transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {teacherLoading && <Spinner />}{" "}
                  {teacherLoading ? "Creating..." : "Create Teacher"}
                </button>
              </form>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
                Assigned Form Teachers
              </h3>
              <TeacherAssignments setMessage={setMessage} />
            </div>
          </div>
          <SubjectTeacherPasswordSection setMessage={setMessage} />
        </>
      )}

      {activeTab === "pending" && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-lg text-[#1B5E20] mb-4">
            Pending Results (Submitted by Form Teachers)
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
            <select
              value={pendingSession}
              onChange={(e) => setPendingSession(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select Session</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={pendingTerm}
              onChange={(e) => setPendingTerm(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select Term</option>
              {sessions
                .filter((s) => s._id === pendingSession)
                .flatMap((s) => s.terms)
                .map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <select
              value={pendingClass}
              onChange={(e) => setPendingClass(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={loadPendingResults}
              disabled={!pendingSession || !pendingTerm || pendingLoading}
              className="bg-[#1B5E20] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50"
            >
              {pendingLoading ? "Loading..." : "Load"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600">
                    Student
                  </th>
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600">
                    Class
                  </th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                    Total
                  </th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                    Pos
                  </th>
                  <th className="text-left p-2 sm:p-3 font-medium text-gray-600">
                    Principal's Remark
                  </th>
                  <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingResults.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 sm:p-3 font-medium whitespace-nowrap">
                      {r.student?.firstName} {r.student?.lastName}
                    </td>
                    <td className="p-2 sm:p-3">{r.class?.name}</td>
                    <td className="p-2 sm:p-3 text-center font-bold">
                      {r.totalScore}
                    </td>
                    <td className="p-2 sm:p-3 text-center">
                      {r.position || "-"}
                    </td>
                    <td className="p-2 sm:p-3">
                      <input
                        type="text"
                        value={
                          principalCommentText[r.id] ?? r.principalComment ?? ""
                        }
                        onChange={(e) =>
                          setPrincipalCommentText((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                        placeholder="Add principal remark..."
                      />
                    </td>
                    <td className="p-2 sm:p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleSavePrincipalComment(r.id)}
                          disabled={principalSaving === r.id}
                          className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded bg-[#1B5E20] text-white font-medium hover:bg-[#2E7D32] transition disabled:opacity-50"
                        >
                          {principalSaving === r.id ? "..." : "Save"}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await resultAPI.updateStatus(r.id, {
                                status: "APPROVED",
                              });
                              setMessage({
                                type: "success",
                                text: "Result approved",
                              });
                              loadPendingResults();
                            } catch (err) {
                              setMessage({
                                type: "error",
                                text: "Failed to approve",
                              });
                            }
                          }}
                          className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded bg-yellow-500 text-white font-medium hover:bg-yellow-600 transition"
                        >
                          Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingResults.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center p-4 text-gray-400">
                      No pending results found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "withhold" && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
            Withhold / Release Results
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
            <select
              value={withholdClass}
              onChange={(e) => setWithholdClass(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={withholdSession}
              onChange={(e) => setWithholdSession(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select Session</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={withholdTerm}
              onChange={(e) => setWithholdTerm(e.target.value)}
              className="px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select Term</option>
              {sessions
                .filter((s) => s._id === withholdSession)
                .flatMap((s) => s.terms)
                .map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
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
                    <td className="p-2 sm:p-3 font-medium whitespace-nowrap">
                      {r.student?.firstName} {r.student?.lastName}
                    </td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">
                      {r.totalScore}
                    </td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${r.withheld ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                      >
                        {r.withheld ? "Withheld" : "Released"}
                      </span>
                    </td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">
                      <button
                        onClick={() => handleWithhold(r.id, !r.withheld)}
                        disabled={withholdLoading === r.id}
                        className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded text-white font-medium transition disabled:opacity-50 flex items-center gap-1 ${
                          withholdLoading === r.id
                            ? "bg-gray-400"
                            : r.withheld
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {withholdLoading === r.id && <Spinner small />}
                        {withholdLoading === r.id
                          ? "..."
                          : r.withheld
                            ? "Release"
                            : "Withhold"}
                      </button>
                    </td>
                  </tr>
                ))}
                {withholdList.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center p-4 text-gray-400">
                      Select class/session/term to view results
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "pins" && (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
                Generate Result PIN
              </h3>
              <form onSubmit={handleGeneratePin} className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Number of PINs
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={pinCount}
                    onChange={(e) =>
                      setPinCount(
                        Math.min(50, Math.max(1, parseInt(e.target.value) || 1)),
                      )
                    }
                    className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pinLoading}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {pinLoading && <Spinner />}{" "}
                  {pinLoading ? "Generating..." : "Generate PIN(s)"}
                </button>
              </form>

              {generatedPins.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-700">Generated PINs</h4>
                    <button
                      onClick={copyAllPins}
                      className="text-xs text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy All
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {generatedPins.slice(0, showAllPins ? generatedPins.length : 2).map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                        <span className="font-mono font-bold text-sm text-gray-800">{p.pin}</span>
                        <button
                          onClick={() => copyPin(p.pin)}
                          className="text-yellow-600 hover:text-yellow-700 p-1"
                          title="Copy PIN"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {generatedPins.length > 2 && (
                      <button
                        onClick={() => setShowAllPins(!showAllPins)}
                        className="w-full text-xs text-yellow-600 hover:text-yellow-700 font-medium py-1.5 transition"
                      >
                        {showAllPins ? "Show Less" : "Show more"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">
                Generated PINs
              </h3>
              <button
                onClick={loadPins}
                className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium transition"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 sm:p-3 font-medium text-gray-600">
                      PIN
                    </th>
                      <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                        Used
                      </th>
                      <th className="text-left p-2 sm:p-3 font-medium text-gray-600">
                        Used By
                      </th>
                    <th className="text-center p-2 sm:p-3 font-medium text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pinList.slice(0, showAllPinHistory ? pinList.length : 2).map((p) => (
                    <tr key={p.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 sm:p-3 font-mono font-bold flex items-center gap-2">
                        <span>{p.pin}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(p.pin); setPinMessage({ type: 'success', text: 'PIN copied to clipboard' }) }}
                          className="text-yellow-600 hover:text-yellow-700 p-0.5 shrink-0"
                          title="Copy PIN"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </td>
                      <td className="p-2 sm:p-3 text-center">
                        {p.usedCount}/{p.maxUses}
                      </td>
                      <td className="p-2 sm:p-3 text-left text-[10px] sm:text-xs text-gray-600 max-w-[200px]" title={p.usedBy?.map(u => u.regNo).join(', ')}>
                        {p.usedBy?.length > 0
                          ? [...new Set(p.usedBy.map(u => u.regNo))].join(', ')
                          : '—'}
                      </td>
                      <td className="p-2 sm:p-3 text-center">
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete PIN "${p.pin}"? This cannot be undone.`)) return;
                            try {
                              await pinAPI.deletePin(p._id || p.id);
                              loadPins();
                              setPinMessage({ type: 'success', text: 'PIN deleted' });
                            } catch (err) {
                              setPinMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete PIN' });
                            }
                          }}
                          className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pinList.length > 2 && (
                    <tr>
                      <td colSpan="4" className="text-center">
                        <button
                          onClick={() => setShowAllPinHistory(!showAllPinHistory)}
                          className="text-xs text-yellow-600 hover:text-yellow-700 font-medium py-2 transition w-full"
                        >
                          {showAllPinHistory ? "Show Less" : "Show more"}
                        </button>
                      </td>
                    </tr>
                  )}
                  {pinList.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center p-4 text-gray-400">
                        No PINs generated yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pinMessage && (
        <div className="fixed bottom-12 sm:bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-xs sm:text-sm font-medium flex items-center gap-2 pointer-events-auto"
          style={{ animation: 'fadeInUp 0.3s ease-out' }}
          style={{ backgroundColor: pinMessage.type === "error" ? "#FEE2E2" : "#D1FAE5", border: `1px solid ${pinMessage.type === "error" ? "#FCA5A5" : "#6EE7B7"}`, color: pinMessage.type === "error" ? "#991B1B" : "#065F46" }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {pinMessage.type === "error"
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            }
          </svg>
          <span>{pinMessage.text}</span>
        </div>
      )}

    </div>
    </>
  );
}

function Spinner({ small }) {
  return (
    <svg
      className={`animate-spin ${small ? "h-3 w-3" : "h-4 w-4"}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function SubjectTeacherPasswordSection({ setMessage }) {
  const [newPassword, setNewPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [pwFetching, setPwFetching] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const loadData = async () => {
    setPwFetching(true);
    try {
      const pwRes = await authAPI.getSubjectTeacherPasswordHash();
      setCurrentPassword(pwRes.data?.password || "");
    } catch {
      setCurrentPassword("");
    } finally {
      setPwFetching(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      return;
    }
    setUpdating(true);
    try {
      await authAPI.updateSubjectTeacherPassword({ password: newPassword });
      setMessage({ type: "success", text: "Subject teacher password updated" });
      setNewPassword("");
      setShowPw(false);
      await loadData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Error updating password",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-white rounded-xl shadow-md p-5 sm:p-6 max-w-lg">
        <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
          Subject Teacher Shared Password
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 mb-3">
          All subject teachers use this shared password to log in.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              readOnly
              value={currentPassword || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-10 bg-gray-50"
              placeholder={pwFetching ? "Loading..." : "No password set"}
            />
            {currentPassword && (
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide" : "Show"}
              >
                {showPw ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-6 0-9-9-9-9a9.97 9.97 0 015.05-5.05M9.88 9.88A3 3 0 0012 15a3 3 0 001.12-.22" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.88 9.88L6 6m12 12l-3.88-3.88M16.12 16.12A3 3 0 0012 9a3 3 0 00-.88.13" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              New Password
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new shared password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            onClick={handleUpdatePassword}
            disabled={updating}
            className="bg-[#1B5E20] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition shrink-0 disabled:opacity-50"
          >
            {updating ? "Updating..." : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeacherAssignments({ setMessage }) {
  const [teachers, setTeachers] = useState([]);
  const [pwModal, setPwModal] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [reassign, setReassign] = useState(null);
  const [reassignClass, setReassignClass] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignError, setReassignError] = useState("");
  const [allClasses, setAllClasses] = useState([]);
  const [roleModal, setRoleModal] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState("");
  const loadTeachers = () => {
    authAPI
      .getTeachers()
      .then((res) => {
        setTeachers(
          (res.data || []).filter(
            (t) => t.role === "FORM_TEACHER" && t.email !== "staff",
          ),
        );
      })
      .catch(() => {});
    classAPI
      .getAll()
      .then((res) => setAllClasses(res.data))
      .catch(() => {});
  };
  useEffect(loadTeachers, []);
  const handleCancel = async (id) => {
    if (!confirm("Cancel this teacher's class assignment?")) return;
    try {
      await authAPI.cancelAssignment(id);
      loadTeachers();
      setMessage("Assignment cancelled");
    } catch {
      setMessage("Error cancelling assignment");
    }
  };
  const handleReassign = async () => {
    setReassignError("");
    if (!reassign || !reassignClass) return;
    setReassignLoading(true);
    try {
      await authAPI.assignTeacher({
        teacherId: reassign,
        classId: reassignClass,
      });
      setReassign(null);
      setReassignClass("");
      loadTeachers();
      setMessage("Teacher reassigned");
    } catch (err) {
      setReassignError(err.response?.data?.message || "Error reassigning");
    } finally {
      setReassignLoading(false);
    }
  };
  const handleChangePw = async () => {
    setPwError("");
    if (!newPassword || newPassword.length < 6) {
      setPwError("Password must be at least 6 characters");
      return;
    }
    setPwLoading(true);
    try {
      await authAPI.changePassword(pwModal, { password: newPassword });
      setPwModal(null);
      setNewPassword("");
      setMessage("Password changed");
    } catch (err) {
      setPwError(err.response?.data?.message || "Error changing password");
    } finally {
      setPwLoading(false);
    }
  };
  const handleRemove = async (id, name) => {
    if (!confirm(`Remove teacher "${name}"? This cannot be undone.`)) return;
    try {
      await authAPI.deleteTeacher(id);
      loadTeachers();
      setMessage("Teacher removed");
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Error removing teacher",
      );
    }
  };
  return (
    <>
      <div className="space-y-2">
        {teachers.map((t) => {
          const cls = t.classAssignments?.[0]?.class;
          return (
            <div key={t._id} className="p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {t.firstName} {t.lastName}
                </span>
                <span className="text-gray-400 text-xs">({t.email})</span>
                {cls ? (
                  <span className="text-xs bg-[#1B5E20] text-white px-2 py-0.5 rounded">
                    {cls.name}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Unassigned</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                    onClick={() => {
                      setReassign(t._id);
                      setReassignClass(cls?._id || "");
                      setReassignError("");
                    }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Reassign
                </button>
                {cls && (
                  <button
                    onClick={() => handleCancel(t._id)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove Assignment
                  </button>
                )}
                <button
                  onClick={() => { setPwModal(t._id); setPwError(""); setNewPassword(""); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Change Password
                </button>
                <button
                  onClick={() => { setRoleModal(t); setRoleError(""); }}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  Change Role
                </button>
                <button
                  onClick={() =>
                    handleRemove(t._id, `${t.firstName} ${t.lastName}`)
                  }
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        {teachers.length === 0 && (
          <p className="text-gray-400 text-xs sm:text-sm text-center py-4">
            No form teachers yet
          </p>
        )}
      </div>
      {reassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setReassign(null);
              setReassignClass("");
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-base text-[#1B5E20] mb-4">
              Assign to Class
            </h3>
            {reassignError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {reassignError}
              </div>
            )}
            <select
              value={reassignClass}
              onChange={(e) => setReassignClass(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm mb-3"
            >
              <option value="">Select class</option>
              {allClasses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setReassign(null);
                  setReassignClass("");
                }}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={!reassignClass || reassignLoading}
                className="flex-1 bg-[#1B5E20] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50"
              >
                {reassignLoading ? "..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setPwModal(null);
              setNewPassword("");
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-base text-[#1B5E20] mb-4">
              Change Password
            </h3>
            {pwError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {pwError}
              </div>
            )}
            <input
              type="text"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwError(""); }}
              placeholder="New Password"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPwModal(null);
                  setNewPassword("");
                }}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePw}
                disabled={!newPassword || pwLoading}
                className="flex-1 bg-[#1B5E20] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50"
              >
                {pwLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      {roleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setRoleModal(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-base text-[#1B5E20] mb-4">
              Change Role
            </h3>
            {roleError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {roleError}
              </div>
            )}
            <p className="text-sm text-gray-600 mb-4">
              Current role:{" "}
              <strong>
                {roleModal.role === "SUBJECT_TEACHER"
                  ? "Subject Teacher"
                  : "Form Teacher"}
              </strong>
            </p>
            <div className="flex gap-3 mb-4">
              <button
                onClick={async () => {
                  setRoleError("");
                  setRoleLoading(true);
                  try {
                    await authAPI.updateTeacherRole(roleModal._id, {
                      role: "FORM_TEACHER",
                    });
                    setRoleModal(null);
                    loadTeachers();
                    setMessage("Role updated to Form Teacher");
                  } catch (err) {
                    setRoleError(
                      err.response?.data?.message || "Error updating role",
                    );
                  } finally {
                    setRoleLoading(false);
                  }
                }}
                disabled={roleModal.role === "FORM_TEACHER" || roleLoading}
                className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Form Teacher
              </button>
              <button
                onClick={async () => {
                  setRoleError("");
                  setRoleLoading(true);
                  try {
                    await authAPI.updateTeacherRole(roleModal._id, {
                      role: "SUBJECT_TEACHER",
                    });
                    setRoleModal(null);
                    loadTeachers();
                    setMessage("Role updated to Subject Teacher");
                  } catch (err) {
                    setRoleError(
                      err.response?.data?.message || "Error updating role",
                    );
                  } finally {
                    setRoleLoading(false);
                  }
                }}
                disabled={roleModal.role === "SUBJECT_TEACHER" || roleLoading}
                className="flex-1 bg-emerald-100 text-emerald-700 py-2 rounded-lg text-sm font-medium hover:bg-emerald-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Subject Teacher
              </button>
            </div>
            <button
              onClick={() => setRoleModal(null)}
              className="w-full bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
