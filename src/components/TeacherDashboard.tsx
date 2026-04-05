import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lesson, Class, Student, Assignment, Result } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, BarChart2, Calendar, BookOpen, Users, GraduationCap, Send, ChevronRight, UserPlus, Mail, Phone, Clock, CheckCircle2, AlertCircle, Share2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TeacherDashboard() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'classes' | 'lessons'>('classes');
  
  // Modals/Forms state
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'monthly'>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', phone: '', email: '' });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      const uid = user.uid;

      // Real-time listeners
      const unsubLessons = onSnapshot(
        query(collection(db, 'lessons'), where('teacherId', '==', uid), orderBy('createdAt', 'desc')),
        (snapshot) => setLessons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson)))
      );

      const unsubClasses = onSnapshot(
        query(collection(db, 'classes'), where('teacherId', '==', uid), orderBy('createdAt', 'desc')),
        (snapshot) => setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)))
      );

      const unsubStudents = onSnapshot(
        query(collection(db, 'students'), where('teacherId', '==', uid)),
        (snapshot) => setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)))
      );

      const unsubAssignments = onSnapshot(
        query(collection(db, 'assignments'), where('teacherId', '==', uid), orderBy('createdAt', 'desc')),
        (snapshot) => setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment)))
      );

      const unsubResults = onSnapshot(
        query(collection(db, 'results'), where('teacherId', '==', uid)),
        (snapshot) => setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result)))
      );

      setLoading(false);

      return () => {
        unsubLessons();
        unsubClasses();
        unsubStudents();
        unsubAssignments();
        unsubResults();
      };
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
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !selectedClassId) return;
    await addDoc(collection(db, 'students'), {
      ...newStudent,
      classId: selectedClassId,
      teacherId: auth.currentUser.uid
    });
    setNewStudent({ name: '', phone: '', email: '' });
    setShowAddStudent(false);
  };

  const handleAssignLesson = async (lessonId: string) => {
    if (!auth.currentUser || !selectedClassId || !selectedClass) return;
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48);

    const studentEmails = classStudents.map(s => s.email);

    await addDoc(collection(db, 'assignments'), {
      lessonId,
      classId: selectedClassId,
      className: selectedClass.name,
      studentEmails,
      teacherId: auth.currentUser.uid,
      deadline: deadline.toISOString(),
      createdAt: new Date().toISOString()
    });
    
    setShowAssignModal(false);
    alert("Bài tập đã được giao! Thông báo đã được gửi tới email học viên (Simulated).");
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài nghe này?")) return;
    await deleteDoc(doc(db, 'lessons', id));
  };

  const deleteClass = async (id: string) => {
    if (!confirm("Xóa lớp học sẽ xóa toàn bộ dữ liệu liên quan. Tiếp tục?")) return;
    await deleteDoc(doc(db, 'classes', id));
    if (selectedClassId === id) setSelectedClassId(null);
  };

  if (loading) return <div className="text-center py-12">Đang tải dữ liệu...</div>;

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s => s.classId === selectedClassId);
  const classAssignments = assignments.filter(a => a.classId === selectedClassId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Chào mừng, {auth.currentUser?.displayName}!</h2>
          <p className="text-slate-500">Quản lý lớp học và các bài nghe của bạn.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
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
            <span>Bài nghe</span>
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
                {classes.map(cls => (
                  <button
                    key={cls.id}
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
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Họ tên</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Liên hệ</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Kết quả gần nhất</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStudents.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="py-8 text-center text-slate-400 italic">Chưa có học sinh trong lớp này.</td>
                              </tr>
                            ) : (
                              classStudents.map(student => {
                                const lastResult = results.filter(r => r.studentEmail === student.email).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
                                return (
                                  <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
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
                                .map(assignment => {
                                  const lesson = lessons.find(l => l.id === assignment.lessonId);
                                  return (
                                    <th key={assignment.id} className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center min-w-[120px]">
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
                              classStudents.map(student => {
                                const monthlyAssignments = classAssignments
                                  .filter(a => {
                                    const d = new Date(a.createdAt);
                                    return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
                                  })
                                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                                return (
                                  <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-4 sticky left-0 bg-white z-10 border-r border-slate-50">
                                      <p className="font-bold text-slate-800 text-sm truncate w-40">{student.name}</p>
                                    </td>
                                    {monthlyAssignments.map(assignment => {
                                      const result = results.find(r => r.studentEmail === student.email && r.assignmentId === assignment.id);
                                      return (
                                        <td key={assignment.id} className="py-4 px-4 text-center">
                                          {result ? (
                                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm ${result.score >= 8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
                                      <td className="py-8 text-center text-slate-300 text-xs italic" colSpan={1}>
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
                        classAssignments.map(assignment => {
                          const lesson = lessons.find(l => l.id === assignment.lessonId);
                          const completionCount = results.filter(r => r.assignmentId === assignment.id).length;
                          const isExpired = new Date(assignment.deadline) < new Date();

                          return (
                            <div key={assignment.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                                  <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">{lesson?.title || 'Bài nghe đã xóa'}</p>
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
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-800">Bài nghe đã tạo</h3>
            <Link 
              to="/teacher/new"
              className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bài mới</span>
            </Link>
          </div>

          {lessons.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Chưa có bài nghe nào</h3>
              <p className="text-slate-500 mb-6">Bắt đầu bằng cách tạo bài nghe đầu tiên của bạn.</p>
              <Link 
                to="/teacher/new"
                className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all"
              >
                Tạo ngay
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lessons.map((lesson, i) => (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-slate-900 line-clamp-1">{lesson.title}</h3>
                      <button 
                        onClick={() => deleteLesson(lesson.id!)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center text-sm text-slate-500 mb-6">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(lesson.createdAt).toLocaleDateString()}
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
                  </div>
                  
                  <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {lesson.vocabulary.length} Từ vựng
                    </span>
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map(step => (
                        <div key={step} className="w-6 h-6 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
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

        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Chọn bài nghe để giao</h3>
                <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                {lessons.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 italic">Bạn chưa tạo bài nghe nào.</p>
                ) : (
                  lessons.map(lesson => (
                    <div key={lesson.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{lesson.title}</p>
                          <p className="text-xs text-slate-400">{lesson.vocabulary.length} từ vựng</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAssignLesson(lesson.id!)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                      >
                        Giao bài
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Học viên sẽ có 48 giờ để hoàn thành bài tập kể từ khi được giao.</span>
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
      </AnimatePresence>
    </div>
  );
}
