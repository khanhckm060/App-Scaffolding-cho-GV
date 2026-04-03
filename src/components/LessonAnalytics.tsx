import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Lesson, Result } from '../types';
import { ChevronLeft, Users, Trophy, Clock, AlertCircle, BarChart3, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function LessonAnalytics() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!lessonId) return;
      
      const lessonSnap = await getDoc(doc(db, 'lessons', lessonId));
      if (lessonSnap.exists()) {
        setLesson({ id: lessonSnap.id, ...lessonSnap.data() } as Lesson);
      }

      const q = query(
        collection(db, 'results'),
        where('lessonId', '==', lessonId),
        orderBy('completedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const resultData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result));
      setResults(resultData);
      setLoading(false);
    };
    fetchData();
  }, [lessonId]);

  if (loading) return <div className="text-center py-12">Loading analytics...</div>;
  if (!lesson) return <div className="text-center py-12 text-red-500">Lesson not found.</div>;

  const averageScore = results.length > 0 
    ? (results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/teacher" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-400" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{lesson.title}</h2>
            <p className="text-slate-500">Analytics and student performance tracking.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Students" 
          value={results.length.toString()} 
          icon={Users} 
          color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          title="Average Score" 
          value={`${averageScore}/10`} 
          icon={Trophy} 
          color="bg-emerald-50 text-emerald-600" 
        />
        <StatCard 
          title="Completion Rate" 
          value="100%" 
          icon={Clock} 
          color="bg-amber-50 text-amber-600" 
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Student Results</h3>
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <BarChart3 className="w-4 h-4" />
            <span>Real-time Data</span>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500">No students have completed this lesson yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Student Name</th>
                  <th className="px-8 py-4">Score</th>
                  <th className="px-8 py-4">Gap-fill</th>
                  <th className="px-8 py-4">MCQs</th>
                  <th className="px-8 py-4">Completed At</th>
                  <th className="px-8 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((result, i) => (
                  <motion.tr 
                    key={result.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-8 py-5 font-semibold text-slate-900">{result.studentName}</td>
                    <td className="px-8 py-5">
                      <span className={`font-bold ${result.score >= 7 ? 'text-emerald-600' : result.score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                        {result.score}/10
                      </span>
                    </td>
                    <td className="px-8 py-5 text-slate-600 font-medium">{result.details.step3} correct</td>
                    <td className="px-8 py-5 text-slate-600 font-medium">{result.details.step4} correct</td>
                    <td className="px-8 py-5 text-slate-500 text-sm">
                      {new Date(result.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold w-fit">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>Completed</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <ArrowRight className="w-5 h-5 text-slate-200" />
      </div>
      <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</div>
    </div>
  );
}
