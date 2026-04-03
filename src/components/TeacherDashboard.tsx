import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lesson } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, BarChart2, Calendar, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

export default function TeacherDashboard() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!auth.currentUser) return;
      const q = query(
        collection(db, 'lessons'),
        where('teacherId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const lessonData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
      setLessons(lessonData);
      setLoading(false);
    };
    fetchLessons();
  }, []);

  const deleteLesson = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lesson?")) return;
    await deleteDoc(doc(db, 'lessons', id));
    setLessons(lessons.filter(l => l.id !== id));
  };

  if (loading) return <div className="text-center py-12">Loading lessons...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Welcome, {auth.currentUser?.displayName}!</h2>
          <p className="text-slate-500">Manage and track your listening scaffolding lessons.</p>
        </div>
        <Link 
          to="/teacher/new"
          className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Create New Lesson</span>
        </Link>
      </div>

      {lessons.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No lessons yet</h3>
          <p className="text-slate-500 mb-6">Start by creating your first listening scaffolding lesson.</p>
          <Link 
            to="/teacher/new"
            className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all"
          >
            Create Lesson
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
                    <span>View</span>
                  </Link>
                  <Link 
                    to={`/teacher/analytics/${lesson.id}`}
                    className="flex items-center justify-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                  >
                    <BarChart2 className="w-4 h-4" />
                    <span>Results</span>
                  </Link>
                </div>
              </div>
              
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {lesson.vocabulary.length} Words
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
  );
}
