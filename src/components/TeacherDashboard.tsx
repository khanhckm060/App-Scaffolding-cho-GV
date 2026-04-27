import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lesson, Class, Student, Assignment, Result } from '../types';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, ExternalLink, BarChart2, Calendar, BookOpen, Users, GraduationCap, Send, ChevronRight, UserPlus, Mail, Phone, Clock, CheckCircle2, AlertCircle, AlertTriangle, Share2, Copy, Headphones, Mic, PenTool, X, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { downloadWorksheet } from '../lib/worksheet';
import * as XLSX from 'xlsx';

export default function TeacherDashboard() {
  const [searchParams] = useSearchParams();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'classes' | 'lessons'>(searchParams.get('tab') === 'lessons' ? 'lessons' : 'classes');
  
  // Modals/Forms state
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'monthly'>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [importing, setImporting] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [lastError, setLastError] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', phone: '', email: '' });
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCategory, setAssignCategory] = useState<Lesson['type'] | 'speaking' | null>(null);
  const [lessonsCategory, setLessonsCategory] = useState<Lesson['type'] | 'speaking' | 'all'>('all');
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [selectedLessonForAssign, setSelectedLessonForAssign] = useState<Lesson | null>(null);
  const [assignDeadline, setAssignDeadline] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 48);
    return d.toISOString().slice(0, 16);
  });
  const [assignPassingPercentage, setAssignPassingPercentage] = useState<number>(80);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'lessons' || tab === 'classes') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const fetchData = async (uid: string) => {
    setRefreshing(true);
    setQuotaExceeded(false);
    try {
      // Fetch core data (lessons, classes, students, assignments)
      const [lessonsSnap, classesSnap, studentsSnap, assignmentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'lessons'), where('teacherId', '==', uid), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'classes'), where('teacherId', '==', uid), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
        getDocs(query(collection(db, 'assignments'), where('teacherId', '==', uid), orderBy('createdAt', 'desc')))
      ]);

      setLessons(lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson)));
      setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      setStudents(studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setAssignments(assignmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment)));

      // Fetch only recent results (last 30 days) to save quota
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Fetch all results for the teacher and filter/sort in memory to avoid needing a composite index while it's building
      const resultsQuery = query(
        collection(db, 'results'), 
        where('teacherId', '==', uid)
      );
      
      const resultsSnap = await getDocs(resultsQuery);
      const allResults = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result));
      
      // Filter by the last 30 days in memory
      const filteredResults = allResults
        .filter(r => r.completedAt >= thirtyDaysAgo.toISOString())
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
        
      setResults(filteredResults);
      
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setLastError(error.message || String(error));
      if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
        setQuotaExceeded(true);
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData(user.uid);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newClassName.trim()) return;
    await addDoc(collection(db, 'classes'), {
      name: newClassName,
      teacherId: auth.currentUser.uid,
      createdAt: new Date().toISOString()
    });
    setNewClassName('');
    setShowAddClass(false);
    fetchData(auth.currentUser.uid);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !selectedClassId) return;
    await addDoc(collection(db, 'students'), {
      ...newStudent,
      email: newStudent.email.toLowerCase().trim(),
      classId: selectedClassId,
      teacherId: auth.currentUser.uid
    });
    setNewStudent({ name: '', phone: '', email: '' });
    setShowAddStudent(false);
    fetchData(auth.currentUser.uid);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser || !selectedClassId) return;

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Skip header row if it exists
        // We look for columns that look like name, phone, email
        // For simplicity, we'll assume the first row is header or data
        // and try to find columns by name or index
        
        const studentsToImport: any[] = [];
        const header = data[0].map(h => String(h).toLowerCase().trim());
        
        const nameIdx = header.findIndex(h => h.includes('tên') || h.includes('name'));
        const phoneIdx = header.findIndex(h => h.includes('số') || h.includes('phone') || h.includes('điện thoại'));
        const emailIdx = header.findIndex(h => h.includes('email') || h.includes('gmail') || h.includes('thư'));

        // If we can't find by name, assume order: 0: name, 1: phone, 2: email
        const finalNameIdx = nameIdx !== -1 ? nameIdx : 0;
        const finalPhoneIdx = phoneIdx !== -1 ? phoneIdx : 1;
        const finalEmailIdx = emailIdx !== -1 ? emailIdx : 2;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[finalNameIdx] && row[finalEmailIdx]) {
            studentsToImport.push({
              name: String(row[finalNameIdx] || '').trim(),
              phone: String(row[finalPhoneIdx] || '').trim(),
              email: String(row[finalEmailIdx] || '').trim().toLowerCase(),
              classId: selectedClassId,
              teacherId: auth.currentUser?.uid,
              createdAt: new Date().toISOString()
            });
          }
        }

        if (studentsToImport.length > 0) {
          const promises = studentsToImport.map(s => addDoc(collection(db, 'students'), s));
          await Promise.all(promises);
          alert(`Đã nhập thành công ${studentsToImport.length} học sinh.`);
          fetchData(auth.currentUser?.uid!);
        } else {
          alert('Không tìm thấy dữ liệu học sinh hợp lệ trong file.');
        }
        setImporting(false);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi đọc file Excel.');
      setImporting(false);
    }
    // Reset input
    e.target.value = '';
  };

  const handleAssignLesson = async () => {
    if (!auth.currentUser || !selectedClassId || !selectedClass || !selectedLessonForAssign) return;
    
    const deadline = new Date(assignDeadline);
    const studentEmails = classStudents.map(s => s.email.toLowerCase().trim());

    const assignmentRef = await addDoc(collection(db, 'assignments'), {
      lessonId: selectedLessonForAssign.id,
      lessonTitle: selectedLessonForAssign.title,
      classId: selectedClassId,
      className: selectedClass.name,
      studentEmails,
      teacherId: auth.currentUser.uid,
      deadline: deadline.toISOString(),
      passingPercentage: assignPassingPercentage,
      createdAt: new Date().toISOString()
    });

    // Email notification feature disabled for now
    /*
    try {
      await fetch('/api/notify-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignmentRef.id,
          lessonId: selectedLessonForAssign.id,
          lessonTitle: selectedLessonForAssign.title || 'Bài tập mới',
          classId: selectedClassId,
          className: selectedClass.name,
          studentEmails,
          deadline: deadline.toISOString(),
          passingPercentage: assignPassingPercentage,
          teacherName: auth.currentUser.displayName || 'Giáo viên'
        })
      });
    } catch (err) {
      console.error("Failed to trigger notifications:", err);
    }
    */
    
    setShowAssignModal(false);
    setSelectedLessonForAssign(null);
    fetchData(auth.currentUser.uid);
    alert("Bài tập đã được giao thành công!");
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài tập này?")) return;
    await deleteDoc(doc(db, 'lessons', id));
    fetchData(auth.currentUser?.uid!);
  };

  const deleteClass = async (id: string) => {
    if (!confirm("Xóa lớp học sẽ xóa toàn bộ dữ liệu liên quan. Tiếp tục?")) return;
    await deleteDoc(doc(db, 'classes', id));
    if (selectedClassId === id) setSelectedClassId(null);
    fetchData(auth.currentUser?.uid!);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa học sinh này khỏi danh sách lớp?")) return;
    await deleteDoc(doc(db, 'students', id));
    fetchData(auth.currentUser?.uid!);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editingStudent.id) return;
    
    await updateDoc(doc(db, 'students', editingStudent.id), {
      name: editingStudent.name,
      phone: editingStudent.phone,
      email: editingStudent.email.toLowerCase().trim()
    });
    
    setEditingStudent(null);
    setShowEditStudent(false);
    fetchData(auth.currentUser?.uid!);
  };

  if (loading) return <div className="text-center py-12">Đang tải dữ liệu...</div>;

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s => s.classId === selectedClassId);
  const classAssignments = assignments.filter(a => a.classId === selectedClassId);

  return (
    <div className="space-y-8">
      {quotaExceeded && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-start justify-between gap-6 text-amber-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 p-3 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg mb-1">Thông báo từ Firebase (Quota/Limit)</p>
              <p className="text-sm opacity-90 leading-relaxed">
                Hệ thống ghi nhận một vấn đề về hạn mức truy cập dữ liệu. 
                <br />
                <span className="font-medium text-amber-900">Trạng thái:</span> Bạn đã nâng cấp gói <span className="font-bold">Blaze</span>, điều này rất tốt. Lỗi này có thể do hệ thống Firebase đang trong quá trình cập nhật hạn mức mới (thường mất 30-60 phút) hoặc do kết nối mạng tạm thời.
              </p>
              {lastError && (
                <div className="mt-3 p-3 bg-amber-900/5 rounded-xl border border-amber-200/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Chi tiết lỗi kỹ thuật:</p>
                  <code className="text-xs font-mono break-all opacity-80">{lastError}</code>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              Tải lại trang
            </button>
            <button 
              onClick={() => {
                setQuotaExceeded(false);
                setLastError('');
              }}
              className="px-6 py-3 bg-white border border-amber-200 text-amber-700 rounded-xl font-bold text-center hover:bg-amber-50 transition-all text-sm"
            >
              Bỏ qua thông báo
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Chào mừng, {auth.currentUser?.displayName}!</h2>
          <p className="text-slate-500">Quản lý lớp học và các bài tập của bạn.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => {
              if (auth.currentUser) fetchData(auth.currentUser.uid);
            }}
            disabled={refreshing}
            className="p-2 text-slate-500 hover:text-indigo-600 transition-all disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <Loader2 className={cn("w-5 h-5", refreshing && "animate-spin")} />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
          <button 
            onClick={() => setActiveTab('classes')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'classes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="w-4 h-4" />
            <span>Lớp học</span>
          </button>
          <button 
            onClick={() => setActiveTab('lessons')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'lessons' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Bài tập</span>
          </button>
        </div>
      </div>

      {activeTab === 'classes' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar: Class List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Danh sách lớp</h3>
              <button 
                onClick={() => setShowAddClass(true)}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Chưa có lớp học nào.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {classes.map((cls, i) => (
                  <button
                    key={`class-${cls.id}-${i}`}
                    onClick={() => setSelectedClassId(cls.id!)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedClassId === cls.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedClassId === cls.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {cls.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-bold">{cls.name}</p>
                        <p className="text-xs opacity-70">{students.filter(s => s.classId === cls.id).length} học sinh</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 transition-transform ${selectedClassId === cls.id ? 'rotate-90' : ''}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Content: Class Details */}
          <div className="lg:col-span-8">
            {selectedClass ? (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{selectedClass.name}</h3>
                      <p className="text-slate-500 text-sm">Quản lý học sinh và bài tập của lớp.</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                        <button 
                          onClick={() => setViewMode('list')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          Danh sách
                        </button>
                        <button 
                          onClick={() => setViewMode('monthly')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          Theo tháng
                        </button>
                      </div>
                      <button 
                        onClick={() => setShowAssignModal(true)}
                        className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                        <span>Giao bài tập</span>
                      </button>
                      <button 
                        onClick={() => deleteClass(selectedClass.id!)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {viewMode === 'monthly' && (
                    <div className="mb-6 flex items-center justify-between bg-indigo-50 p-4 rounded-xl">
                      <div className="flex items-center space-x-4">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-indigo-900">
                          Tháng {selectedMonth.getMonth() + 1}, {selectedMonth.getFullYear()}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))}
                          className="p-2 hover:bg-white rounded-lg transition-colors text-indigo-600"
                        >
                          <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                        <button 
                          onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))}
                          className="p-2 hover:bg-white rounded-lg transition-colors text-indigo-600"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {viewMode === 'list' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 flex items-center">
                          <Users className="w-5 h-5 mr-2 text-indigo-500" />
                          Danh sách học sinh
                        </h4>
                        <button 
                          onClick={() => setShowAddStudent(true)}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center"
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Thêm học sinh
                        </button>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center cursor-pointer">
                            {importing ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4 mr-1" />
                            )}
                            Nhập Excel
                            <input 
                              type="file" 
                              accept=".xlsx, .xls, .csv" 
                              className="hidden" 
                              onChange={handleImportExcel}
                              disabled={importing}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Họ tên</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Liên hệ</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Kết quả gần nhất</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-400 italic">Chưa có học sinh trong lớp này.</td>
                              </tr>
                            ) : (
                              classStudents.map((student, i) => {
                                const lastResult = results.filter(r => r.studentEmail === student.email).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
                                return (
                                  <tr key={`student-row-${student.id || student.email}-${i}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-4">
                                      <p className="font-bold text-slate-800">{student.name}</p>
                                    </td>
                                    <td className="py-4 px-4 space-y-1">
                                      <div className="flex items-center text-xs text-slate-500">
                                        <Mail className="w-3 h-3 mr-1" />
                                        {student.email}
                                      </div>
                                      <div className="flex items-center text-xs text-slate-500">
                                        <Phone className="w-3 h-3 mr-1" />
                                        {student.phone}
                                      </div>
                                    </td>
                                    <td className="py-4 px-4">
                                      {lastResult ? (
                                        <div className="flex items-center space-x-2">
                                          <div className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold">
                                            {lastResult.score}/10
                                          </div>
                                          <span className="text-[10px] text-slate-400">{new Date(lastResult.completedAt).toLocaleDateString()}</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-300">Chưa làm bài</span>
                                      )}
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                      <div className="flex items-center justify-end space-x-2">
                                        <button 
                                          onClick={() => {
                                            setEditingStudent(student);
                                            setShowEditStudent(true);
                                          }}
                                          className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                          title="Sửa thông tin"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => deleteStudent(student.id!)}
                                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                          title="Xóa học sinh"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 flex items-center">
                          <BarChart2 className="w-5 h-5 mr-2 text-indigo-500" />
                          Bảng theo dõi tiến độ tháng {selectedMonth.getMonth() + 1}
                        </h4>
                      </div>

                      <div className="overflow-x-auto pb-4">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-white z-10 w-48">Học sinh</th>
                              {classAssignments
                                .filter(a => {
                                  const d = new Date(a.createdAt);
                                  return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
                                })
                                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                                .map((assignment) => {
                                  const lesson = lessons.find(l => l.id === assignment.lessonId);
                                  return (
                                    <th key={`header-assign-${assignment.id}-${assignment.createdAt}`} className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center min-w-[120px]">
                                      <div className="truncate w-24 mx-auto" title={lesson?.title}>
                                        {lesson?.title || 'Lesson'}
                                      </div>
                                      <div className="text-[9px] opacity-60 mt-1">
                                        {new Date(assignment.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                      </div>
                                    </th>
                                  );
                                })}
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="py-8 text-center text-slate-400 italic">Chưa có học sinh.</td>
                              </tr>
                            ) : (
                              classStudents.map((student, i) => {
                                const monthlyAssignments = classAssignments
                                  .filter(a => {
                                    const d = new Date(a.createdAt);
                                    return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
                                  })
                                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                                return (
                                  <tr key={`row-student-month-${student.id || student.email}-${i}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-4 sticky left-0 bg-white z-10 border-r border-slate-50">
                                      <p className="font-bold text-slate-800 text-sm truncate w-40">{student.name}</p>
                                    </td>
                                    {monthlyAssignments.map((assignment) => {
                                      const result = results.find(r => r.studentEmail === student.email && r.assignmentId === assignment.id);
                                      const targetPercent = assignment.passingPercentage || 80;
                                      const targetScore = (targetPercent / 100) * 10;
                                      
                                      return (
                                        <td key={`cell-assign-${student.id || student.email}-${assignment.id}`} className="py-4 px-4 text-center">
                                          {result ? (
                                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm ${result.score >= targetScore ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                              {result.score}
                                            </div>
                                          ) : (
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center mx-auto">
                                              <Clock className="w-4 h-4 text-slate-300" />
                                            </div>
                                          )}
                                        </td>
                                      );
                                    })}
                                    {monthlyAssignments.length === 0 && (
                                      <td key={`no-assignments-cell-${student.id || student.email}`} className="py-8 text-center text-slate-300 text-xs italic" colSpan={1}>
                                        Không có bài tập trong tháng này
                                      </td>
                                    )}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {viewMode === 'list' && (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-orange-500" />
                      Bài tập đã giao
                    </h4>
                    <div className="space-y-4">
                      {classAssignments.length === 0 ? (
                        <p className="text-center py-8 text-slate-400 italic">Chưa giao bài tập nào cho lớp này.</p>
                      ) : (
                        classAssignments.map((assignment) => {
                          const lesson = lessons.find(l => l.id === assignment.lessonId);
                          const completionCount = results.filter(r => r.assignmentId === assignment.id).length;
                          const isExpired = new Date(assignment.deadline) < new Date();

                          return (
                            <div key={`list-assign-item-${assignment.id}`} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                                  <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">{lesson?.title || 'Bài tập đã xóa'}</p>
                                  <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                                    <span className="flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Hạn: {new Date(assignment.deadline).toLocaleString()}
                                    </span>
                                    <span className="flex items-center">
                                      <Users className="w-3 h-3 mr-1" />
                                      Đã làm: {completionCount}/{classStudents.length}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                {isExpired ? (
                                  <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold">Hết hạn</span>
                                ) : (
                                  <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">Đang diễn ra</span>
                                )}
                                <button 
                                  onClick={() => {
                                    const link = `${window.location.origin}/lesson/${assignment.lessonId}?assignmentId=${assignment.id}`;
                                    setShareLink(link);
                                    navigator.clipboard.writeText(link);
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                  title="Sao chép link bài tập"
                                >
                                  <Share2 className="w-5 h-5" />
                                </button>
                                <Link 
                                  to={`/teacher/analytics/${assignment.lessonId}`}
                                  className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  <BarChart2 className="w-5 h-5" />
                                </Link>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center h-full flex flex-col justify-center">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Chọn một lớp học</h3>
                <p className="text-slate-500">Chọn lớp học từ danh sách bên trái để quản lý học sinh và giao bài tập.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Lessons Tab */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xl font-bold text-slate-800">Bài tập đã tạo</h3>
            <div className="flex items-center space-x-3">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['all', 'listening', 'reading', 'writing', 'speaking'] as const).map((cat) => (
                  <button
                    key={`cat-filter-${cat}`}
                    onClick={() => setLessonsCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                      lessonsCategory === cat ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {cat === 'all' ? 'Tất cả' : cat === 'listening' ? 'Nghe' : cat === 'reading' ? 'Đọc' : cat === 'writing' ? 'Viết' : 'Nói'}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowCreateTypeModal(true)}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo bài mới</span>
              </button>
            </div>
          </div>

          {lessons.filter(l => lessonsCategory === 'all' || l.type === lessonsCategory).length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
              {lessonsCategory === 'speaking' ? (
                <>
                  <Mic className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Kỹ năng Nói đang phát triển</h3>
                  <p className="text-slate-500">Tính năng tạo bài tập Speaking AI sẽ sớm ra mắt.</p>
                </>
              ) : (
                <>
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Chưa có bài tập nào</h3>
                  <p className="text-slate-500 mb-6">Bắt đầu bằng cách tạo bài tập đầu tiên của bạn.</p>
                  <button 
                    onClick={() => setShowCreateTypeModal(true)}
                    className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all"
                  >
                    Tạo ngay
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lessons
                .filter(l => lessonsCategory === 'all' || l.type === lessonsCategory)
                .map((lesson, i) => (
                <motion.div
                  key={`lesson-${lesson.id || i}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100">
                            {lesson.level}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {new Date(lesson.createdAt).toLocaleDateString()}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider",
                            lesson.type === 'reading' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                          )}>
                            {lesson.type || 'listening'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 truncate" title={lesson.title}>{lesson.title}</h3>
                      </div>
                      <button 
                        onClick={() => deleteLesson(lesson.id!)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 shrink-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Link 
                        to={`/lesson/${lesson.id}`}
                        className="flex items-center justify-center space-x-2 bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg font-medium hover:bg-slate-100 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Xem</span>
                      </Link>
                      <Link 
                        to={`/teacher/analytics/${lesson.id}`}
                        className="flex items-center justify-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                      >
                        <BarChart2 className="w-4 h-4" />
                        <span>Kết quả</span>
                      </Link>
                    </div>

                    <button 
                      onClick={() => downloadWorksheet(lesson)}
                      className="w-full mt-3 flex items-center justify-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải Worksheet</span>
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {lesson.vocabulary.length} Từ vựng
                    </span>
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4, 5, 6].map(step => (
                        <div key={`step-indicator-${lesson.id}-${step}`} className="w-6 h-6 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showAddClass && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Thêm lớp học mới</h3>
              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Tên lớp học</label>
                  <input 
                    type="text" 
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Ví dụ: IELTS 6.5 - Morning"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddClass(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Tạo lớp
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAddStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Thêm học sinh mới</h3>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Họ và tên</label>
                  <input 
                    type="text" 
                    required
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Số điện thoại</label>
                  <input 
                    type="tel" 
                    required
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})}
                    placeholder="0912345678"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Email (Gmail)</label>
                  <input 
                    type="email" 
                    required
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                    placeholder="student@gmail.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddStudent(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Thêm
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Student Modal */}
        <AnimatePresence>
          {showEditStudent && editingStudent && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">Sửa thông tin học sinh</h3>
                  <button onClick={() => setShowEditStudent(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleEditStudent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Họ tên học sinh</label>
                    <input 
                      type="text" 
                      required
                      value={editingStudent.name}
                      onChange={e => setEditingStudent({...editingStudent, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Nhập họ tên..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại (Phụ huynh)</label>
                    <input 
                      type="tel" 
                      required
                      value={editingStudent.phone}
                      onChange={e => setEditingStudent({...editingStudent, phone: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Nhập số điện thoại..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email (Để đăng nhập làm bài)</label>
                    <input 
                      type="email" 
                      required
                      value={editingStudent.email}
                      onChange={e => setEditingStudent({...editingStudent, email: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Nhập email..."
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 mt-4"
                  >
                    Cập nhật thông tin
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">
                  {selectedLessonForAssign 
                    ? 'Thiết lập yêu cầu bài tập' 
                    : assignCategory 
                      ? `Chọn bài tập ${assignCategory === 'listening' ? 'Nghe' : assignCategory === 'reading' ? 'Đọc' : assignCategory === 'writing' ? 'Viết' : 'Nói'}`
                      : 'Chọn kỹ năng bài tập'}
                </h3>
                <button 
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedLessonForAssign(null);
                    setAssignCategory(null);
                  }} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              {!selectedLessonForAssign ? (
                <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                  {!assignCategory ? (
                    <div className="grid grid-cols-2 gap-4 py-4">
                      <button
                        onClick={() => setAssignCategory('listening')}
                        className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                      >
                        <div className="bg-indigo-100 p-4 rounded-xl mb-3 group-hover:bg-indigo-600 transition-colors">
                          <Headphones className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                        </div>
                        <span className="font-bold text-slate-900">Nghe</span>
                      </button>
                      <button
                        onClick={() => setAssignCategory('reading')}
                        className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                      >
                        <div className="bg-indigo-100 p-4 rounded-xl mb-3 group-hover:bg-indigo-600 transition-colors">
                          <BookOpen className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                        </div>
                        <span className="font-bold text-slate-900">Đọc</span>
                      </button>
                      <button
                        onClick={() => setAssignCategory('writing')}
                        className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                      >
                        <div className="bg-indigo-100 p-4 rounded-xl mb-3 group-hover:bg-indigo-600 transition-colors">
                          <PenTool className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                        </div>
                        <span className="font-bold text-slate-900">Viết</span>
                      </button>
                      <button
                        onClick={() => setAssignCategory('speaking')}
                        className="flex flex-col items-center p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                      >
                        <div className="bg-indigo-100 p-4 rounded-xl mb-3 group-hover:bg-indigo-600 transition-colors">
                          <Mic className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                        </div>
                        <span className="font-bold text-slate-900">Nói</span>
                      </button>
                    </div>
                  ) : assignCategory === 'speaking' ? (
                    <div className="text-center py-12">
                      <Mic className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">Chưa có bài tập kỹ năng Nói.</p>
                      <button 
                        onClick={() => setAssignCategory(null)}
                        className="mt-4 text-indigo-600 font-bold hover:underline"
                      >
                        Quay lại
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button 
                        onClick={() => setAssignCategory(null)}
                        className="text-indigo-600 font-bold text-sm mb-4 hover:underline flex items-center"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                        Quay lại chọn kỹ năng
                      </button>
                      {lessons.filter(l => l.type === assignCategory).length === 0 ? (
                        <p className="text-center py-8 text-slate-400 italic">Bạn chưa tạo bài tập nào trong kỹ năng này.</p>
                      ) : (
                        lessons.filter(l => l.type === assignCategory).map((lesson, i) => (
                          <div key={`assign-option-${lesson.id || i}`} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold border border-slate-200">
                                    {lesson.level}
                                  </span>
                                  <p className="font-bold text-slate-800">{lesson.title}</p>
                                </div>
                                <p className="text-xs text-slate-400">{lesson.vocabulary.length} từ vựng</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedLessonForAssign(lesson)}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                            >
                              Chọn bài
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Đang giao bài</p>
                      <p className="text-lg font-bold text-slate-900">{selectedLessonForAssign.title}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                        Thời hạn nộp bài
                      </label>
                      <input 
                        type="datetime-local"
                        value={assignDeadline}
                        onChange={(e) => setAssignDeadline(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <p className="text-[10px] text-slate-400">Học sinh sẽ không thể làm bài sau thời gian này.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center">
                        <BarChart2 className="w-4 h-4 mr-2 text-indigo-500" />
                        Tỉ lệ hoàn thành (%)
                      </label>
                      <div className="flex items-center space-x-4">
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={assignPassingPercentage}
                          onChange={(e) => setAssignPassingPercentage(parseInt(e.target.value))}
                          className="flex-1 accent-indigo-600"
                        />
                        <span className="w-12 text-center font-bold text-indigo-600 bg-indigo-50 py-1 rounded-lg border border-indigo-100">
                          {assignPassingPercentage}%
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">Yêu cầu tối thiểu để được tính là hoàn thành.</p>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button 
                      onClick={() => setSelectedLessonForAssign(null)}
                      className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Quay lại chọn bài
                    </button>
                    <button 
                      onClick={handleAssignLesson}
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center space-x-2"
                    >
                      <Send className="w-5 h-5" />
                      <span>Xác nhận giao bài</span>
                    </button>
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Hệ thống sẽ tự động gửi email thông báo và nhắc nhở cho học sinh.</span>
              </div>
            </motion.div>
          </div>
        )}

        {shareLink && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Link bài tập</h3>
                <button onClick={() => setShareLink(null)} className="text-slate-400 hover:text-slate-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="space-y-6">
                <p className="text-slate-500 text-sm">Gửi link này cho học viên để họ bắt đầu làm bài tập.</p>
                
                <div className="relative group">
                  <input 
                    type="text" 
                    readOnly
                    value={shareLink}
                    className="w-full pl-4 pr-12 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono text-sm outline-none"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                      alert("Đã sao chép!");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white text-indigo-600 rounded-lg shadow-sm border border-slate-100 hover:bg-indigo-50 transition-colors"
                    title="Sao chép"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Link này đã bao gồm mã định danh bài tập. Khi học viên làm xong, kết quả sẽ tự động được gán vào lớp này.
                  </p>
                </div>

                <button 
                  onClick={() => setShareLink(null)}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCreateTypeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowCreateTypeModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-10">
                <h3 className="text-3xl font-bold text-slate-900 mb-2">Bạn muốn tạo bài tập:</h3>
                <p className="text-slate-500">Chọn loại kỹ năng bạn muốn học sinh luyện tập.</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Link 
                  to="/teacher/new/listening"
                  onClick={() => setShowCreateTypeModal(false)}
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <Headphones className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Nghe</span>
                </Link>

                <Link 
                  to="/teacher/new/reading"
                  onClick={() => setShowCreateTypeModal(false)}
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <BookOpen className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Đọc</span>
                </Link>

                <button 
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <Mic className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Nói</span>
                </button>

                <Link 
                  to="/teacher/new/writing"
                  onClick={() => setShowCreateTypeModal(false)}
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <PenTool className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Viết</span>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
