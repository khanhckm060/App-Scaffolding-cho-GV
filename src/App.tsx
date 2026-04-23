import { BrowserRouter, Routes, Route, Link, Navigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import LessonCreator from './components/LessonCreator';
import ReadingLessonCreator from './components/ReadingLessonCreator';
import WritingLessonCreator from './components/WritingLessonCreator';
import StudentLesson from './components/StudentLesson';
import WritingLessonView from './components/WritingLessonView';
import LessonAnalytics from './components/LessonAnalytics';
import { Lesson } from './types';
import { LogIn, LogOut, BookOpen, BarChart3, PlusCircle, GraduationCap, UserCircle, Headphones, Mic, PenTool, ChevronRight, X, Users, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { isInAppBrowser } from './lib/utils';

const ALLOWED_TEACHERS = [
  "khanhckm060@gmail.com",
  "ntquy2102@gmail.com",
  "hanhnguyen.smiley@gmail.com",
  "doanthu3421@gmail.com",
  "nguyenthithanhbinh1611@gmail.com",
  "thuhanguyen762000@gmail.com",
  "thyphuong111191@gmail.com",
  "baohieu161102@gmail.com",
  "ielts.maya@gmail.com",
  "dongphongtlc@gmail.com",
  "caothity51@gmail.com",
  "nguyenthituyettrinh02032000@gmail.com",
  "nguyen.tuyettrinh0203@gmail.com",
  "ngoaingumsthao@gmail.com",
  "hongmainguyenthi002@gmail.com",
  "nguyenhoanganh16082004@gmail.com",
  "ms.nguyen.english171@gmail.com",
  "nguyenthao49dn1@gmail.com",
  "0312nguyendoantoquyen@gmail.com",
  "thuanhvt0309@gmail.com",
  "Ellie.ha1985@gmail.com",
  "linhdt2808@gmail.com",
  "kimdungle2406@gmail.com",
  "damthom@gmail.com",
  "thuyttn38@gmail.com",
  "truonggiangphan85@gmail.com",
  "doanbaohuy1997@gmail.com",
  "hoang.tdhien@gmail.com",
  "prudencedinh@gmail.com",
  "englishwithmsevelyn@gmail.com",
  "lhvon27@gmail.com",
  "trathingan1984@gmail.com",
  "Huong.nth.1208@gmail.com",
  "phunguyenenglish@gmail.com",
  "nguyengon196@gmail.com",
  "vuongthanhhuyen90@gmail.com",
  "mon09022004@gmail.com",
  "Dandahull@gmail.com",
  "tranthuquynhhuong1993@gmail.com",
  "Thiemnguyen5678@gmail.com",
  "Thuhiennguyenols@gmail.com",
  "dakhuc0602@gmail.com",
  "hanxuanldb@gmail.com",
  "quocthainguyen191@gmail.com",
  "declandinh2006@gmail.com",
  "phanbthuy@gmail.com",
  "forwork.hanguyen@gmail.com",
  "caothao092002@gmail.com",
  "thaosteaching@gmail.com",
  "tiennguyenthuy2309@gmail.com",
  "tranthanhluangvav@gmail.com",
  "Baotran286@gmail.com",
  "Dinhlinh12052003@gmail.com",
  "huyentruong070903@gmail.com",
  "V.M.Minhh.Thu@gmail.com",
  "hangntt.168t@ou.edu.vn",
  "quinhquinh128@gmail.com",
  "t.hachau2209@gmail.com",
  "hoatrennuibang17@gmail.com",
  "buiphung293@gmail.com",
  "nmyanh240220@gmail.com",
  "quynhnhutdter@gmail.com",
  "benieu11082000198000@gmail.com",
  "vi802322@gmail.com",
  "Nhachi7194@gmail.com",
  "phamthuy022@gmail.com",
  "nhuhuyen77@gmail.com",
  "ongdieu0601@gmail.com",
  "Ngkimnhung99@gmail.com",
  "Kimduyen201195@gmail.com",
  "quocpro2002@gmail.com",
  "hhoanglan3103@gmail.com",
  "Superdatnguyen@gmail.com",
  "thuhiendt.forwork@gmail.com",
  "cutiesweetie860@gmail.com",
  "phamnghi26061986@gmail.com",
  "hongnhuphuong@gmail.com",
  "Duyen20091998@gmail.com",
  "hathi121220@gmail.com",
  "nguyendung20nt@gmail.com",
  "tutor.thuyanh@gmail.com",
  "Hanhptm.cantho@gmail.com"
];

const MAINTENANCE_MODE = false;

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      let details = null;

      const error = this.state.error;
      if (error) {
        if (typeof error === 'string') {
          message = error;
        } else if (error instanceof Error) {
          message = error.message;
          try {
            const parsed = JSON.parse(error.message);
            if (parsed.error) {
              message = parsed.error;
              details = parsed;
            }
          } catch (e) {
            // Not JSON
          }
        } else if (typeof error === 'object') {
          // Handle plain objects (like Firebase errors if they aren't real Error instances)
          message = (error as any).message || JSON.stringify(error);
          details = error;
        }
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100 text-center">
            <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Oops! An error occurred</h2>
            <p className="text-slate-600 mb-6">{String(message)}</p>
            {details && (
              <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 overflow-auto max-h-40">
                <pre className="text-[10px] text-slate-500">{JSON.stringify(details, null, 2)}</pre>
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function MaintenanceBanner() {
  if (!MAINTENANCE_MODE) return null;

  return (
    <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium">
      <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2">
        <AlertTriangle className="w-4 h-4" />
        <span>Hệ thống đang bảo trì và nâng cấp. Quyền tạo bài tập hiện đang bị hạn chế.</span>
      </div>
    </div>
  );
}

function InAppBrowserWarning() {
  if (!isInAppBrowser()) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap">
        <div className="flex items-center">
          <span className="flex p-2 rounded-lg bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </span>
          <p className="ml-3 font-medium text-amber-800 text-sm sm:text-base">
            <span className="md:hidden">Vui lòng mở bằng trình duyệt (Chrome/Safari) để đăng nhập.</span>
            <span className="hidden md:inline">Google không cho phép đăng nhập trong ứng dụng này. Vui lòng mở bằng Chrome hoặc Safari.</span>
          </p>
        </div>
        <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
          <div className="rounded-md shadow-sm">
            <button
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url);
                alert("Đã copy link! Vui lòng dán vào Chrome hoặc Safari.");
              }}
              className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-amber-700 bg-white hover:bg-amber-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = async () => {
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("Domain này chưa được cấp phép trong Firebase Console. Vui lòng thêm '" + window.location.hostname + "' vào danh sách 'Authorized domains' trong Firebase Authentication.");
      } else if (error.code === 'auth/popup-blocked') {
        alert("Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép hiện popup và thử lại.");
      } else {
        alert("Đăng nhập thất bại: " + error.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <ErrorBoundary>
          <MaintenanceBanner />
          <InAppBrowserWarning />
          <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">English Skills AI</span>
              </Link>

              <div className="flex items-center space-x-4">
                {user ? (
                  <>
                    <div className="hidden sm:flex items-center space-x-6 mr-6 pr-6 border-r border-slate-200">
                      <Link to="/teacher?tab=classes" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors flex items-center space-x-1.5">
                        <Users className="w-4 h-4" />
                        <span>Lớp học</span>
                      </Link>
                      <Link to="/teacher?tab=lessons" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors flex items-center space-x-1.5">
                        <BookOpen className="w-4 h-4" />
                        <span>Bài tập</span>
                      </Link>
                    </div>
                    <Link to="/teacher" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                      Teacher Dashboard
                    </Link>
                    <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
                      <div className="hidden sm:flex flex-col items-end mr-1">
                        <span className="text-xs font-bold text-slate-900">{user.displayName}</span>
                        <span className="text-[10px] text-slate-500">{user.email}</span>
                      </div>
                      <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => signOut(auth)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Sign Out"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <button 
                    onClick={login}
                    disabled={isLoggingIn}
                    className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>{isLoggingIn ? 'Logging in...' : 'Teacher Login'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        <main className="w-full py-8">
          <Routes>
            <Route path="/" element={<Home user={user} login={login} isLoggingIn={isLoggingIn} />} />
            <Route path="/teacher" element={user ? (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><TeacherDashboard /></div>
            ) : <Navigate to="/" />} />
            <Route path="/student" element={<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><StudentDashboard /></div>} />
            <Route path="/teacher/new/listening" element={user ? <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><LessonCreator /></div> : <Navigate to="/teacher" />} />
            <Route path="/teacher/new/reading" element={user ? <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><ReadingLessonCreator /></div> : <Navigate to="/teacher" />} />
            <Route path="/teacher/new/writing" element={user ? <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><WritingLessonCreator /></div> : <Navigate to="/teacher" />} />
            <Route path="/teacher/analytics/:lessonId" element={user ? <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><LessonAnalytics /></div> : <Navigate to="/teacher" />} />
            <Route path="/lesson/:lessonId" element={<LessonRouter />} />
          </Routes>
        </main>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}

function LessonRouter() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId) return;
      const docSnap = await getDoc(doc(db, 'lessons', lessonId));
      if (docSnap.exists()) {
        setLesson(docSnap.data() as Lesson);
      }
      setLoading(false);
    };
    fetchLesson();
  }, [lessonId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!lesson) return <div className="text-center py-20">Không tìm thấy bài học.</div>;

  if (lesson.type === 'writing') {
    return <WritingLessonView />;
  }

  return <StudentLesson />;
}

function Home({ user, login, isLoggingIn }: { user: User | null, login: () => void, isLoggingIn: boolean }) {
  const [showCreateOptions, setShowCreateOptions] = useState(false);

  return (
    <div className="max-w-5xl mx-auto py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
          Master English Skills with <span className="text-indigo-600">AI-Powered Exercises</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
          Create comprehensive exercises for Listening, Reading, Speaking, and Writing in seconds. Our AI helps you build structured lessons tailored to your students' needs.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Teacher Option */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl hover:shadow-indigo-100 hover:border-indigo-200 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <UserCircle className="w-32 h-32 text-indigo-600" />
          </div>
          <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <UserCircle className="w-8 h-8 text-indigo-600 group-hover:text-white" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Teacher Login</h2>
          <p className="text-slate-500 mb-8 text-lg">If you are a teacher, login here to create lessons, manage classes, and track student progress.</p>
          
          {user ? (
            <div className="space-y-4">
                  <Link 
                    to="/teacher" 
                    className="w-full flex items-center justify-between bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95 group/btn"
                  >
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="w-5 h-5" />
                      <span>Go to Teacher Dashboard</span>
                    </div>
                    <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                  
                  <button 
                    onClick={() => setShowCreateOptions(true)}
                    className="w-full flex items-center justify-between bg-white border-2 border-indigo-600 text-indigo-600 px-6 py-4 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all active:scale-95 group/btn"
                  >
                    <div className="flex items-center space-x-3">
                      <PlusCircle className="w-5 h-5" />
                      <span>Tạo bài tập cho học sinh</span>
                    </div>
                    <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
            </div>
          ) : (
            <button 
              onClick={login}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center space-x-3 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              <span>{isLoggingIn ? 'Logging in...' : 'Login as Teacher'}</span>
            </button>
          )}
        </motion.div>

        {/* Student Option */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl hover:shadow-emerald-100 hover:border-emerald-200 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <GraduationCap className="w-32 h-32 text-emerald-600" />
          </div>
          <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <GraduationCap className="w-8 h-8 text-emerald-600 group-hover:text-white" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Student Login</h2>
          <p className="text-slate-500 mb-8 text-lg">If you are a student, enter here to see your assigned lessons and start practicing.</p>
          
          <Link 
            to="/student" 
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
          >
            <GraduationCap className="w-5 h-5" />
            <span>Go to Student Dashboard</span>
          </Link>
        </motion.div>
      </div>

      {/* Create Assignment Modal */}
      <AnimatePresence>
        {showCreateOptions && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowCreateOptions(false)}
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
                  onClick={() => setShowCreateOptions(false)}
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <Headphones className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Nghe</span>
                </Link>

                <Link 
                  to="/teacher/new/reading"
                  onClick={() => setShowCreateOptions(false)}
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <BookOpen className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Đọc</span>
                </Link>

                <Link 
                  to="/teacher/new/writing"
                  onClick={() => setShowCreateOptions(false)}
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <PenTool className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Viết</span>
                </Link>

                <button 
                  className="flex flex-col items-center p-8 rounded-3xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group opacity-60 cursor-not-allowed relative"
                  title="Coming soon"
                >
                  <div className="absolute top-4 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    Coming soon
                  </div>
                  <div className="bg-indigo-100 p-4 rounded-2xl mb-4 group-hover:bg-indigo-600 transition-colors">
                    <Mic className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">Nói</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
        {[
          { title: "Multi-Skill Support", desc: "Create exercises for Listening, Reading, and more with specialized workflows.", icon: BookOpen },
          { title: "AI-Powered Creation", desc: "Just provide your content. Our AI handles the exercise generation instantly.", icon: PlusCircle },
          { title: "Detailed Analytics", desc: "Track student progress, scores, and common mistakes across all skills.", icon: BarChart3 },
        ].map((feature, i) => (
          <motion.div 
            key={`feature-${feature.title.replace(/\s+/g, '-').toLowerCase()}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm"
          >
            <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <feature.icon className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
            <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
