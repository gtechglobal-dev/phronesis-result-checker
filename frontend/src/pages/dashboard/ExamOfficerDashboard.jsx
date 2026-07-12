import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  classAPI,
  resultAPI,
  authAPI,
  pinAPI,
  studentAPI,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useSocketListener } from '../../context/SocketContext'

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

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function findSubjectMatches(input, registeredNames = []) {
  const up = input.toUpperCase().trim();
  if (!up) return { exact: null, suggestions: [], alreadyRegistered: false };
  const exact = SUBJECTS_LIST.find(s => s === up);
  if (exact) {
    return { exact, suggestions: [], alreadyRegistered: registeredNames.includes(exact) };
  }
  const startsWith = SUBJECTS_LIST.filter(s => s.startsWith(up) || up.startsWith(s));
  const includes = SUBJECTS_LIST.filter(s => s.includes(up) || up.includes(s) && !startsWith.includes(s));
  const fuzzy = SUBJECTS_LIST
    .map(s => ({ s, dist: levenshtein(up, s) }))
    .filter(x => x.dist <= Math.max(2, Math.floor(up.length * 0.4)))
    .sort((a, b) => a.dist - b.dist)
    .map(x => x.s);
  const seen = new Set();
  const suggestions = [...startsWith, ...includes, ...fuzzy].filter(s => { if (seen.has(s)) return false; seen.add(s); return true; }).slice(0, 6);
  return { exact: null, suggestions, alreadyRegistered: false };
}

const formatDate = (d) => {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}

