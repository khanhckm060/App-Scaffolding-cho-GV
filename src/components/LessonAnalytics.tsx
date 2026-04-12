import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lesson, Result } from '../types';
import { ChevronLeft, Users, Trophy, Clock, AlertCircle, BarChart3, ArrowRight, Eye, X, CheckCircle2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LessonAnalytics() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

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
        where('teacherId', '==', auth.currentUser?.uid),
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
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4 text-center">Score</th>
                  {lesson.type === 'listening' ? (
                    <>
                      <th className="px-6 py-4 text-center">Pronunciation</th>
                      <th className="px-6 py-4 text-center">Dictation</th>
                      <th className="px-6 py-4 text-center">Gap-fill</th>
                      <th className="px-6 py-4 text-center">MCQs</th>
                    </>
                  ) : (
                    <th className="px-6 py-4 text-center">Reading Correct</th>
                  )}
                  <th className="px-6 py-4 text-right">Completed At</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((result, i) => (
                  <motion.tr 
                    key={result.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-900">{result.studentName}</div>
                      <div className="text-xs text-slate-400">{result.studentEmail}</div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`text-lg font-black ${result.score >= (lesson.passingPercentage || 8) ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {result.score}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">/10</span>
                    </td>
                    {lesson.type === 'listening' ? (
                      <>
                        <td className="px-6 py-5 text-center">
                          <div className="text-sm font-bold text-slate-700">
                            {result.details.step2_correct || 0} / {lesson.steps?.step1_5?.questions?.length || 0}
                          </div>
                          <div className="text-[10px] text-slate-400">Step 2</div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="text-sm font-bold text-slate-700">
                            {result.details.step4_correct || 0} / {lesson.steps?.step2?.phrases?.length || 0}
                          </div>
                          <div className="text-[10px] text-slate-400">Step 4</div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="text-sm font-bold text-slate-700">
                            {result.details.step5_correct || 0} / {lesson.steps?.step3?.blanks?.length || 0}
                          </div>
                          <div className="text-[10px] text-slate-400">Step 5</div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="text-sm font-bold text-slate-700">
                            {result.details.step6_correct || 0} / {lesson.steps?.step4?.questions?.length || 0}
                          </div>
                          <div className="text-[10px] text-slate-400">Step 6</div>
                        </td>
                      </>
                    ) : (
                      <td className="px-6 py-5 text-center">
                        <div className="text-sm font-bold text-slate-700">
                          {result.details.reading || 0} / {result.details.total_reading || lesson.readingQuestions?.length || 0}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-5 text-right">
                      <div className="text-sm font-medium text-slate-600">
                        {new Date(result.completedAt).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(result.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button 
                        onClick={() => setSelectedResult(result)}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedResult.studentName}</h3>
                  <p className="text-sm text-slate-500">{selectedResult.studentEmail}</p>
                </div>
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className={cn(
                  "p-8 rounded-3xl text-center transition-colors",
                  selectedResult.score >= (lesson.passingPercentage || 8) ? "bg-emerald-50" : "bg-amber-50"
                )}>
                  <div className={cn(
                    "text-6xl font-black mb-2",
                    selectedResult.score >= (lesson.passingPercentage || 8) ? "text-emerald-600" : "text-amber-600"
                  )}>
                    {selectedResult.score}
                  </div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Score</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {lesson.type === 'listening' ? (
                    <>
                      <DetailCard 
                        label="Vocab (Step 2&3)" 
                        value={`${(lesson.steps?.step1_5?.questions?.length || 0) + (lesson.steps?.step1_6?.questions?.length || 0)} / ${(lesson.steps?.step1_5?.questions?.length || 0) + (lesson.steps?.step1_6?.questions?.length || 0)}`}
                        subValue={`Pronunciation: ${selectedResult.details.step2_correct || 0} correct`}
                      />
                      <DetailCard 
                        label="Dictation (Step 4)" 
                        value={`${selectedResult.details.step4_correct || 0} / ${lesson.steps?.step2?.phrases?.length || 0}`}
                      />
                      <DetailCard 
                        label="Gap-fill (Step 5)" 
                        value={`${selectedResult.details.step5_correct || 0} / ${lesson.steps?.step3?.blanks?.length || 0}`}
                      />
                      <DetailCard 
                        label="MCQs (Step 6)" 
                        value={`${selectedResult.details.step6_correct || 0} / ${lesson.steps?.step4?.questions?.length || 0}`}
                      />
                    </>
                  ) : (
                    <div className="col-span-full">
                      <DetailCard 
                        label="Reading Score" 
                        value={`${selectedResult.details.reading || 0} / ${selectedResult.details.total_reading || lesson.readingQuestions?.length || 0}`}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <div className="text-sm text-indigo-900 font-medium">
                    Completed on {new Date(selectedResult.completedAt).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' })}
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailCard({ label, value, subValue }: { label: string, value: string, subValue?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
      <div className="text-2xl font-black text-slate-900 mb-1">{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      {subValue && <div className="text-[10px] text-indigo-600 font-bold">{subValue}</div>}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
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
