import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from './firebase';
import TeacherDashboard from './components/TeacherDashboard';
import LessonCreator from './components/LessonCreator';
import StudentLesson from './components/StudentLesson';
import LessonAnalytics from './components/LessonAnalytics';
import { LogIn, LogOut, BookOpen, BarChart3, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">ScaffoldAI</span>
              </Link>

              <div className="flex items-center space-x-4">
                {user ? (
                  <>
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home user={user} login={login} isLoggingIn={isLoggingIn} />} />
            <Route path="/teacher" element={user ? <TeacherDashboard /> : <Navigate to="/" />} />
            <Route path="/teacher/new" element={user ? <LessonCreator /> : <Navigate to="/" />} />
            <Route path="/teacher/analytics/:lessonId" element={user ? <LessonAnalytics /> : <Navigate to="/" />} />
            <Route path="/lesson/:lessonId" element={<StudentLesson />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Home({ user, login, isLoggingIn }: { user: User | null, login: () => void, isLoggingIn: boolean }) {
  return (
    <div className="max-w-4xl mx-auto text-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
          Master English Listening with <span className="text-indigo-600">AI Scaffolding</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
          Create structured listening lessons in seconds. Our AI generates vocabulary guides, dictation exercises, and comprehension checks tailored to your content.
        </p>

        {user ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/teacher" 
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 active:scale-95"
            >
              <BarChart3 className="w-5 h-5" />
              <span>Go to Dashboard</span>
            </Link>
            <Link 
              to="/teacher/new" 
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white text-indigo-600 border-2 border-indigo-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-50 transition-all active:scale-95"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Create New Lesson</span>
            </Link>
          </div>
        ) : (
          <button 
            onClick={login}
            disabled={isLoggingIn}
            className="flex items-center space-x-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-xl hover:shadow-indigo-200 active:scale-95 mx-auto disabled:opacity-50"
          >
            {isLoggingIn ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn className="w-6 h-6" />
            )}
            <span>{isLoggingIn ? 'Logging in...' : 'Get Started as a Teacher'}</span>
          </button>
        )}
      </motion.div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
        {[
          { title: "Smart Scaffolding", desc: "4-step process: Meaning, Dictation, Gap-fill, and Comprehension.", icon: BookOpen },
          { title: "Instant Generation", desc: "Just paste your script and vocabulary. AI handles the rest.", icon: PlusCircle },
          { title: "Student Analytics", desc: "Track progress, scores, and common mistakes in real-time.", icon: BarChart3 },
        ].map((feature, i) => (
          <motion.div 
            key={i}
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