export default function ExamOfficerDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "sessions";
  const setActiveTab = (tab) => setSearchParams({ tab });

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState(null);
  const [sessionTermAlert, setSessionTermAlert] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [termLoading, setTermLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [withholdLoading, setWithholdLoading] = useState(null);

  const [pendingSummary, setPendingSummary] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingClasses, setPendingClasses] = useState([]);
  const [pendingBroadsheet, setPendingBroadsheet] = useState(null);
  const [pendingLevel, setPendingLevel] = useState('summary');
  const [pendingSid, setPendingSid] = useState(null);
  const [pendingTid, setPendingTid] = useState(null);
  const [pendingSname, setPendingSname] = useState('');
  const [pendingTname, setPendingTname] = useState('');
  const [pendingLoading, setPendingLoading] = useState(false);
  const [editModalStudent, setEditModalStudent] = useState(null);
  const [editScores, setEditScores] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [resultForm, setResultForm] = useState({
    studentId: "",
    classId: "",
    sessionId: "",
    termId: "",
    scores: [],
  });
  const [sessionForm, setSessionForm] = useState({
    name: "",
    isCurrent: true,
  });
  const [termForm, setTermForm] = useState({
    name: "",
    sessionId: "",
    isCurrent: true,
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
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: null,
  });
  const [withholdList, setWithholdList] = useState([]);
  const [withholdSession, setWithholdSession] = useState("");
  const [withholdTerm, setWithholdTerm] = useState("");
  const [withholdClass, setWithholdClass] = useState("");
  const [withholdModal, setWithholdModal] = useState(null);
  const [withholdChosenReason, setWithholdChosenReason] = useState('');
  const [withholdCustomReason, setWithholdCustomReason] = useState('');
  const [withheldLoading, setWithheldLoading] = useState(false);

  const WITHHOLD_REASONS = [
    'Unpaid fees. Please call the school office for further assistance.',
    'Exam Malpractice. Please contact the school office.',
    'Behavioural misconduct towards school authorities. Please contact the school.'
  ]

  const [reactivateModal, setReactivateModal] = useState(null)
  const [reactivateTermId, setReactivateTermId] = useState('')
  const [reactivating, setReactivating] = useState(false)

  const [archiveSessions, setArchiveSessions] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLevel, setArchiveLevel] = useState('sessions');
  const [archiveSid, setArchiveSid] = useState(null);
  const [archiveTid, setArchiveTid] = useState(null);
  const [archiveTname, setArchiveTname] = useState('');
  const [archiveSname, setArchiveSname] = useState('');
  const [archiveClasses, setArchiveClasses] = useState([]);
  const [archiveBroadsheet, setArchiveBroadsheet] = useState(null);

  const [classRegForm, setClassRegForm] = useState({
    name: "",
    level: "PRIMARY",
  });
  const [classRegLoading, setClassRegLoading] = useState(false);
  const [subjectRegForm, setSubjectRegForm] = useState({
    name: "",
    classId: "",
    sessionId: "",
  });
  const [subjectRegLoading, setSubjectRegLoading] = useState(false);
  const [regClassSubjects, setRegClassSubjects] = useState([]);
  const [regClassSubjectsLoading, setRegClassSubjectsLoading] = useState(false);
  const [bulkSubjectsText, setBulkSubjectsText] = useState("");
  const [bulkSubjectsLoading, setBulkSubjectsLoading] = useState(false);
  const [bulkAnalysis, setBulkAnalysis] = useState([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [copySubjectsLoading, setCopySubjectsLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState(null);

  const [studentListClassId, setStudentListClassId] = useState('');
  const [studentListData, setStudentListData] = useState(null);
  const [studentListLoading, setStudentListLoading] = useState(false);
  const [studentListFilter, setStudentListFilter] = useState('ALL');
  const [studentListSearch, setStudentListSearch] = useState('');
  const [showGraduated, setShowGraduated] = useState(false);
  const [graduatedData, setGraduatedData] = useState(null);
  const [graduatedLoading, setGraduatedLoading] = useState(false);

  useEffect(() => {
    if (copyMessage) {
      const t = setTimeout(() => setCopyMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [copyMessage]);

  useEffect(() => {
    if (sessionTermAlert) {
      const t = setTimeout(() => setSessionTermAlert(null), 4000);
      return () => clearTimeout(t);
    }
  }, [sessionTermAlert]);

  useEffect(() => {
    const names = bulkSubjectsText.split(",").map(s => s.trim()).filter(Boolean);
    const registeredNames = regClassSubjects.map(s => s.name.toUpperCase());
    const seen = {};
    setBulkAnalysis(names.map((input, idx) => {
      const match = findSubjectMatches(input, registeredNames);
      const matchKey = match.exact || (match.suggestions.length > 0 ? match.suggestions[0] : input.toUpperCase());
      const isDuplicate = seen[matchKey] !== undefined;
      if (!isDuplicate) seen[matchKey] = idx;
      return {
        input,
        idx,
        ...match,
        resolved: match.exact !== null,
        isDuplicate,
        duplicateOf: isDuplicate ? seen[matchKey] : null,
      };
    }));
  }, [bulkSubjectsText, regClassSubjects]);

  const refreshCurrentTab = useCallback(() => {
    if (activeTab === 'sessions') { loadClasses(); loadSessions() }
    else if (activeTab === 'results') loadArchiveSessions()
    else if (activeTab === 'pending') loadPendingSummary()
    else if (activeTab === 'pins') loadPins()
  }, [activeTab])

  const refreshWithheld = useCallback(() => {
    loadWithheldResults()
  }, [])

  useSocketListener('entity:updated', refreshCurrentTab)
  useSocketListener('result:status', refreshCurrentTab)
  useSocketListener('result:withheld', refreshCurrentTab)
  useSocketListener('result:withheld', refreshWithheld)
  useSocketListener('pin:generated', refreshCurrentTab)
  useSocketListener('pin:revoked', refreshCurrentTab)

  const tabs = [
    { id: "sessions", label: "Sessions" },
    { id: "results", label: "Results" },
    { id: "students", label: "Students" },
    { id: "classes-reg", label: "Register Classes" },
    { id: "subjects-reg", label: "Register Subjects" },
    { id: "teachers", label: "Form Teachers" },
    { id: "pending", label: "Pending" },
    { id: "withhold", label: "Withheld Results" },
    { id: "pins", label: "Generate PIN" },
  ];

  useEffect(() => {
    loadClasses();
    loadSessions();
    loadPendingSummary();
    loadWithheldResults();
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
  const loadArchiveSessions = async () => {
    setArchiveLoading(true);
    try {
      const res = await resultAPI.getArchiveSessions();
      setArchiveSessions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setArchiveLoading(false);
    }
  };

  const loadArchiveClasses = async (sessionId, termId) => {
    setArchiveLoading(true);
    try {
      const res = await resultAPI.getArchiveClasses(sessionId, termId);
      setArchiveClasses(res.data);
      setArchiveLevel('classes');
    } catch (err) {
      console.error(err);
    } finally {
      setArchiveLoading(false);
    }
  };

  const loadArchiveBroadsheet = async (sessionId, termId, classId) => {
    setArchiveLoading(true);
    try {
      const res = await resultAPI.getArchiveBroadsheet(sessionId, termId, classId);
      setArchiveBroadsheet(res.data);
      setArchiveLevel('broadsheet');
    } catch (err) {
      console.error(err);
    } finally {
      setArchiveLoading(false);
    }
  };

  const loadStudentList = async (classId) => {
    if (!classId) { setStudentListData(null); return }
    setStudentListLoading(true);
    try {
      const res = await studentAPI.getClassList({ classId });
      setStudentListData(res.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load students' });
    } finally {
      setStudentListLoading(false);
    }
  };

  const loadWithheldResults = async () => {
    setWithheldLoading(true);
    try {
      const res = await resultAPI.getWithheldResults();
      setWithholdList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setWithheldLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'withhold') loadWithheldResults();
  }, [activeTab]);

  const loadGraduated = async () => {
    setGraduatedLoading(true);
    try {
      const res = await studentAPI.getGraduated();
      setGraduatedData(res.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load graduated students' });
    } finally {
      setGraduatedLoading(false);
    }
  };

  const loadPendingSummary = async () => {
    setPendingLoading(true);
    try {
      const res = await resultAPI.getPendingSummary();
      setPendingSummary(res.data);
      const count = res.data.reduce((sum, s) => sum + s.terms.reduce((ts, t) => ts + t.classCount, 0), 0);
      setPendingCount(count);
    } catch (err) {
      console.error(err);
    } finally {
      setPendingLoading(false);
    }
  };

  const loadPendingClasses = async (sessionId, termId) => {
    if (!sessionId || !termId) {
      setMessage({ type: 'error', text: 'Missing session or term' });
      return;
    }
    setPendingLoading(true);
    try {
      const res = await resultAPI.getPendingResults({ sessionId, termId });
      if (!Array.isArray(res.data)) throw new Error('Unexpected response format');
      const classMap = {};
      for (const r of res.data) {
        const cid = r.class?._id || r.class;
        if (!cid) continue;
        if (!classMap[cid]) classMap[cid] = { _id: cid, name: r.class?.name || 'Unknown', studentCount: 0 };
        classMap[cid].studentCount++;
      }
      setPendingClasses(Object.values(classMap));
      setPendingLevel('classes');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to load classes' });
    } finally {
      setPendingLoading(false);
    }
  };

  const loadPendingBroadsheet = async (sessionId, termId, classId) => {
    if (!sessionId || !termId || !classId) {
      setMessage({ type: 'error', text: 'Missing session, term, or class' });
      return;
    }
    setPendingLoading(true);
    try {
      const res = await resultAPI.getPendingBroadsheet(sessionId, termId, classId);
      if (!res.data.class) throw new Error('Class not found');
      setPendingBroadsheet(res.data);
      setPendingLevel('broadsheet');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to load broadsheet' });
    } finally {
      setPendingLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateModal) return
    setReactivating(true)
    try {
      await classAPI.reactivateSession({
        sessionId: reactivateModal._id,
        termId: reactivateTermId || undefined,
      })
      setMessage(`${reactivateModal.name} reactivated${reactivateTermId ? ' with selected term' : ''}`)
      setReactivateModal(null)
      setReactivateTermId('')
      loadSessions()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reactivate session' })
    } finally {
      setReactivating(false)
    }
  }

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setSessionLoading(true);
    try {
      await classAPI.createSession(sessionForm);
      setSessionTermAlert({ type: "success", text: "Session created successfully" });
      setSessionForm({ name: "", isCurrent: true });
      loadSessions();
    } catch (err) {
      console.error(err);
      setSessionTermAlert({ type: "error", text: err.response?.data?.message || "Server error" });
    } finally {
      setSessionLoading(false);
    }
  };

  const handleCreateTerm = async (e) => {
    e.preventDefault();
    setTermLoading(true);
    try {
      await classAPI.createTerm(termForm);
      setSessionTermAlert({ type: "success", text: "Term created successfully" });
      setTermForm({ name: "", sessionId: "", isCurrent: true });
      loadSessions();
    } catch (err) {
      console.error(err);
      setSessionTermAlert({ type: "error", text: err.response?.data?.message || "Server error" });
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

  const handleWithhold = async (resultId, withheld, reason) => {
    setWithholdLoading(resultId);
    try {
      await resultAPI.toggleWithhold(resultId, { withheld, reason });
      setMessage({ type: 'success', text: withheld ? 'Result withheld' : 'Result released' });
      loadWithheldResults();
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
      const usedUp = res.data.filter(p => p.usedCount >= p.maxUses);
      if (usedUp.length > 0) {
        await Promise.allSettled(usedUp.map(p => pinAPI.deletePin(p._id || p.id)));
      }
      setPinList(res.data.filter(p => p.usedCount < p.maxUses));
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
    if (activeTab === "results") loadArchiveSessions();
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
            className={`shrink-0 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap relative ${
              activeTab === t.id
                ? "bg-[#1B5E20] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
            {t.id === 'pending' && pendingCount > 0 && (
              <span className="inline-flex ml-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 shadow-sm">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
            {t.id === 'withhold' && withholdList.length > 0 && (
              <span className="inline-flex ml-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 shadow-sm">
                {withholdList.length > 99 ? '99+' : withholdList.length}
              </span>
            )}
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
                        <button onClick={() => setReactivateModal(s)}
                          className="text-[11px] text-[#1B5E20] border border-[#1B5E20] rounded px-2 py-0.5 hover:bg-[#1B5E20] hover:text-white transition">
                          Reactivate
                        </button>
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

      {activeTab === "students" && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
            Class Management
          </h3>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Class</label>
              <select
                value={studentListClassId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setStudentListClassId(cid);
                  setStudentListData(null);
                  setStudentListFilter('ALL');
                  setStudentListSearch('');
                  if (cid) loadStudentList(cid);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Choose a class...</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!showGraduated && (
            <button
              onClick={() => { setShowGraduated(true); if (!graduatedData) loadGraduated(); }}
              className="mb-4 text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              View Graduated Students &rarr;
            </button>
          )}

          {showGraduated ? (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-blue-800">Graduated Students</h4>
                <button
                  onClick={() => setShowGraduated(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  &larr; Back to class list
                </button>
              </div>

              {graduatedLoading && <div className="text-center py-6"><Spinner /></div>}

              {graduatedData && !graduatedLoading && (
                <>
                  <p className="text-xs text-gray-500 mb-3">{graduatedData.total} student{graduatedData.total !== 1 ? 's' : ''} graduated</p>

                  {graduatedData.students.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">No graduated students found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-blue-100 border-b border-blue-200">
                            <th className="p-2 text-left font-medium">#</th>
                            <th className="p-2 text-left font-medium">Name</th>
                            <th className="p-2 text-left font-medium">Exam No</th>
                            <th className="p-2 text-left font-medium">Last Class</th>
                            <th className="p-2 text-left font-medium">Last Session</th>
                            <th className="p-2 text-left font-medium">Graduated</th>
                            <th className="p-2 text-left font-medium">Last Term</th>
                            <th className="p-2 text-left font-medium">Grades Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {graduatedData.students.map((s, i) => (
                            <tr key={s._id} className={`border-t border-blue-100 ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}>
                              <td className="p-2 font-medium text-gray-500">{i + 1}</td>
                              <td className="p-2 font-medium whitespace-nowrap">{s.lastName} {s.firstName}</td>
                              <td className="p-2 font-mono">{s.regNo}</td>
                              <td className="p-2">{s.lastClass}</td>
                              <td className="p-2">{s.lastSession}</td>
                              <td className="p-2 whitespace-nowrap">{formatDate(s.graduatedAt)}</td>
                              <td className="p-2">{s.lastResult?.term || '-'}</td>
                              <td className="p-2">
                                {s.lastGrades?.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {s.lastGrades.slice(0, 5).map((g, gi) => (
                                      <div key={gi} className="text-[10px] text-gray-600">
                                        {g.subject}: <span className="font-medium">{g.grade || g.total || '-'}</span>
                                      </div>
                                    ))}
                                    {s.lastGrades.length > 5 && (
                                      <div className="text-[10px] text-gray-400 italic">
                                        +{s.lastGrades.length - 5} more
                                      </div>
                                    )}
                                    <div className="text-[10px] font-medium text-gray-700 mt-1">
                                      Total: {s.lastResult?.totalObtained || 0}/{s.lastGrades.length * 100 || '-'} | {s.lastResult?.status || '-'}
                                    </div>
                                  </div>
                                ) : <span className="text-gray-400">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>

          {studentListLoading && (
            <div className="text-center py-8"><Spinner /></div>
          )}

          {studentListData && !studentListLoading && (
            <>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <span><strong>Class:</strong> {studentListData.className}</span>
                {studentListData.currentSession && <span><strong>Session:</strong> {studentListData.currentSession.name}</span>}
                {studentListData.currentTerm && <span><strong>Term:</strong> {studentListData.currentTerm.name}</span>}
                <span><strong>Subjects:</strong> {studentListData.stats?.totalSubjects || 0}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Total', count: studentListData.stats?.totalStudents || 0, color: 'bg-gray-100 text-gray-700' },
                  { label: 'Active', count: studentListData.stats?.activeCount || 0, color: 'bg-green-100 text-green-700' },
                  { label: 'Transferred', count: studentListData.stats?.transferredCount || 0, color: 'bg-yellow-100 text-yellow-700' },
                ].map((c) => (
                  <div key={c.label} className={`rounded-lg p-3 text-center ${c.color}`}>
                    <p className="text-2xl font-bold">{c.count}</p>
                    <p className="text-xs font-medium">{c.label}</p>
                  </div>
                ))}
              </div>

              {studentListData.formTeacher && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs">
                  <span className="font-medium text-blue-700">Form Teacher:</span>{' '}
                  <span className="text-blue-600">{studentListData.formTeacher.name}</span>
                  <span className="text-blue-400 mx-1">|</span>
                  <span className="text-blue-500">{studentListData.formTeacher.email}</span>
                </div>
              )}

              {studentListData.classHistory?.length > 0 && (
                <details className="mb-4 group">
                  <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                    Class History ({studentListData.classHistory.length} session{studentListData.classHistory.length > 1 ? 's' : ''})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {studentListData.classHistory.map((h, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-gray-100 text-gray-600">
                        {h.sessionName}: <strong>{h.count}</strong> student{h.count > 1 ? 's' : ''}
                      </span>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex gap-1.5 flex-wrap">
                  {['ALL', 'ACTIVE', 'TRANSFERRED'].map((f) => (
                    <button key={f} onClick={() => setStudentListFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        studentListFilter === f ? 'bg-[#1B5E20] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Search name or reg no..."
                  value={studentListSearch}
                  onChange={(e) => setStudentListSearch(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm sm:w-64"
                />
              </div>

              {(() => {
                let filtered = studentListData.students;
                if (studentListFilter !== 'ALL') filtered = filtered.filter(s => s.status === studentListFilter);
                if (studentListSearch.trim()) {
                  const q = studentListSearch.toLowerCase();
                  filtered = filtered.filter(s =>
                    s.firstName.toLowerCase().includes(q) ||
                    s.lastName.toLowerCase().includes(q) ||
                    s.regNo.toLowerCase().includes(q)
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    {filtered.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No students found.</p>
                    ) : (
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="p-2 sm:p-3 text-left font-medium">#</th>
                            <th className="p-2 sm:p-3 text-left font-medium">Name</th>
                            <th className="p-2 sm:p-3 text-left font-medium">Reg No</th>
                            <th className="p-2 sm:p-3 text-center font-medium">G</th>
                            <th className="p-2 sm:p-3 text-center font-medium">Arm</th>
                            <th className="p-2 sm:p-3 text-center font-medium">Status</th>
                            <th className="p-2 sm:p-3 text-left font-medium">Transfer Info</th>
                            <th className="p-2 sm:p-3 text-left font-medium">Result</th>
                            <th className="p-2 sm:p-3 text-left font-medium">Submitted At</th>
                            <th className="p-2 sm:p-3 text-left font-medium">Parent</th>
                            <th className="p-2 sm:p-3 text-left font-medium">Enrolled</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((s, i) => (
                            <tr key={s._id} className={`border-t hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                              <td className="p-2 sm:p-3 font-medium text-gray-500">{i + 1}</td>
                              <td className="p-2 sm:p-3 font-medium whitespace-nowrap">{s.lastName} {s.firstName}</td>
                              <td className="p-2 sm:p-3 font-mono text-xs">{s.regNo}</td>
                              <td className="p-2 sm:p-3 text-center font-bold">{s.gender || '-'}</td>
                              <td className="p-2 sm:p-3 text-center">{s.arm || '-'}</td>
                              <td className="p-2 sm:p-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="p-2 sm:p-3 text-xs text-gray-600">
                                {s.transferInfo ? (
                                  <span>To <strong>{s.transferInfo.toClass}</strong></span>
                                ) : '-'}
                              </td>
                              <td className="p-2 sm:p-3 text-left">
                                {s.submissionInfo ? (
                                  <span className={`text-xs font-medium ${
                                    s.submissionInfo.resultStatus === 'PUBLISHED' ? 'text-green-600' :
                                    s.submissionInfo.resultStatus === 'SUBMITTED' ? 'text-yellow-600' :
                                    s.submissionInfo.resultStatus === 'NO_RESULT' ? 'text-gray-400' :
                                    'text-gray-500'
                                  }`}>
                                    {s.submissionInfo.submittedSubjects}/{s.submissionInfo.totalSubjects} submitted
                                    <span className="block text-[10px] opacity-70">{s.submissionInfo.resultStatus}</span>
                                  </span>
                                ) : <span className="text-gray-400 text-xs">-</span>}
                              </td>
                              <td className="p-2 sm:p-3 text-xs text-gray-500 whitespace-nowrap">
                                {s.submissionInfo?.submittedAt ? formatDate(s.submissionInfo.submittedAt) : '-'}
                              </td>
                              <td className="p-2 sm:p-3 text-xs text-gray-500 max-w-[120px] truncate" title={s.parent ? `${s.parent.firstName} ${s.parent.lastName}` : 'No parent linked'}>
                                {s.parent ? `${s.parent.firstName} ${s.parent.lastName}` : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="p-2 sm:p-3 text-xs text-gray-500 whitespace-nowrap">
                                {s.enrollmentSession || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {studentListData && !studentListLoading && studentListData.students.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">No students have been enrolled in this class.</p>
          )}

          {!studentListData && !studentListLoading && studentListClassId && (
            <p className="text-gray-400 text-sm text-center py-8">Select a class to view its students.</p>
          )}

          {!studentListClassId && !studentListLoading && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Select a class from the dropdown above to view its student list and metadata.</p>
            </div>
          )}

            </>
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

      {reactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { if (!reactivating) setReactivateModal(null) }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base text-gray-800 mb-1">Reactivate Session</h3>
            <p className="text-sm text-gray-500 mb-4">Set <strong>{reactivateModal.name}</strong> as the current session and choose which term to activate.</p>

            {reactivateModal.terms?.length > 0 ? (
              <div className="space-y-2 mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Term to Activate</label>
                {reactivateModal.terms.map((t) => (
                  <label key={t._id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                      reactivateTermId === t._id ? 'border-[#1B5E20] bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <input type="radio" name="reactivateTerm" value={t._id}
                      checked={reactivateTermId === t._id}
                      onChange={() => setReactivateTermId(t._id)}
                      className="w-4 h-4 text-[#1B5E20] focus:ring-[#1B5E20]" />
                    <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5">
                <p className="text-xs text-yellow-700">This session has no terms. Only the session will be activated.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setReactivateModal(null); setReactivateTermId('') }}
                disabled={reactivating}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleReactivate}
                disabled={reactivating || (reactivateModal.terms?.length > 0 && !reactivateTermId)}
                className="flex-1 px-4 py-2.5 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                {reactivating && <Spinner small />}
                {reactivating ? 'Reactivating...' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() =>
            setConfirmModal({
              show: false,
              message: "",
              confirmText: "Confirm",
              cancelText: "Cancel",
              onConfirm: null,
              title: "",
            })
          }
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center shadow-inner">
                <svg
                  className="w-7 h-7 text-red-500"
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
              <h4 className="text-lg font-bold text-gray-900 mb-2">
                {confirmModal.title}
              </h4>
              <p className="text-sm text-gray-500 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    message: "",
                    confirmText: "Confirm",
                    cancelText: "Cancel",
                    onConfirm: null,
                    title: "",
                  })
                }
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.97]"
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm?.();
                  setConfirmModal({
                    show: false,
                    message: "",
                    confirmText: "Confirm",
                    cancelText: "Cancel",
                    onConfirm: null,
                    title: "",
                  });
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-sm font-semibold text-white shadow-lg shadow-red-200 hover:shadow-red-300 hover:from-red-700 hover:to-red-600 transition-all active:scale-[0.97]"
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "results" && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <h3 className="font-bold text-base sm:text-lg text-[#1B5E20] mb-4">
            {archiveLevel === 'sessions' ? 'Archived Results' : archiveLevel === 'classes' ? `${archiveSname} - ${archiveTname}` : `${archiveSname} - ${archiveTname} > Broadsheet`}
          </h3>

          {archiveLevel !== 'sessions' && (
            <button onClick={() => {
              if (archiveLevel === 'broadsheet') { setArchiveLevel('classes'); setArchiveBroadsheet(null) }
              else { setArchiveLevel('sessions'); setArchiveClasses([]); setArchiveSid(null); setArchiveTid(null) }
            }} className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium mb-3 flex items-center gap-1">
              &larr; Back to {archiveLevel === 'broadsheet' ? 'Classes' : 'Sessions'}
            </button>
          )}

          {archiveLoading ? (
            <div className="text-center py-8"><Spinner /></div>
          ) : archiveLevel === 'sessions' ? (
            archiveSessions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No results found. Results appear here once they are created.</p>
            ) : (
              <div className="space-y-2">
                {archiveSessions.map(s => (
                  <div key={s._id} className="border rounded-lg p-3">
                    <p className="font-semibold text-sm text-gray-800 mb-2">{s.name}</p>
                    <div className="space-y-1">
                      {s.terms.map(t => (
                        <button key={t._id} onClick={() => { setArchiveSid(s._id); setArchiveTid(t._id); setArchiveSname(s.name); setArchiveTname(t.name); loadArchiveClasses(s._id, t._id) }}
                          className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition flex items-center justify-between text-sm">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-gray-400">{t.classCount} class{t.classCount !== 1 ? 'es' : ''}, {t.studentCount} student{t.studentCount !== 1 ? 's' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : archiveLevel === 'classes' ? (
            <div className="space-y-2">
              {archiveClasses.map(c => (
                <button key={c._id} onClick={() => loadArchiveBroadsheet(archiveSid, archiveTid, c._id)}
                  className="w-full text-left border rounded-lg p-3 hover:bg-gray-50 transition flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{c.studentCount} students</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {c.publishedCount > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{c.publishedCount} published</span>}
                    <span className="text-gray-400">&rarr;</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              {archiveBroadsheet ? (
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-[#1B5E20] text-white">
                      <th className="p-2 text-center font-semibold text-xs sticky left-0 bg-[#1B5E20] z-30" rowSpan="2">S/N</th>
                      <th className="p-2 text-left font-semibold text-xs sticky left-[40px] bg-[#1B5E20] z-30" rowSpan="2">STUDENT'S NAMES</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">EXAM NO</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">G</th>
                      {archiveBroadsheet.subjects.map(s => (
                        <th key={s._id || s.id} className="p-1 text-center font-semibold text-xs border-r border-green-800 bg-[#1B5E20]" colSpan="4">{s.name}</th>
                      ))}
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">GRAND TOTAL</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">AVERAGE</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">POSITION</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">TEACHER'S<br/>COMMENT</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">PRINCIPAL'S<br/>REMARK</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">DAYS<br/>OPEN</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">ATTEND</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">ABSENT</th>
                      <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2" colSpan="2">ACTION</th>
                    </tr>
                    <tr className="bg-[#E8F5E9] text-gray-700 border-b border-gray-300">
                      {archiveBroadsheet.subjects.map(s => (
                        <React.Fragment key={s._id || s.id}>
                          <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">CA1(20)</th>
                          <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">CA2(20)</th>
                          <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">EXAM(60)</th>
                          <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">TOTAL(100)</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archiveBroadsheet.students.map((row, i) => (
                      <tr key={row.student.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                        <td className="p-2 text-center font-bold sticky left-0 bg-inherit z-10">{i + 1}</td>
                          <td className="p-2 font-medium whitespace-nowrap sticky left-[40px] bg-inherit z-10">{row.student.lastName} {row.student.firstName}</td>
                          <td className="p-2 text-center font-mono text-xs">{row.student.regNo || '-'}</td>
                          <td className="p-2 text-center font-bold">{row.student.gender || '-'}</td>
                        {archiveBroadsheet.subjects.map(s => {
                          const d = row.details[s._id || s.id]
                          return d ? (
                            <React.Fragment key={s._id || s.id}>
                              <td className="p-1 text-center">{d.ca1}</td>
                              <td className="p-1 text-center">{d.ca2}</td>
                              <td className="p-1 text-center">{d.exam}</td>
                              <td className={`p-1 text-center font-bold border-r border-gray-300 ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{d.total}</td>
                            </React.Fragment>
                          ) : (
                            <React.Fragment key={s._id || s.id}>
                              <td className="p-1 text-center text-gray-300">-</td>
                              <td className="p-1 text-center text-gray-300">-</td>
                              <td className="p-1 text-center text-gray-300">-</td>
                              <td className="p-1 text-center text-gray-300 border-r border-gray-300">-</td>
                            </React.Fragment>
                          )
                        })}
                        <td className="p-2 text-center font-bold">{row.totalScore}</td>
                        <td className="p-2 text-center">{row.average}</td>
                        <td className="p-2 text-center font-bold">{row.position ? row.position + (() => { const s = ['th','st','nd','rd']; const v = row.position % 100; return s[(v - 20) % 10] || s[v] || s[0] })() : '-'}</td>
                            <td className="p-2 max-w-[120px] text-[11px] text-gray-600">{row.teacherComment || row.autoTeacherComment || '-'}</td>
                            <td className="p-2 max-w-[140px] text-[11px]">{row.principalComment || row.autoPrincipalRemark || '-'}</td>
                            <td className="p-2 text-center">{archiveBroadsheet.daysOpen ?? '-'}</td>
                            <td className="p-2 text-center">{row.daysPresent ?? '-'}</td>
                            <td className="p-2 text-center">{row.daysAbsent ?? '-'}</td>
                            <td className="p-2 text-center">
                              <button onClick={() => {
                                if (!row.resultId) return setMessage({ type: 'error', text: 'No result ID for this student' });
                                const scores = {}
                                for (const sub of archiveBroadsheet.subjects) {
                                  const d = row.details[sub._id || sub.id]
                                  scores[sub._id || sub.id] = d ? { ca1: d.ca1, ca2: d.ca2, exam: d.exam } : { ca1: 0, ca2: 0, exam: 0 }
                                }
                                setEditScores(scores)
                                setEditModalStudent(row)
                              }} className="text-blue-600 hover:text-blue-800 text-[11px] font-medium mr-2">Edit Result</button>
                            </td>
                            <td className="p-2 text-center">
                              <button onClick={() => { if (!row.withheld) { if (!row.resultId) return setMessage({ type: 'error', text: 'No result ID for this student' }); setWithholdModal(row); setWithholdChosenReason(''); setWithholdCustomReason('') } }} disabled={row.withheld} className={`text-[11px] font-medium ${row.withheld ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`}>{row.withheld ? 'Withheld' : 'Withhold'}</button>
                            </td>
                          </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-400 text-center py-8">No broadsheet data.</p>
              )}
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
              Session
            </label>
            <select
              required
              value={subjectRegForm.sessionId}
              onChange={(e) => {
                const sid = e.target.value;
                setSubjectRegForm({ name: "", classId: "", sessionId: sid });
                setRegClassSubjects([]);
                setSubjectSearch("");
                setShowSubjectDropdown(false);
                setBulkSubjectsText("");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select session</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Class
            </label>
            <select
              required
              value={subjectRegForm.classId}
              onChange={async (e) => {
                const cid = e.target.value;
                setSubjectRegForm(prev => ({ ...prev, name: "", classId: cid }));
                setSubjectSearch("");
                setShowSubjectDropdown(false);
                setBulkSubjectsText("");
                if (cid && subjectRegForm.sessionId) {
                  setRegClassSubjectsLoading(true);
                  try {
                    const res = await classAPI.getSubjects(cid, { params: { sessionId: subjectRegForm.sessionId } });
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

          {subjectRegForm.classId && subjectRegForm.sessionId && (
            <>
              <div className="border rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">
                  Copy Subjects from Previous Session
                </h4>
                <select
                  id="copyFromSession"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
                  defaultValue=""
                >
                  <option value="" disabled>Select source session...</option>
                  {sessions.filter(s => s._id !== subjectRegForm.sessionId).map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    const fromSessionId = document.getElementById('copyFromSession').value;
                    if (!fromSessionId) {
                      setCopyMessage({ type: "error", text: "Please select a source session" });
                      return;
                    }
                    setCopySubjectsLoading(true);
                    try {
                      await classAPI.copySubjectsFromSession({
                        fromSessionId,
                        toSessionId: subjectRegForm.sessionId,
                        classMappings: [{ fromClassId: subjectRegForm.classId, toClassId: subjectRegForm.classId }]
                      });
                      setCopyMessage({ type: "success", text: "Subjects copied successfully" });
                      const res = await classAPI.getSubjects(subjectRegForm.classId, { params: { sessionId: subjectRegForm.sessionId } });
                      setRegClassSubjects(res.data);
                    } catch (err) {
                      setCopyMessage({ type: "error", text: err.response?.data?.message || "Error copying subjects" });
                    } finally {
                      setCopySubjectsLoading(false);
                    }
                  }}
                  disabled={copySubjectsLoading}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {copySubjectsLoading ? "Copying..." : "Copy Subjects"}
                </button>

              {copyMessage && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-[fadeInUp_0.3s_ease-out]">
                  <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${copyMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {copyMessage.type === 'success'
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      }
                    </svg>
                    {copyMessage.text}
                  </div>
                </div>
              )}
              </div>
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
                      await classAPI.createSubject({ name: subjectRegForm.name, classId: subjectRegForm.classId, sessionId: subjectRegForm.sessionId });
                      setSubjectRegForm(prev => ({ ...prev, name: "" }));
                      setSubjectSearch("");
                      setMessage({ type: "success", text: "Subject added successfully" });
                      try {
                        const res = await classAPI.getSubjects(subjectRegForm.classId, { params: { sessionId: subjectRegForm.sessionId } });
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
                        setSubjectRegForm(prev => ({ ...prev, name: val }));
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
                                    await classAPI.createSubject({ name: s, classId: subjectRegForm.classId, sessionId: subjectRegForm.sessionId });
                                    setSubjectRegForm(prev => ({ ...prev, name: "" }));
                                    setSubjectSearch("");
                                    setMessage({ type: "success", text: "Subject added successfully" });
                                    try {
                                      const res = await classAPI.getSubjects(subjectRegForm.classId, { params: { sessionId: subjectRegForm.sessionId } });
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
                  Separate subjects with commas. Suggestions appear below as you type.
                </p>
                <textarea
                  rows={3}
                  value={bulkSubjectsText}
                  onChange={(e) => setBulkSubjectsText(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono mb-2"
                  placeholder={"MATHEMATICS, ENGLISH STUDIES, BASIC SCIENC"}
                />

                {bulkAnalysis.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {[...bulkAnalysis].reverse().map((item) => {
                      const idx = item.idx;
                      const isOk = item.exact && !item.alreadyRegistered && !item.isDuplicate;
                      const isReg = item.alreadyRegistered;
                      const isRepeat = item.isDuplicate;
                      const hasFix = !item.exact && item.suggestions.length > 0 && !isRepeat;
                      const isBad = !item.exact && item.suggestions.length === 0 && !isRepeat;
                      const color = isRepeat ? 'bg-orange-50' : isOk ? 'bg-green-50' : isReg ? 'bg-yellow-50' : hasFix ? 'bg-blue-50' : 'bg-red-50';
                      const textColor = isRepeat ? 'text-orange-700' : isOk ? 'text-green-700' : isReg ? 'text-yellow-700' : hasFix ? 'text-blue-700' : 'text-red-700';
                      return (
                        <div key={idx} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${color}`}>
                          <span className={`font-medium shrink-0 ${textColor}`}>
                            {item.input}
                          </span>
                          {isOk && <span className="text-green-600 text-[10px]">ready</span>}
                          {isReg && <span className="text-yellow-600 text-[10px]">already added</span>}
                          {isRepeat && <span className="text-orange-600 text-[10px]">duplicate</span>}
                          {hasFix && (
                            <div className="flex flex-wrap gap-1">
                              {item.suggestions.map((s, si) => (
                                <button
                                  key={si}
                                  type="button"
                                  onClick={() => {
                                    const parts = bulkSubjectsText.split(",").map(p => p.trim());
                                    parts[idx] = s;
                                    setBulkSubjectsText(parts.join(", "));
                                  }}
                                  className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-blue-700 hover:bg-blue-100 transition text-[10px] font-medium"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                          {isBad && <span className="text-red-500 text-[10px]">not found</span>}
                          {(isRepeat || isReg) && (
                            <button
                              type="button"
                              onClick={() => {
                                const parts = bulkSubjectsText.split(",").map(p => p.trim()).filter(Boolean);
                                parts.splice(idx, 1);
                                setBulkSubjectsText(parts.join(", "));
                              }}
                              className="ml-auto text-red-400 hover:text-red-600 transition"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={async () => {
                    const names = bulkSubjectsText
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (names.length === 0) {
                      setMessage({ type: "error", text: "Enter at least one subject" });
                      return;
                    }
                    const hasUnresolved = bulkAnalysis.some(a => !a.exact && a.suggestions.length === 0 && !a.isDuplicate);
                    if (hasUnresolved) {
                      setMessage({ type: "error", text: "Some subjects could not be matched. Please select a suggestion or remove them." });
                      return;
                    }
                    const finalNames = bulkAnalysis
                      .filter(a => !a.isDuplicate && !a.alreadyRegistered)
                      .map(a => a.exact || a.suggestions[0] || a.input);
                    const uniqueNames = [...new Set(finalNames)];
                    setBulkSubjectsLoading(true);
                    try {
                      const res = await classAPI.bulkCreateSubjects({
                        names: uniqueNames,
                        classId: subjectRegForm.classId,
                        sessionId: subjectRegForm.sessionId,
                      });
                      setMessage({ type: "success", text: `${res.data.count} subject(s) added` });
                      setBulkSubjectsText("");
                      setBulkAnalysis([]);
                      const subjectsRes = await classAPI.getSubjects(
                        subjectRegForm.classId,
                        { params: { sessionId: subjectRegForm.sessionId } }
                      );
                      setRegClassSubjects(subjectsRes.data);
                    } catch (err) {
                      setMessage({
                        type: "error",
                        text: err.response?.data?.message || "Error adding subjects",
                      });
                    } finally {
                      setBulkSubjectsLoading(false);
                    }
                  }}
                  disabled={bulkSubjectsLoading || !bulkSubjectsText.trim() || bulkAnalysis.some(a => !a.exact && a.suggestions.length === 0 && !a.isDuplicate)}
                  className="w-full bg-[#1B5E20] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50"
                >
                  {bulkSubjectsLoading
                    ? "Adding..."
                    : `Add ${bulkAnalysis.filter(a => (a.exact || a.suggestions.length > 0) && !a.isDuplicate && !a.alreadyRegistered).length} Verified Subject(s)`}
                </button>
              </div>
            </>
          )}

          <div className="space-y-1.5 border-t pt-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">
              Registered Subjects
            </h4>
            {subjectRegForm.classId && subjectRegForm.sessionId ? (
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
                            { params: { sessionId: subjectRegForm.sessionId } }
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
                Select a class and session to view its subjects
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
            {pendingLevel === 'summary' ? 'Pending Results (Submitted by Form Teachers)' : pendingLevel === 'classes' ? `${pendingSname} - ${pendingTname}` : `${pendingSname} - ${pendingTname} > ${pendingBroadsheet?.class?.name || 'Broadsheet'}`}
          </h3>

          {pendingLevel !== 'summary' && (
            <button onClick={() => {
              if (pendingLevel === 'broadsheet') { setPendingLevel('classes'); setPendingBroadsheet(null) }
              else { setPendingLevel('summary'); setPendingClasses([]); setPendingSid(null); setPendingTid(null) }
            }} className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium mb-3 flex items-center gap-1">
              &larr; Back to {pendingLevel === 'broadsheet' ? 'Classes' : 'Sessions'}
            </button>
          )}

          {pendingLoading ? (
            <div className="text-center py-8"><Spinner /></div>
          ) : pendingLevel === 'summary' ? (
            pendingSummary.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No pending results. Form teachers have not submitted any broadsheets yet.</p>
            ) : (
              <div className="space-y-2">
                {pendingSummary.map(s => (
                  <div key={s._id} className="border rounded-lg p-3">
                    <p className="font-semibold text-sm text-gray-800 mb-2">{s.name}</p>
                    <div className="space-y-1">
                      {s.terms.map(t => (
                        <button key={t._id} onClick={() => { setPendingSid(s._id); setPendingTid(t._id); setPendingSname(s.name); setPendingTname(t.name); loadPendingClasses(s._id, t._id) }}
                          className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition flex items-center justify-between text-sm">
                          <span className="font-medium">{t.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t.classCount} class{t.classCount !== 1 ? 'es' : ''}, {t.studentCount} student{t.studentCount !== 1 ? 's' : ''}</span>
                            {t.studentCount > 0 && <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{t.studentCount} pending</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : pendingLevel === 'classes' ? (
            <div className="space-y-2">
              {pendingClasses.map(c => (
                <button key={c._id} onClick={() => loadPendingBroadsheet(pendingSid, pendingTid, c._id)}
                  className="w-full text-left border rounded-lg p-3 hover:bg-gray-50 transition flex items-center justify-between">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{c.studentCount} students</span>
                    <span className="text-gray-400">&rarr;</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {pendingBroadsheet ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">{pendingBroadsheet.students.length} student(s)</p>
                    <button onClick={async () => {
                      setConfirmModal({
                        show: true,
                        title: 'Publish All Results?',
                        message: `Publish all results for ${pendingBroadsheet.class.name}? Students will be able to check their results online immediately.`,
                        confirmText: 'Publish',
                        cancelText: 'Cancel',
                        onConfirm: async () => {
                          setPublishing(true);
                          try {
                            const res = await resultAPI.publishClassResults(pendingSid, pendingTid, pendingBroadsheet.class.id);
                            setMessage({ type: 'success', text: res.data.message || 'Results published successfully' });
                            setPendingLevel('summary');
                            setPendingBroadsheet(null);
                            setPendingClasses([]);
                            setPendingSid(null);
                            setPendingTid(null);
                            loadPendingSummary();
                            loadArchiveSessions();
                          } catch (err) {
                            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to publish' });
                          } finally {
                            setPublishing(false);
                          }
                        }
                      });
                    }}
                      disabled={publishing}
                      className="bg-[#1B5E20] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50 flex items-center gap-2">
                      {publishing && <Spinner small />}
                      {publishing ? 'Publishing...' : 'Publish Results'}
                    </button>
                  </div>
                  <div className="overflow-auto max-h-[calc(100vh-380px)]">
                    <table className="w-full text-xs sm:text-sm border-collapse">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-[#1B5E20] text-white">
                          <th className="p-2 text-center font-semibold text-xs sticky left-0 bg-[#1B5E20] z-30" rowSpan="2">S/N</th>
                          <th className="p-2 text-left font-semibold text-xs sticky left-[40px] bg-[#1B5E20] z-30" rowSpan="2">STUDENT'S NAMES</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">EXAM NO</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">G</th>
                          {pendingBroadsheet.subjects.map(s => (
                            <th key={s._id || s.id} className="p-1 text-center font-semibold text-xs border-r border-green-800 bg-[#1B5E20]" colSpan="4">{s.name}</th>
                          ))}
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">GRAND TOTAL</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">AVERAGE</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">POSITION</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">TEACHER'S<br/>COMMENT</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">PRINCIPAL'S<br/>REMARK</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">DAYS<br/>OPEN</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">ATTEND</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2">ABSENT</th>
                          <th className="p-2 text-center font-semibold text-xs bg-[#1B5E20]" rowSpan="2" colSpan="2">ACTION</th>
                        </tr>
                        <tr className="bg-[#E8F5E9] text-gray-700 border-b border-gray-300">
                          {pendingBroadsheet.subjects.map(s => (
                            <React.Fragment key={s._id || s.id}>
                              <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">CA1(20)</th>
                              <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">CA2(20)</th>
                              <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">EXAM(60)</th>
                              <th className="p-1 text-center font-semibold text-[11px] border-r border-gray-200 bg-[#E8F5E9]">TOTAL(100)</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingBroadsheet.students.map((row, i) => (
                          <tr key={row.student.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                            <td className="p-2 text-center font-bold sticky left-0 bg-inherit z-10">{i + 1}</td>
                            <td className="p-2 font-medium whitespace-nowrap sticky left-[40px] bg-inherit z-10">{row.student.lastName} {row.student.firstName}</td>
                            <td className="p-2 text-center font-mono text-xs">{row.student.regNo || '-'}</td>
                            <td className="p-2 text-center font-bold">{row.student.gender || '-'}</td>
                            {pendingBroadsheet.subjects.map(s => {
                              const d = row.details[s._id || s.id]
                              return d ? (
                                <React.Fragment key={s._id || s.id}>
                                  <td className="p-1 text-center">{d.ca1}</td>
                                  <td className="p-1 text-center">{d.ca2}</td>
                                  <td className="p-1 text-center">{d.exam}</td>
                                  <td className={`p-1 text-center font-bold border-r border-gray-300 ${d.total >= 80 ? 'text-green-700' : d.total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{d.total}</td>
                                </React.Fragment>
                              ) : (
                                <React.Fragment key={s._id || s.id}>
                                  <td className="p-1 text-center text-gray-300">-</td>
                                  <td className="p-1 text-center text-gray-300">-</td>
                                  <td className="p-1 text-center text-gray-300">-</td>
                                  <td className="p-1 text-center text-gray-300 border-r border-gray-300">-</td>
                                </React.Fragment>
                              )
                            })}
                            <td className="p-2 text-center font-bold">{row.totalScore}</td>
                            <td className="p-2 text-center">{row.average}</td>
                            <td className="p-2 text-center font-bold">{row.position ? row.position + (() => { const s = ['th','st','nd','rd']; const v = row.position % 100; return s[(v - 20) % 10] || s[v] || s[0] })() : '-'}</td>
                            <td className="p-2 max-w-[120px] text-[11px] text-gray-600">{row.teacherComment || row.autoTeacherComment || '-'}</td>
                            <td className="p-2 max-w-[140px] text-[11px]">{row.principalComment || row.autoPrincipalRemark || '-'}</td>
                            <td className="p-2 text-center">{pendingBroadsheet.daysOpen ?? '-'}</td>
                            <td className="p-2 text-center">{row.daysPresent ?? '-'}</td>
                            <td className="p-2 text-center">{row.daysAbsent ?? '-'}</td>
                            <td className="p-2 text-center">
                              <button onClick={() => {
                                if (!row.resultId) return setMessage({ type: 'error', text: 'No result ID for this student' });
                                const scores = {}
                                for (const sub of pendingBroadsheet.subjects) {
                                  const d = row.details[sub._id || sub.id]
                                  scores[sub._id || sub.id] = d ? { ca1: d.ca1, ca2: d.ca2, exam: d.exam } : { ca1: 0, ca2: 0, exam: 0 }
                                }
                                setEditScores(scores)
                                setEditModalStudent(row)
                              }}
                                className="text-[10px] px-3 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition">
                                Edit Result
                              </button>
                            </td>
                            <td className="p-2 text-center">
                              <button onClick={() => {
                                if (row.withheld) return;
                                if (!row.resultId) return setMessage({ type: 'error', text: 'No result ID for this student' });
                                setWithholdModal(row);
                                setWithholdChosenReason('');
                                setWithholdCustomReason('');
                              }}
                                className={`text-[10px] px-3 py-1.5 rounded font-medium transition ${row.withheld ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                                {row.withheld ? 'Withheld' : 'Withhold'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-gray-400 text-center py-8">No data.</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "withhold" && (
        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base sm:text-lg text-[#1B5E20]">
              Withheld Results
            </h3>
            <button onClick={loadWithheldResults}
              className="text-xs text-[#1B5E20] hover:text-yellow-600 font-medium transition flex items-center gap-1"
              disabled={withheldLoading}>
              {withheldLoading && <Spinner small />}
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 sm:p-3 font-medium">Student</th>
                  <th className="text-left p-2 sm:p-3 font-medium">Class</th>
                  <th className="text-left p-2 sm:p-3 font-medium">Session / Term</th>
                  <th className="text-left p-2 sm:p-3 font-medium">Total</th>
                  <th className="text-left p-2 sm:p-3 font-medium">Reason</th>
                  <th className="text-center p-2 sm:p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {withholdList.map((r) => (
                  <tr key={r._id || r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 sm:p-3 font-medium whitespace-nowrap">
                      {r.student?.lastName} {r.student?.firstName}
                      <span className="ml-1.5 text-[10px] text-gray-400 font-mono">{r.student?.regNo}</span>
                    </td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">{r.class?.name || '-'}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">
                      {r.session?.name || '-'} / {r.term?.name || '-'}
                    </td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">{r.totalScore}</td>
                    <td className="p-2 sm:p-3 text-xs max-w-[200px]">{r.withholdReason || 'No reason provided'}</td>
                    <td className="p-2 sm:p-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleWithhold(r._id || r.id, false)}
                        disabled={withholdLoading === (r._id || r.id)}
                        className="text-[10px] sm:text-xs px-3 py-1 rounded bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1 mx-auto">
                        {withholdLoading === (r._id || r.id) && <Spinner small />}
                        {withholdLoading === (r._id || r.id) ? '...' : 'Release'}
                      </button>
                    </td>
                  </tr>
                ))}
                {withholdList.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center p-4 text-gray-400">
                      No withheld results
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

      {withholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setWithholdModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-gray-800">
                Withhold Result - {withholdModal.student.lastName} {withholdModal.student.firstName}
              </h3>
              <button onClick={() => setWithholdModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Select reason for withholding:</p>
            <div className="space-y-2 mb-3">
              {WITHHOLD_REASONS.map((r, idx) => (
                <label key={idx} className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition ${withholdChosenReason === r ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="withholdReason" checked={withholdChosenReason === r}
                    onChange={() => { setWithholdChosenReason(r); setWithholdCustomReason('') }}
                    className="mt-0.5" />
                  <span className="text-xs text-gray-700">{r}</span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Custom reason (optional):</label>
              <textarea rows={2}
                value={withholdCustomReason}
                onChange={(e) => { setWithholdCustomReason(e.target.value); if (e.target.value) setWithholdChosenReason('') }}
                placeholder="Or type a custom reason..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setWithholdModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={async () => {
                const reason = withholdCustomReason || withholdChosenReason
                if (!reason) return setMessage({ type: 'error', text: 'Please select or enter a reason' })
                if (!withholdModal.resultId) return
                setWithheldLoading(true)
                try {
                  await resultAPI.toggleWithhold(withholdModal.resultId, { withheld: true, reason })
                  setMessage({ type: 'success', text: 'Result withheld' })
                  const cid = pendingBroadsheet?.class?.id
                  if (cid) loadPendingBroadsheet(pendingSid, pendingTid, cid)
                  setWithholdModal(null)
                } catch (err) {
                  setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to withhold' })
                } finally {
                  setWithheldLoading(false)
                }
              }}
                disabled={withheldLoading}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {withheldLoading && <Spinner small />}
                {withheldLoading ? 'Withholding...' : 'Confirm Withhold'}
              </button>
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

      {editModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditModalStudent(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-gray-800">
                Edit Result - {editModalStudent.student.lastName} {editModalStudent.student.firstName}
              </h3>
              <button onClick={() => setEditModalStudent(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2 text-left font-semibold">Subject</th>
                    <th className="p-2 text-center font-semibold">CA1 (20)</th>
                    <th className="p-2 text-center font-semibold">CA2 (20)</th>
                    <th className="p-2 text-center font-semibold">Exam (60)</th>
                    <th className="p-2 text-center font-semibold">Total</th>
                    <th className="p-2 text-center font-semibold">Grade</th>
                    <th className="p-2 text-center font-semibold">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {(pendingBroadsheet?.subjects || archiveBroadsheet?.subjects || []).map(sub => {
                    const scores = editScores[sub._id || sub.id] || { ca1: 0, ca2: 0, exam: 0 }
                    const total = (scores.ca1 || 0) + (scores.ca2 || 0) + (scores.exam || 0)
                    const grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : total >= 40 ? 'E' : 'F'
                    const remark = total >= 80 ? 'Excellent' : total >= 70 ? 'Very Good' : total >= 60 ? 'Good' : total >= 50 ? 'Fair' : total >= 40 ? 'Poor' : 'Fail'
                    return (
                      <tr key={sub._id || sub.id} className="border-t hover:bg-gray-50">
                        <td className="p-2 font-medium">{sub.name}</td>
                        <td className="p-2">
                          <input type="number" min="0" max="20"
                            value={scores.ca1 || 0}
                            onChange={(e) => {
                              const val = Math.min(20, Math.max(0, parseInt(e.target.value) || 0))
                              setEditScores(prev => ({
                                ...prev,
                                [sub._id || sub.id]: { ...prev[sub._id || sub.id], ca1: val }
                              }))
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" max="20"
                            value={scores.ca2 || 0}
                            onChange={(e) => {
                              const val = Math.min(20, Math.max(0, parseInt(e.target.value) || 0))
                              setEditScores(prev => ({
                                ...prev,
                                [sub._id || sub.id]: { ...prev[sub._id || sub.id], ca2: val }
                              }))
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" max="60"
                            value={scores.exam || 0}
                            onChange={(e) => {
                              const val = Math.min(60, Math.max(0, parseInt(e.target.value) || 0))
                              setEditScores(prev => ({
                                ...prev,
                                [sub._id || sub.id]: { ...prev[sub._id || sub.id], exam: val }
                              }))
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-xs" />
                        </td>
                        <td className={`p-2 text-center font-bold ${total >= 80 ? 'text-green-700' : total >= 60 ? 'text-blue-700' : 'text-red-700'}`}>{total}</td>
                        <td className="p-2 text-center font-bold">{grade}</td>
                        <td className="p-2 text-center text-xs">{remark}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditModalStudent(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={async () => {
                if (!editModalStudent.resultId) return
                setEditSaving(true)
                try {
                  const scoresArr = Object.entries(editScores).map(([subjectId, s]) => ({
                    subjectId,
                    ca1: s.ca1 || 0,
                    ca2: s.ca2 || 0,
                    exam: s.exam || 0,
                  }))
                  await resultAPI.updateStudentScores(editModalStudent.resultId, { scores: scoresArr })
                  setMessage({ type: 'success', text: 'Scores updated successfully' })
                  const cid = pendingBroadsheet?.class?.id || archiveBroadsheet?.class?.id
                  if (cid) {
                    if (pendingBroadsheet) loadPendingBroadsheet(pendingSid, pendingTid, cid)
                    if (archiveBroadsheet) loadArchiveBroadsheet(archiveSid, archiveTid, cid)
                  }
                  setEditModalStudent(null)
                } catch (err) {
                  setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save scores' })
                } finally {
                  setEditSaving(false)
                }
              }}
                disabled={editSaving}
                className="bg-[#1B5E20] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#2E7D32] transition disabled:opacity-50 flex items-center gap-2">
                {editSaving && <Spinner small />}
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {sessionTermAlert && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-auto"
          style={{ top: '66vh', animation: 'fadeInUp 0.3s ease-out', backgroundColor: sessionTermAlert.type === "error" ? "#FEE2E2" : "#D1FAE5", border: `1px solid ${sessionTermAlert.type === "error" ? "#FCA5A5" : "#6EE7B7"}`, color: sessionTermAlert.type === "error" ? "#991B1B" : "#065F46" }}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sessionTermAlert.type === "error"
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            }
          </svg>
          <span>{sessionTermAlert.text}</span>
        </div>
      )}
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
