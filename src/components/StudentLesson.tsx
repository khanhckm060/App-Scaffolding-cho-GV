import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Lesson, Result } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, CheckCircle2, ArrowRight, Play, Pause, RotateCcw, 
  Check, X, Trophy, Share2, User, ChevronRight, ChevronLeft,
  Info, Type as TypeIcon, FileText, HelpCircle, BookOpen,
  GraduationCap, Headphones, Mail, AlertCircle, Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../lib/utils';

export default function StudentLesson() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [step, setStep] = useState(0); // 0: Intro, 1: Meaning, 2: Review, 3: Audio Practice, 4: Dictation, 5: Gap-fill, 6: MCQ, 7: Result
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewListenCount, setReviewListenCount] = useState(0);
  const [reviewFeedback, setReviewFeedback] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [audioPracticeIndex, setAudioPracticeIndex] = useState(0);
  const [dictationFeedback, setDictationFeedback] = useState<{ word: string; isCorrect: boolean }[][]>([]);
  const [answers, setAnswers] = useState<any>({
    step4: [], // Dictation
    step5: [], // Gap-fill
    step6: [], // MCQ
    reading: [] // Reading questions
  });
  const [readingChecked, setReadingChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gapFillChecked, setGapFillChecked] = useState(false);
  const [mcqChecked, setMcqChecked] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId) return;
      const docRef = doc(db, 'lessons', lessonId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Lesson;
        setLesson({ id: docSnap.id, ...data } as Lesson);
        if (data.type === 'listening' && data.steps) {
          setDictationFeedback(new Array(data.steps.step2.phrases.length).fill([]));
        }
      }
      setLoading(false);
    };
    fetchLesson();
  }, [lessonId]);

  const speak = (text: string, rate = 1) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = isSlow ? rate * 0.6 : rate;
    window.speechSynthesis.speak(utterance);
  };

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    audio.playbackRate = isSlow ? 0.6 : 1;
    if (lesson?.audioStart) {
      if (audio.currentTime < lesson.audioStart) {
        audio.currentTime = lesson.audioStart;
      }
    }
  };

  const handleAudioTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (lesson?.audioEnd && lesson.audioEnd > 0) {
      if (audio.currentTime >= lesson.audioEnd) {
        audio.pause();
        audio.currentTime = lesson.audioStart || 0;
      }
    }
  };

  const checkDictation = (index: number) => {
    if (!lesson || !lesson.steps) return;
    const correctPhrase = lesson.steps.step2.phrases[index].toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();
    const userPhrase = (answers.step4[index] || "").toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();
    
    const correctWords = correctPhrase.split(/\s+/);
    const userWords = userPhrase.split(/\s+/);
    
    const isFullyCorrect = correctPhrase === userPhrase;

    const feedback = correctWords.map((word, i) => ({
      word,
      isCorrect: userWords[i] === word
    }));
    
    const newFeedback = [...dictationFeedback];
    // Only show word-by-word if fully correct, otherwise show as "all wrong" or just don't show breakdown
    // User said: "chỉ khi nào học viên ghi đúng tất cả các từ mới thể hiện đáp án"
    if (isFullyCorrect) {
      newFeedback[index] = feedback;
    } else {
      // Show all as incorrect or just a special state
      newFeedback[index] = feedback.map(f => ({ ...f, isCorrect: false }));
    }
    setDictationFeedback(newFeedback);
  };

  const calculateScore = () => {
    if (!lesson) return 0;
    if (lesson.type === 'reading') {
      const correct = (answers.reading || []).filter((a: any, i: number) => {
        const q = lesson.readingQuestions?.[i];
        if (!q) return false;
        if (q.type === 'multipleChoice') return a === q.answer;
        return (a || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim();
      }).length;
      return Math.round((correct / (lesson.readingQuestions?.length || 1)) * 100) / 10;
    }
    
    let score = 0;
    if (lesson.steps) {
      // Step 5: Gap-fill
      const correctBlanks = (answers.step5 || []).filter((a: string, i: number) => 
        a?.toLowerCase().trim() === lesson.steps!.step3.blanks[i].toLowerCase().trim()
      ).length;
      score += (correctBlanks / lesson.steps.step3.blanks.length) * 5;

      // Step 6: MCQs
      const correctMCQs = (answers.step6 || []).filter((a: number, i: number) => 
        a === lesson.steps!.step4.questions[i].answer
      ).length;
      score += (correctMCQs / lesson.steps.step4.questions.length) * 5;
    }

    return Math.round(score * 10) / 10;
  };

  const submitResult = async () => {
    if (!lesson || !lessonId) return;
    setSubmitting(true);
    setError(null);

    try {
      const score = calculateScore();
      
      // Build details object carefully to avoid undefined values
      const details: any = {};
      if (lesson.type === 'listening') {
        details.step1 = true;
        details.step2 = true;
        if (lesson.steps) {
          details.step3 = (answers.step5 || []).filter((a: string, i: number) => 
            a?.toLowerCase().trim() === lesson.steps!.step3.blanks[i].toLowerCase().trim()
          ).length;
          details.step4 = (answers.step6 || []).filter((a: number, i: number) => 
            a === lesson.steps!.step4.questions[i].answer
          ).length;
        }
      } else if (lesson.type === 'reading') {
        details.reading = (answers.reading || []).filter((a: any, i: number) => {
          const q = lesson.readingQuestions?.[i];
          if (!q) return false;
          if (q.type === 'multipleChoice') return a === q.answer;
          return (a || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim();
        }).length;
      }

      const result: Result = {
        lessonId,
        studentName,
        studentEmail,
        teacherId: lesson.teacherId || '',
        score,
        details,
        completedAt: new Date().toISOString()
      };

      if (assignmentId) {
        result.assignmentId = assignmentId;
      }

      await addDoc(collection(db, 'results'), result);
      setStep(7);
    } catch (err) {
      console.error("Error submitting result:", err);
      setError("Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.");
      handleFirestoreError(err, OperationType.CREATE, 'results');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading lesson...</div>;
  if (!lesson) return <div className="text-center py-12 text-red-500">Lesson not found.</div>;

  const currentUrl = window.location.href;

  return (
    <div className="w-full pb-20">
      <AnimatePresence mode="wait">
        {lesson.type === 'reading' && step > 0 ? (
          <motion.div 
            key="reading-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full px-2 lg:px-4"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[5.5fr_3fr_1.5fr] gap-4 items-start">
              {/* Left: Passage */}
              <div className="lg:sticky lg:top-24 space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
                  <div className="bg-emerald-600 p-6 text-white">
                    <div className="flex items-center space-x-3 mb-2">
                      <BookOpen className="w-5 h-5" />
                      <span className="text-emerald-100 font-bold tracking-wider uppercase text-xs">Reading Passage</span>
                    </div>
                    <h1 className="text-2xl font-bold">{lesson.title}</h1>
                  </div>
                  <div className="p-8 max-h-[calc(100vh-200px)] overflow-y-auto leading-relaxed text-lg text-slate-700 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {lesson.passage}
                  </div>
                </div>
              </div>

              {/* Middle: Questions */}
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 p-8">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                    <HelpCircle className="w-6 h-6 mr-3 text-indigo-600" />
                    Comprehension Questions
                  </h2>

                  <div className="space-y-8">
                    {lesson.readingQuestions?.map((q, i) => (
                      <div key={i} id={`question-${i}`} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 scroll-mt-24">
                        <p className="font-bold text-slate-800 mb-4 flex items-start">
                          <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 shrink-0 mt-0.5">{i + 1}</span>
                          {q.question}
                        </p>

                        {q.type === 'multipleChoice' && q.options && (
                          <div className="grid grid-cols-1 gap-3">
                            {q.options.map((opt, optIdx) => (
                              <button
                                key={optIdx}
                                onClick={() => {
                                  if (readingChecked) return;
                                  const newAnswers = [...(answers.reading || [])];
                                  newAnswers[i] = optIdx;
                                  setAnswers({ ...answers, reading: newAnswers });
                                }}
                                className={cn(
                                  "text-left p-4 rounded-xl border-2 transition-all font-medium",
                                  answers.reading[i] === optIdx
                                    ? readingChecked
                                      ? optIdx === q.answer
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                        : "border-red-500 bg-red-50 text-red-700"
                                      : "border-indigo-600 bg-indigo-50 text-indigo-700"
                                    : readingChecked && optIdx === q.answer
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                      : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                                )}
                              >
                                <span className="mr-3 text-slate-400 font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {(q.type === 'trueFalse' || q.type === 'matching' || q.type === 'gapFill') && (
                          <div className="space-y-3">
                            <input 
                              type="text"
                              value={answers.reading[i] || ''}
                              onChange={(e) => {
                                if (readingChecked) return;
                                const newAnswers = [...(answers.reading || [])];
                                newAnswers[i] = e.target.value;
                                setAnswers({ ...answers, reading: newAnswers });
                              }}
                              placeholder="Type your answer here..."
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border-2 outline-none transition-all font-bold",
                                readingChecked
                                  ? (answers.reading[i] || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim()
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                    : "border-red-500 bg-red-50 text-red-700"
                                  : "border-slate-100 focus:border-indigo-600"
                              )}
                            />
                            {readingChecked && (
                              <div className="text-xs font-bold text-emerald-600">
                                Correct Answer: {q.answer}
                              </div>
                            )}
                          </div>
                        )}

                        {readingChecked && q.explanation && (
                          <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-sm text-indigo-700">
                            <div className="flex items-center space-x-2 mb-1">
                              <Info className="w-4 h-4" />
                              <span className="font-bold uppercase tracking-wider text-[10px]">Explanation</span>
                            </div>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 pt-8 border-t border-slate-100">
                    {!readingChecked ? (
                      <button
                        onClick={() => setReadingChecked(true)}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-3"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                        <span>Check Answers</span>
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                          <Trophy className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-emerald-900">Well Done!</h3>
                          <p className="text-emerald-700">You've completed the reading exercise.</p>
                          <div className="mt-4 text-4xl font-black text-emerald-600">
                            {Math.round((lesson.readingQuestions?.filter((q, i) => {
                              const userAns = answers.reading[i];
                              const correctAns = q.answer;
                              if (q.type === 'multipleChoice') return userAns === correctAns;
                              return (userAns || '').toLowerCase().trim() === String(correctAns).toLowerCase().trim();
                            }).length || 0) / (lesson.readingQuestions?.length || 1) * 100)}%
                          </div>
                        </div>
                        {error && (
                          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                          </div>
                        )}
                        <button
                          onClick={submitResult}
                          disabled={submitting}
                          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Đang nộp bài...</span>
                            </>
                          ) : (
                            <span>Submit Results & Finish</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Navigation */}
              <div className="hidden lg:block lg:sticky lg:top-24 space-y-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-3">
                  <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Question Grid</h3>
                  <div className="grid grid-cols-5 gap-1">
                    {lesson.readingQuestions?.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const el = document.getElementById(`question-${i}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all border",
                          answers.reading[i] !== undefined && answers.reading[i] !== ""
                            ? readingChecked
                              ? (() => {
                                  const userAns = answers.reading[i];
                                  const q = lesson.readingQuestions?.[i];
                                  if (!q) return false;
                                  if (q.type === 'multipleChoice') return userAns === q.answer;
                                  return (userAns || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim();
                                })()
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "bg-red-500 border-red-500 text-white"
                              : "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                            : "bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm font-bold text-slate-500 mb-2">
                      <span>Progress</span>
                      <span>{Math.round(((answers.reading || []).filter(a => a !== undefined && a !== "").length / (lesson.readingQuestions?.length || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-500" 
                        style={{ width: `${((answers.reading || []).filter(a => a !== undefined && a !== "").length / (lesson.readingQuestions?.length || 1)) * 100}%` }}
                      />
                    </div>

                    {!readingChecked ? (
                      <button
                        onClick={() => setReadingChecked(true)}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-100"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Check Answers</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {error && (
                          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[10px] font-medium flex items-center space-x-2">
                            <AlertCircle className="w-3 h-3" />
                            <span>{error}</span>
                          </div>
                        )}
                        <button
                          onClick={submitResult}
                          disabled={submitting}
                          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Finishing...</span>
                            </>
                          ) : (
                            <>
                              <Trophy className="w-4 h-4" />
                              <span>Finish Lesson</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : step === 0 && (
          <motion.div 
            key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="max-w-4xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 shadow-xl text-center"
          >
            <div className="bg-indigo-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <BookOpen className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4">{lesson.title}</h1>
            <p className="text-slate-500 mb-10 text-lg">Welcome! Please enter your name to begin the lesson.</p>
            
            <div className="max-w-sm mx-auto space-y-4">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Họ và tên của bạn"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-lg font-medium"
                />
              </div>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="Email (Gmail)"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-lg font-medium"
                />
              </div>
              <button 
                onClick={() => studentName && studentEmail && setStep(1)}
                disabled={!studentName || !studentEmail}
                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <span>Bắt đầu bài học</span>
                <ArrowRight className="w-6 h-6" />
              </button>
              
              <button 
                onClick={() => setShowQR(!showQR)}
                className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 transition-colors mx-auto text-sm font-medium"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Lesson</span>
              </button>

              {showQR && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center space-y-4"
                >
                  <QRCodeSVG value={currentUrl} size={160} />
                  <p className="text-xs text-slate-400 break-all">{currentUrl}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {step > 0 && step < 7 && (
          <div className="fixed bottom-8 right-8 z-50">
            <button 
              onClick={() => setIsSlow(!isSlow)}
              className={cn(
                "flex items-center space-x-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95",
                isSlow ? "bg-amber-500 text-white" : "bg-white text-slate-600 border border-slate-200"
              )}
            >
              <RotateCcw className={cn("w-5 h-5", isSlow && "animate-spin-slow")} />
              <span>{isSlow ? "Slow Mode ON" : "Slow Mode OFF"}</span>
            </button>
          </div>
        )}

        {lesson.type === 'listening' && step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-5xl mx-auto space-y-8"
          >
            <StepHeader current={1} total={6} title="Meaning & Pronunciation" icon={BookOpen} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lesson.steps?.step1?.vocabulary.map((v, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{v.word}</h3>
                      <span className="text-indigo-600 font-mono text-sm">{v.ipa}</span>
                    </div>
                    <button 
                      onClick={() => speak(v.word)}
                      className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-indigo-600 font-bold italic text-lg">Nghĩa: {v.vietnameseDefinition}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-indigo-200 italic text-slate-500 text-sm">
                    "{v.example}"
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-8">
              <button 
                onClick={() => setStep(2)}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
              >
                <span>Next: Vocabulary Review</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {lesson.type === 'listening' && step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={2} total={6} title="Vocabulary Review" icon={GraduationCap} />
            <div className="max-w-2xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="mb-8">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Question {reviewIndex + 1} of {lesson.steps?.step1_5?.questions.length}</div>
                <h3 className="text-4xl font-black text-slate-900 mb-4">{lesson.steps?.step1_5?.questions[reviewIndex].word}</h3>
                <button 
                  onClick={() => {
                    if (lesson.steps) {
                      speak(lesson.steps.step1_5?.questions[reviewIndex].word);
                      setReviewListenCount(prev => prev + 1);
                    }
                  }}
                  className="p-4 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-600 hover:text-white transition-all relative"
                >
                  <Volume2 className="w-8 h-8" />
                  {reviewListenCount < 3 && (
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                      {reviewListenCount}
                    </span>
                  )}
                </button>
                {reviewListenCount < 3 && (
                  <p className="mt-4 text-amber-600 text-sm font-bold">
                    Nghe thêm {3 - reviewListenCount} lần nữa để hiện đáp án
                  </p>
                )}
              </div>

              {reviewListenCount >= 3 && lesson.steps && (
                <div className="grid grid-cols-1 gap-4">
                  {lesson.steps.step1_5?.questions[reviewIndex].options.map((opt, i) => (
                    <button 
                      key={i}
                      disabled={!!reviewFeedback}
                      onClick={() => {
                        if (lesson.steps) {
                          const isCorrect = i === lesson.steps.step1_5?.questions[reviewIndex].answer;
                          setReviewFeedback({
                            isCorrect,
                            explanation: lesson.steps.step1_5?.questions[reviewIndex].explanation
                          });
                          if (isCorrect) speak("Correct");
                          else speak("Incorrect");
                        }
                      }}
                      className={cn(
                        "w-full p-4 rounded-xl border-2 transition-all font-bold text-lg",
                        reviewFeedback 
                          ? i === lesson.steps.step1_5?.questions[reviewIndex].answer
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                            : reviewFeedback.isCorrect === false && i !== lesson.steps.step1_5?.questions[reviewIndex].answer
                              ? "bg-slate-50 border-slate-100 text-slate-400"
                              : "bg-slate-50 border-slate-100 text-slate-400"
                          : "border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 text-slate-700"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {reviewFeedback && lesson.steps && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-8 p-6 rounded-2xl border text-left",
                    reviewFeedback.isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                  )}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    {reviewFeedback.isCorrect ? <CheckCircle2 className="text-emerald-600" /> : <X className="text-red-600" />}
                    <span className={cn("font-bold", reviewFeedback.isCorrect ? "text-emerald-700" : "text-red-700")}>
                      {reviewFeedback.isCorrect ? "Chính xác!" : "Chưa đúng!"}
                    </span>
                  </div>
                  <p className="text-slate-600">{reviewFeedback.explanation}</p>
                  <button 
                    onClick={() => {
                      if (reviewFeedback.isCorrect && lesson.steps) {
                        setReviewFeedback(null);
                        setReviewListenCount(0);
                        if (reviewIndex < lesson.steps.step1_5?.questions.length - 1) {
                          setReviewIndex(reviewIndex + 1);
                        } else {
                          setStep(3);
                        }
                      } else {
                        setReviewFeedback(null);
                      }
                    }}
                    className="mt-4 w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
                  >
                    {reviewFeedback.isCorrect 
                      ? (reviewIndex < lesson.steps.step1_5?.questions.length - 1 ? "Next Question" : "Next Step")
                      : "Thử lại"}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {lesson.type === 'listening' && step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={3} total={6} title="Audio Practice" icon={Headphones} />
            <div className="max-w-2xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="mb-8">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Question {audioPracticeIndex + 1} of {lesson.steps?.step1_6?.questions.length}</div>
                <h3 className="text-2xl font-bold text-slate-500 mb-6">Listen and choose the correct word</h3>
                <button 
                  onClick={() => {
                    if (lesson.steps) {
                      speak(lesson.steps.step1_6?.questions[audioPracticeIndex].word);
                    }
                  }}
                  className="p-8 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                >
                  <Volume2 className="w-12 h-12" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {lesson.steps?.step1_6?.questions[audioPracticeIndex].options.map((opt, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      if (lesson.steps && i === lesson.steps.step1_6?.questions[audioPracticeIndex].answer) {
                        speak("Correct");
                        if (audioPracticeIndex < lesson.steps.step1_6?.questions.length - 1) {
                          setAudioPracticeIndex(audioPracticeIndex + 1);
                        } else {
                          setStep(4);
                        }
                      } else {
                        speak("Try again");
                      }
                    }}
                    className="w-full p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all font-black text-2xl text-slate-700"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {lesson.type === 'listening' && step === 4 && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={4} total={6} title="Phrase Dictation" icon={TypeIcon} />
            <div className="space-y-6">
              {lesson.steps?.step2.phrases.map((phrase, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl font-black text-slate-300 w-10">{(i + 1).toString().padStart(2, '0')}</span>
                    <div className="flex-1 flex space-x-2">
                      <input 
                        type="text"
                        value={answers.step4[i] || ''}
                        onChange={(e) => {
                          const newAnswers = [...answers.step4];
                          newAnswers[i] = e.target.value;
                          setAnswers({ ...answers, step4: newAnswers });
                        }}
                        placeholder="Type what you hear..."
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-medium transition-all"
                      />
                      <button 
                        onClick={() => checkDictation(i)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
                      >
                        Check
                      </button>
                    </div>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => speak(phrase, 1)}
                        className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                        title="Normal Speed"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => speak(phrase, 0.7)}
                        className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                        title="Slow Speed"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {dictationFeedback[i] && dictationFeedback[i].length > 0 && (
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      {dictationFeedback[i].every(item => item.isCorrect) ? (
                        <>
                          {dictationFeedback[i].map((item, idx) => (
                            <span 
                              key={idx}
                              className="px-2 py-1 rounded font-bold text-lg text-emerald-600"
                            >
                              {item.word}
                            </span>
                          ))}
                          <div className="w-full mt-2 flex items-center space-x-2 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Correct! Well done.</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full flex items-center space-x-2 text-red-500 font-bold">
                          <X className="w-5 h-5" />
                          <span>Still has incorrect words. Listen again!</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-8">
              <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-600 font-bold flex items-center space-x-2">
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button 
                onClick={() => setStep(5)}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
              >
                <span>Next: Gap-fill</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {lesson.type === 'listening' && step === 5 && (
          <motion.div 
            key="step5"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-5xl mx-auto space-y-8"
          >
            <StepHeader current={5} total={6} title="Gap-fill Exercise" icon={FileText} />
            <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm leading-relaxed text-lg text-slate-700">
              <div className="mb-8 p-6 bg-indigo-50 rounded-2xl flex items-center justify-between border border-indigo-100">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-600 p-3 rounded-xl text-white">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-indigo-900">Listen to the segment</h4>
                    <p className="text-sm text-indigo-700">Fill in the blanks as you listen.</p>
                  </div>
                </div>
                {lesson.audioUrl ? (
                  <audio 
                    controls 
                    src={lesson.audioUrl} 
                    className="w-full max-w-xs"
                    onPlay={handleAudioPlay}
                    onTimeUpdate={handleAudioTimeUpdate}
                  />
                ) : (
                  <button 
                    onClick={() => speak(lesson.script || '')}
                    className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-sm"
                  >
                    Play Full Audio
                  </button>
                )}
              </div>

              <div className="whitespace-pre-wrap">
                {lesson.steps?.step3?.gapFillText.replace(/\[\d+\]/g, '[BLANK]').split('[BLANK]').map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <input 
                        type="text"
                        value={answers.step5[i] || ''}
                        onChange={(e) => {
                          const newAnswers = [...answers.step5];
                          newAnswers[i] = e.target.value;
                          setAnswers({ ...answers, step5: newAnswers });
                        }}
                        className={cn(
                          "mx-2 px-3 py-1 w-32 border-b-2 outline-none font-bold bg-indigo-50/30 rounded-t-lg transition-all text-center",
                          gapFillChecked 
                            ? (answers.step5[i] || '').toLowerCase().trim() === lesson.steps?.step3?.blanks[i].toLowerCase().trim()
                              ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                              : "border-red-500 text-red-600 bg-red-50"
                            : "border-indigo-300 focus:border-indigo-600 text-indigo-600"
                        )}
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-8">
              <button onClick={() => setStep(4)} className="text-slate-400 hover:text-slate-600 font-bold flex items-center space-x-2">
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setGapFillChecked(true)}
                  className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-95"
                >
                  Check Answers
                </button>
                <button 
                  onClick={() => setStep(6)}
                  className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                >
                  <span>Next: Comprehension</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {lesson.type === 'listening' && step === 6 && (
          <motion.div 
            key="step6"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <StepHeader current={6} total={6} title="Comprehension Check" icon={HelpCircle} />
            
            {lesson.audioUrl && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="text-indigo-600" />
                  <span className="font-bold text-slate-700">Listen to the segment again</span>
                </div>
                <audio 
                  controls 
                  src={lesson.audioUrl} 
                  className="max-w-xs"
                  onPlay={handleAudioPlay}
                  onTimeUpdate={handleAudioTimeUpdate}
                />
              </div>
            )}

            <div className="space-y-6">
              {lesson.steps?.step4?.questions.map((q, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                  <h3 className="text-xl font-bold text-slate-900">{i + 1}. {q.question}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {q.options.map((opt, optIdx) => (
                      <button 
                        key={optIdx}
                        onClick={() => {
                          const newAnswers = [...answers.step6];
                          newAnswers[i] = optIdx;
                          setAnswers({ ...answers, step6: newAnswers });
                        }}
                        className={cn(
                          "w-full text-left px-6 py-4 rounded-xl border-2 transition-all font-medium",
                          answers.step6[i] === optIdx 
                            ? mcqChecked
                              ? optIdx === q.answer
                                ? "bg-emerald-50 border-emerald-600 text-emerald-700"
                                : "bg-red-50 border-red-600 text-red-700"
                              : "bg-indigo-50 border-indigo-600 text-indigo-700" 
                            : mcqChecked && optIdx === q.answer
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-white border-slate-100 hover:border-indigo-200 text-slate-600"
                        )}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                            answers.step6[i] === optIdx 
                              ? mcqChecked
                                ? optIdx === q.answer ? "bg-emerald-600 border-emerald-600 text-white" : "bg-red-600 border-red-600 text-white"
                                : "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-slate-300 text-slate-400"
                          )}>
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span>{opt}</span>
                          {mcqChecked && optIdx === q.answer && <Check className="w-4 h-4 text-emerald-600 ml-auto" />}
                          {mcqChecked && answers.step6[i] === optIdx && optIdx !== q.answer && <X className="w-4 h-4 text-red-600 ml-auto" />}
                        </div>
                      </button>
                    ))}
                  </div>
                  {mcqChecked && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 italic"
                    >
                      <div className="font-bold text-slate-900 mb-1 flex items-center space-x-2">
                        <Info className="w-4 h-4 text-indigo-600" />
                        <span>Explanation:</span>
                      </div>
                      {q.explanation}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-8">
              <button onClick={() => setStep(5)} className="text-slate-400 hover:text-slate-600 font-bold flex items-center space-x-2">
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setMcqChecked(true)}
                  className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-95"
                >
                  Check Answers
                </button>
                <button 
                  onClick={submitResult}
                  disabled={submitting}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Finishing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Finish Lesson</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 7 && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-white p-12 rounded-3xl border border-slate-200 shadow-2xl text-center"
          >
            {calculateScore() >= 8 ? (
              <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <Trophy className="w-12 h-12 text-emerald-600" />
              </div>
            ) : (
              <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
                <RotateCcw className="w-12 h-12 text-amber-600" />
              </div>
            )}
            
            <h2 className="text-4xl font-extrabold text-slate-900 mb-2">
              {calculateScore() >= 8 ? `Chúc mừng, ${studentName}!` : `Cố gắng lên, ${studentName}!`}
            </h2>
            <p className="text-slate-500 mb-10 text-lg">
              {calculateScore() >= 8 
                ? "Bạn đã hoàn thành bài học xuất sắc và đạt yêu cầu." 
                : "Bạn cần đạt ít nhất 8.0 điểm để hoàn thành bài tập này."}
            </p>
            
            <div className={cn(
              "p-8 rounded-3xl mb-10 transition-colors",
              calculateScore() >= 8 ? "bg-emerald-50" : "bg-amber-50"
            )}>
              <div className={cn(
                "text-6xl font-black mb-2",
                calculateScore() >= 8 ? "text-emerald-600" : "text-amber-600"
              )}>
                {calculateScore()}
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Score</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-10">
              {lesson.type === 'listening' ? (
                <>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-2xl font-bold text-slate-900">{(answers.step5 || []).filter((a: string, i: number) => a?.toLowerCase().trim() === lesson.steps?.step3?.blanks[i].toLowerCase().trim()).length} / {lesson.steps?.step3?.blanks.length}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase mt-1">Gap-fill</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-2xl font-bold text-slate-900">{(answers.step6 || []).filter((a: number, i: number) => a === lesson.steps?.step4?.questions[i].answer).length} / {lesson.steps?.step4?.questions.length}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase mt-1">MCQs</div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="text-2xl font-bold text-slate-900">
                    {(answers.reading || []).filter((a: any, i: number) => {
                      const q = lesson.readingQuestions?.[i];
                      if (!q) return false;
                      if (q.type === 'multipleChoice') return a === q.answer;
                      return (a || '').toLowerCase().trim() === String(q.answer).toLowerCase().trim();
                    }).length} / {lesson.readingQuestions?.length}
                  </div>
                  <div className="text-xs font-bold text-slate-400 uppercase mt-1">Reading Correct</div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => window.location.reload()}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95",
                  calculateScore() >= 8 
                    ? "bg-slate-900 text-white hover:bg-slate-800" 
                    : "bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-100"
                )}
              >
                {calculateScore() >= 8 ? "Làm lại bài tập" : "Làm lại ngay (Bắt buộc)"}
              </button>
              
              {calculateScore() >= 8 && (
                <button 
                  onClick={() => navigate('/student')}
                  className="w-full bg-white text-slate-600 border border-slate-200 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all active:scale-95"
                >
                  Quay lại Dashboard
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepHeader({ current, total, title, icon: Icon }: { current: number, total: number, title: string, icon: any }) {
  return (
    <div className="flex items-center justify-between mb-12">
      <div className="flex items-center space-x-4">
        <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Step {current} of {total}</div>
          <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
        </div>
      </div>
      <div className="flex space-x-2">
        {[1, 2, 3, 4, 5].map(s => (
          <div 
            key={s} 
            className={cn(
              "w-10 h-2 rounded-full transition-all duration-500",
              s <= current ? "bg-indigo-600" : "bg-slate-200"
            )} 
          />
        ))}
      </div>
    </div>
  );
}
