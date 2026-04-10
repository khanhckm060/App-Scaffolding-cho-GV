import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Assignment, Lesson, Result } from '../types';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Clock, CheckCircle2, AlertCircle, AlertTriangle, ChevronRight, 
  Search, GraduationCap, Calendar, Trophy, ArrowRight, LogIn, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';

export default function StudentDashboard() {
  const [email, setEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [assignments, setAssignments] = useState<(Assignment & { lesson?: Lesson })[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('studentEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setIsLoggedIn(true);
      fetchData(savedEmail);
    }
  }, []);

  const fetchData = async (studentEmail: string) => {
    setLoading(true);
    try {
      // Fetch assignments for this email
      const qAssignments = query(
        collection(db, 'assignments'),
        where('studentEmails', 'array-contains', studentEmail),
        orderBy('createdAt', 'desc')
      );
      
      const unsubAssignments = onSnapshot(qAssignments, async (snapshot) => {
        const assignmentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment));
        
        // Fetch lesson details for each assignment
        const assignmentsWithLessons = await Promise.all(
          assignmentData.map(async (assign) => {
            const lessonDoc = await getDocs(query(collection(db, 'lessons'), where('__name__', '==', assign.lessonId)));
            const lesson = lessonDoc.docs[0]?.data() as Lesson;
            return { ...assign, lesson } as Assignment & { lesson?: Lesson };
          })
        );
        
        setAssignments(assignmentsWithLessons);
      }, (error) => {
        console.error("Assignments listener error:", error);
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          setQuotaExceeded(true);
        }
      });

      // Fetch results for this email
      const qResults = query(
        collection(db, 'results'),
        where('studentEmail', '==', studentEmail),
        orderBy('completedAt', 'desc')
      );
      
      const unsubResults = onSnapshot(qResults, (snapshot) => {
        setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result)));
      }, (error) => {
        console.error("Results listener error:", error);
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          setQuotaExceeded(true);
        }
      });

      setLoading(false);
      return () => {
        unsubAssignments();
        unsubResults();
      };
    } catch (error) {
      console.error("Error fetching student data:", error);
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      localStorage.setItem('studentEmail', email);
      setIsLoggedIn(true);
      fetchData(email);
    }
  };

  const logout = () => {
    localStorage.removeItem('studentEmail');
    setIsLoggedIn(false);
    setAssignments([]);
    setResults([]);
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl"
        >
          <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <GraduationCap className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Student Login</h2>
          <p className="text-slate-500 text-center mb-8">Enter your email to see your assigned exercises.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-2"
            >
              <span>View My Exercises</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Filter assignments into To Do and Completed
  // A lesson is "To Do" if there's no result with score >= 8
  const todoAssignments = assignments.filter(assign => {
    const bestResult = results.find(r => r.lessonId === assign.lessonId);
    return !bestResult || bestResult.score < 8;
  });

  const completedAssignments = assignments.filter(assign => {
    const bestResult = results.find(r => r.lessonId === assign.lessonId);
    return bestResult && bestResult.score >= 8;
  });

  return (
    <div className="space-y-8">
      {quotaExceeded && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-start justify-between gap-6 text-amber-800 shadow-sm animate-in fade-in slide-in-from-top-2 mb-8">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 p-3 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-lg mb-1">Hệ thống đang bảo trì hạn mức (Quota Exceeded)</p>
              <p className="text-sm opacity-90 leading-relaxed">
                Hệ thống đang tạm thời đạt giới hạn truy cập. Vui lòng liên hệ giáo viên để nâng cấp gói dịch vụ.
                <br />
                Giáo viên cần nâng cấp lên gói <span className="font-bold">Blaze</span> trong Firebase Console để tiếp tục.
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap w-full md:w-auto"
          >
            Thử lại ngay
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Learning Dashboard</h1>
          <p className="text-slate-500">Welcome back, <span className="font-bold text-indigo-600">{email}</span></p>
        </div>
        <button 
          onClick={logout}
          className="text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
        >
          Not you? Log out
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-2 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">To Do</span>
          </div>
          <div className="text-4xl font-black mb-1">{todoAssignments.length}</div>
          <div className="text-sm opacity-80">Exercises to complete</div>
        </div>

        <div className="bg-emerald-500 p-6 rounded-3xl text-white shadow-lg shadow-emerald-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Completed</span>
          </div>
          <div className="text-4xl font-black mb-1">{completedAssignments.length}</div>
          <div className="text-sm opacity-80">Exercises passed (≥ 8.0)</div>
        </div>

        <div className="bg-amber-500 p-6 rounded-3xl text-white shadow-lg shadow-amber-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-2 rounded-lg">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Average Score</span>
          </div>
          <div className="text-4xl font-black mb-1">
            {results.length > 0 
              ? (results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(1)
              : '0.0'
            }
          </div>
          <div className="text-sm opacity-80">Overall performance</div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <AlertCircle className="w-6 h-6 text-indigo-600" />
          <span>Priority: Exercises to Complete</span>
        </h2>
        
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading your exercises...</div>
        ) : todoAssignments.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">All caught up!</h3>
            <p className="text-slate-500">You have no pending assignments.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {todoAssignments.map((assign, i) => (
              <Link 
                key={`todo-${assign.id || i}`}
                to={`/lesson/${assign.lessonId}?assignmentId=${assign.id}`}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100">
                      {assign.lesson?.level}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assigned</span>
                    <span className="text-xs font-medium text-slate-600">{new Date(assign.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{assign.lesson?.title || 'Untitled Exercise'}</h3>
                <div className="flex items-center space-x-4 text-sm text-slate-500 mb-6">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{assign.className}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center space-x-2 text-amber-600 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Required: 8.0+</span>
                  </div>
                  <div className="flex items-center space-x-1 text-indigo-600 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Start Now</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {completedAssignments.length > 0 && (
        <div className="space-y-6 pt-8">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <span>Completed Exercises</span>
          </h2>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Exercise</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Class</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Best Score</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedAssignments.map((assign, i) => {
                  const bestResult = results.find(r => r.lessonId === assign.lessonId);
                  return (
                    <tr key={`done-${assign.id || i}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200">
                            {assign.lesson?.level}
                          </span>
                          <div className="font-bold text-slate-900">{assign.lesson?.title}</div>
                        </div>
                        <div className="text-xs text-slate-400">Completed on {new Date(bestResult?.completedAt || '').toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{assign.className}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                            {bestResult?.score.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/lesson/${assign.lessonId}?assignmentId=${assign.id}`}
                          className="text-indigo-600 hover:text-indigo-700 font-bold text-sm inline-flex items-center space-x-1"
                        >
                          <span>Review</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
