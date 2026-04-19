import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Lesson, Result } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, 
  BookOpen, Headphones, PenTool, Sparkles, Trophy, 
  Info, X, ArrowRight, Volume2, Search, Edit3, Languages,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  checkStep3Correction, 
  checkWritingGrammar, 
  checkParagraphGrammar, 
  explainMCQAnswer,
  WritingCheckResult 
} from '../services/gemini';

export default function WritingLessonView() {
  const { lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const navigate = useNavigate();
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  
  // State for answers
  const [step2Answers, setStep2Answers] = useState<number[]>([]);
  const [step3Answers, setStep3Answers] = useState<string[][]>([]); // Array of corrections for each paragraph
  const [step4Answers, setStep4Answers] = useState<string[]>([]);
  const [step5Answers, setStep5Answers] = useState<string[]>([]); // Merged paragraphs
  
  const [step3Results, setStep3Results] = useState<(WritingCheckResult | null)[][]>([]);
  const [step4Results, setStep4Results] = useState<(WritingCheckResult | null)[]>([]);
  const [step5Results, setStep5Results] = useState<(WritingCheckResult | null)[]>([]);
  const [step2ResultsVisibility, setStep2ResultsVisibility] = useState<boolean[]>([]);
  const [step2DynamicFeedback, setStep2DynamicFeedback] = useState<string[]>([]);
  const [checking, setChecking] = useState<string | null>(null);

  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId) return;
      try {
        const docSnap = await getDoc(doc(db, 'lessons', lessonId));
        if (docSnap.exists()) {
          const data = docSnap.data() as Lesson;
          setLesson(data);
          // Initialize answers
          if (data.writingSteps) {
            setStep2Answers(new Array(data.writingSteps.step2.questions.length).fill(-1));
            setStep2ResultsVisibility(new Array(data.writingSteps.step2.questions.length).fill(false));
            setStep2DynamicFeedback(new Array(data.writingSteps.step2.questions.length).fill(''));
            setStep3Answers(data.writingSteps.step3.paragraphs.map(p => new Array(p.errors.length).fill('')));
            setStep3Results(data.writingSteps.step3.paragraphs.map(p => new Array(p.errors.length).fill(null)));
            setStep4Answers(new Array(data.writingSteps.step4.questions.length).fill(''));
            setStep4Results(new Array(data.writingSteps.step4.questions.length).fill(null));
            setStep5Answers(new Array(data.writingSteps.step5.paragraphs.length).fill(''));
            setStep5Results(new Array(data.writingSteps.step5.paragraphs.length).fill(null));
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `lessons/${lessonId}`);
      }
      setLoading(false);
    };
    fetchLesson();
  }, [lessonId]);

  const calculateScore = () => {
    if (!lesson?.writingSteps) return 0;
    const steps = lesson.writingSteps;
    
    let totalPoints = 0;
    let earnedPoints = 0;

    // Step 2: MCQs
    totalPoints += steps.step2.questions.length;
    earnedPoints += step2Answers.reduce((acc, ans, idx) => 
      acc + (ans === steps.step2.questions[idx].answer ? 1 : 0), 0);

    // Step 3: Error Identification
    steps.step3.paragraphs.forEach((p, pIdx) => {
      totalPoints += p.errors.length;
      p.errors.forEach((err, eIdx) => {
        if (step3Results[pIdx]?.[eIdx]?.correct) {
          earnedPoints += 1;
        }
      });
    });

    // Step 4: Sentence Translation
    totalPoints += steps.step4.questions.length;
    step4Answers.forEach((ans, idx) => {
      if (step4Results[idx]?.correct) earnedPoints += 1;
    });

    // Step 5: Paragraph Translation
    totalPoints += steps.step5.paragraphs.length;
    step5Answers.forEach((ans, idx) => {
      if (step5Results[idx]?.correct) earnedPoints += 1;
    });

    return Math.round((earnedPoints / totalPoints) * 10);
  };

  const handleCheckStep2 = async (idx: number) => {
    if (!lesson?.writingSteps) return;
    const q = lesson.writingSteps.step2.questions[idx];
    const selectedIdx = step2Answers[idx];
    if (selectedIdx === -1) return;

    const selectedText = q.options[selectedIdx];
    const correctText = q.options[q.answer];
    const isCorrect = selectedIdx === q.answer;

    setChecking(`step2-${idx}`);
    try {
      const feedback = await explainMCQAnswer(q.question, q.options, selectedText, isCorrect, correctText);
      const newFeedback = [...step2DynamicFeedback];
      newFeedback[idx] = feedback;
      setStep2DynamicFeedback(newFeedback);
      
      const newVis = [...step2ResultsVisibility];
      newVis[idx] = true;
      setStep2ResultsVisibility(newVis);
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  const handleCheckStep3 = async (pIdx: number, eIdx: number) => {
    if (!lesson?.writingSteps) return;
    const error = lesson.writingSteps.step3.paragraphs[pIdx].errors[eIdx];
    const answer = step3Answers[pIdx][eIdx];
    
    setChecking(`step3-${pIdx}-${eIdx}`);
    try {
      const result = await checkStep3Correction(error.original, error.correction, answer);
      const newResults = [...step3Results];
      newResults[pIdx][eIdx] = result;
      setStep3Results(newResults);
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  const handleCheckStep4 = async (idx: number) => {
    if (!lesson?.writingSteps) return;
    const q = lesson.writingSteps.step4.questions[idx];
    const answer = step4Answers[idx];

    setChecking(`step4-${idx}`);
    try {
      const result = await checkWritingGrammar(q.vietnamese, q.english, answer);
      const newResults = [...step4Results];
      newResults[idx] = result;
      setStep4Results(newResults);
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  const handleCheckStep5 = async (pIdx: number) => {
    if (!lesson?.writingSteps) return;
    const p = lesson.writingSteps.step5.paragraphs[pIdx];
    const answer = step5Answers[pIdx];
    const reference = `${p.english.topicSentence} ${p.english.supportingSentence} ${p.english.example}`;

    setChecking(`step5-${pIdx}`);
    try {
      const result = await checkParagraphGrammar(p.topic, reference, answer);
      const newResults = [...step5Results];
      newResults[pIdx] = result;
      setStep5Results(newResults);
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  const handleSubmit = async () => {
    const finalScore = calculateScore();
    setScore(finalScore);
    
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, 'results'), {
          lessonId,
          assignmentId,
          studentName: auth.currentUser.displayName || 'Học sinh',
          studentEmail: auth.currentUser.email,
          score: finalScore,
          details: {
            writing_step2_correct: step2Answers.filter((ans, idx) => ans === lesson?.writingSteps?.step2.questions[idx].answer).length,
            // ... add more details ...
          },
          completedAt: new Date().toISOString(),
          teacherId: lesson?.teacherId
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'results');
      }
    }
    
    setCompleted(true);
  };

  if (loading) return <div className="text-center py-12">Đang tải bài học...</div>;
  if (!lesson || !lesson.writingSteps) return <div className="text-center py-12 text-red-500">Không tìm thấy bài học.</div>;

  const steps = lesson.writingSteps;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-lg">
            <PenTool className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{lesson.title}</h2>
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Step {currentStep} of 5</span>
              <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500" 
                  style={{ width: `${(currentStep / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={() => navigate('/student')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!completed ? (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl"
          >
            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="flex items-center space-x-3 mb-6">
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-2xl font-bold text-slate-900">Step 1: Ôn tập từ vựng</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {steps.step1.vocabulary.map((vocab, i) => (
                    <div key={i} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xl font-bold text-slate-900">{vocab.word}</h4>
                        <button 
                          onClick={() => {
                            const utterance = new SpeechSynthesisUtterance(vocab.word);
                            utterance.lang = 'en-US';
                            window.speechSynthesis.speak(utterance);
                          }}
                          className="p-2 bg-white rounded-xl shadow-sm hover:bg-indigo-50 text-indigo-600 transition-colors"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm font-mono text-indigo-600 mb-2">{vocab.ipa}</p>
                      <p className="text-slate-700 font-medium mb-4">{vocab.vietnameseDefinition}</p>
                      <div className="p-3 bg-white rounded-xl text-xs text-slate-500 italic border border-slate-100">
                        "{vocab.example}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-8">
                <div className="flex items-center space-x-3 mb-6">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-2xl font-bold text-slate-900">Step 2: Luyện tập Ngữ pháp (MCQs)</h3>
                </div>
                <div className="space-y-12">
                  {steps.step2.questions.map((q, qIdx) => (
                    <div key={qIdx} className="space-y-4">
                      <p className="text-lg font-bold text-slate-800">
                        <span className="text-indigo-600 mr-2">Question {qIdx + 1}:</span>
                        {q.question}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            onClick={() => {
                              const newAns = [...step2Answers];
                              newAns[qIdx] = oIdx;
                              setStep2Answers(newAns);
                              // Reset visibility if they change answer
                              const newVis = [...step2ResultsVisibility];
                              newVis[qIdx] = false;
                              setStep2ResultsVisibility(newVis);
                            }}
                            className={cn(
                              "p-4 rounded-2xl border-2 text-left transition-all font-medium",
                              step2Answers[qIdx] === oIdx 
                                ? "border-indigo-600 bg-indigo-50 text-indigo-700" 
                                : "border-slate-100 hover:border-slate-200 text-slate-600"
                            )}
                          >
                            <span className="inline-block w-8 h-8 rounded-lg bg-white border border-slate-200 text-center leading-8 mr-3 font-bold">
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            {opt}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex justify-start">
                        <button
                          onClick={() => handleCheckStep2(qIdx)}
                          disabled={checking !== null || step2Answers[qIdx] === -1}
                          className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 disabled:opacity-50 transition-all flex items-center space-x-2"
                        >
                          {checking === `step2-${qIdx}` ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4" />}
                          <span>Check Đáp án</span>
                        </button>
                      </div>

                      {(step2ResultsVisibility[qIdx] || showFeedback) && (
                        <div className={cn(
                          "p-4 rounded-2xl text-sm",
                          step2Answers[qIdx] === q.answer ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        )}>
                          <p className="font-bold mb-1">
                            {step2Answers[qIdx] === q.answer ? "Chính xác!" : "Chưa đúng."}
                          </p>
                          <p className="opacity-90">{step2DynamicFeedback[qIdx] || q.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="flex items-center space-x-3 mb-6">
                  <Search className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-2xl font-bold text-slate-900">Step 3: Tìm lỗi sai Ngữ pháp</h3>
                </div>
                <div className="space-y-12">
                  {steps.step3.paragraphs.map((p, pIdx) => (
                    <div key={pIdx} className="space-y-6">
                      <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 leading-relaxed text-lg text-slate-700 shadow-inner">
                        {p.text}
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 flex items-center">
                          <Edit3 className="w-4 h-4 mr-2" />
                          Sửa lỗi sai trong đoạn văn trên:
                        </h4>
                        {p.errors.map((err, eIdx) => (
                          <div key={eIdx} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-red-700 text-sm italic">
                              Lỗi: "{err.original}"
                            </div>
                            <div className="space-y-2">
                              <div className="flex space-x-2">
                                <input 
                                  type="text"
                                  value={step3Answers[pIdx][eIdx]}
                                  onChange={e => {
                                    const newAns = [...step3Answers];
                                    newAns[pIdx][eIdx] = e.target.value;
                                    setStep3Answers(newAns);
                                    // Reset result if student changes answer
                                    const newResults = [...step3Results];
                                    newResults[pIdx][eIdx] = null;
                                    setStep3Results(newResults);
                                  }}
                                  placeholder="Nhập bản sửa lỗi..."
                                  className={cn(
                                    "flex-1 px-4 py-3 rounded-xl border-2 outline-none transition-all",
                                    step3Results[pIdx][eIdx]?.correct ? "border-emerald-500 bg-emerald-50" : "border-slate-100 focus:border-indigo-500"
                                  )}
                                />
                                <button
                                  onClick={() => handleCheckStep3(pIdx, eIdx)}
                                  disabled={checking !== null || !step3Answers[pIdx][eIdx].trim()}
                                  className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center"
                                >
                                  {checking === `step3-${pIdx}-${eIdx}` ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Check"
                                  )}
                                </button>
                              </div>
                              {step3Results[pIdx][eIdx] && (
                                <div className={cn(
                                  "p-3 rounded-xl text-xs",
                                  step3Results[pIdx][eIdx]?.correct ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700 border border-red-100"
                                )}>
                                  <div className="flex items-start space-x-2">
                                    {step3Results[pIdx][eIdx]?.correct ? <CheckCircle2 className="w-3 h-3 mt-0.5" /> : <AlertCircle className="w-3 h-3 mt-0.5" />}
                                    <p>{step3Results[pIdx][eIdx]?.feedback}</p>
                                  </div>
                                </div>
                              )}
                              {showFeedback && (
                                <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-700">
                                  <p className="font-bold">Đáp án: {err.correction}</p>
                                  <p className="opacity-80">{err.explanation}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-8">
                <div className="flex items-center space-x-3 mb-6">
                  <Languages className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-2xl font-bold text-slate-900">Step 4: Dịch câu Việt - Anh</h3>
                </div>
                <div className="space-y-12">
                  {steps.step4.questions.map((q, i) => (
                    <div key={i} className="space-y-4">
                      <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <p className="text-lg font-bold text-indigo-900">{q.vietnamese}</p>
                      </div>
                      <div className="relative">
                        <textarea 
                          value={step4Answers[i]}
                          onChange={e => {
                            const newAns = [...step4Answers];
                            newAns[i] = e.target.value;
                            setStep4Answers(newAns);
                            const newRes = [...step4Results];
                            newRes[i] = null;
                            setStep4Results(newRes);
                          }}
                          placeholder="Nhập bản dịch tiếng Anh của bạn..."
                          className={cn(
                            "w-full p-6 rounded-2xl border-2 outline-none transition-all min-h-[120px] pr-32",
                            step4Results[i]?.correct ? "border-emerald-500 bg-emerald-50" : "border-slate-100 focus:border-indigo-500"
                          )}
                        />
                        <button
                          onClick={() => handleCheckStep4(i)}
                          disabled={checking !== null || !step4Answers[i].trim()}
                          className="absolute bottom-4 right-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center"
                        >
                          {checking === `step4-${i}` ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PenTool className="w-4 h-4 mr-2" />}
                          Check Đáp án
                        </button>
                      </div>
                      {step4Results[i] && (
                        <div className={cn(
                          "p-6 rounded-2xl border",
                          step4Results[i]?.correct ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
                        )}>
                          <div className="flex items-start space-x-3">
                            {step4Results[i]?.correct ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-1" /> : <AlertCircle className="w-5 h-5 text-red-600 mt-1" />}
                            <div>
                              <p className="font-bold mb-2">{step4Results[i]?.correct ? "Chính xác!" : "Cần chỉnh sửa:"}</p>
                              <p className="text-sm mb-4">{step4Results[i]?.feedback}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {showFeedback && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Đáp án gợi ý:</p>
                          <p className="text-indigo-600 font-bold mb-2">{q.english}</p>
                          <p className="text-sm text-slate-600">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-8">
                <div className="flex items-center space-x-3 mb-6">
                  <PenTool className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-2xl font-bold text-slate-900">Step 5: Viết đoạn văn IELTS</h3>
                </div>
                <div className="space-y-12">
                  {steps.step5.paragraphs.map((p, pIdx) => (
                    <div key={pIdx} className="space-y-8">
                      <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                        <h4 className="text-lg font-bold text-amber-900 mb-2">Topic: {p.topic}</h4>
                        <div className="space-y-2 text-sm text-amber-700">
                          <p className="font-medium italic">Viết một đoạn văn hoàn chỉnh dựa trên các câu tiếng Việt sau:</p>
                          <ul className="list-disc list-inside ml-2 space-y-1">
                            <li>Topic Sentence: {p.vietnamese.topicSentence}</li>
                            <li>Supporting Sentence: {p.vietnamese.supportingSentence}</li>
                            <li>Example: {p.vietnamese.example}</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="relative">
                          <textarea 
                            value={step5Answers[pIdx]}
                            onChange={e => {
                              const newAns = [...step5Answers];
                              newAns[pIdx] = e.target.value;
                              setStep5Answers(newAns);
                              const newRes = [...step5Results];
                              newRes[pIdx] = null;
                              setStep5Results(newRes);
                            }}
                            className={cn(
                              "w-full p-8 rounded-3xl border-2 outline-none transition-all min-h-[250px] text-lg leading-relaxed",
                              step5Results[pIdx]?.correct ? "border-emerald-500 bg-emerald-50" : "border-slate-100 focus:border-indigo-500"
                            )}
                            placeholder="Viết đoạn văn của bạn ở đây (gom 3 câu vào một đoạn)..."
                          />
                          <button
                            onClick={() => handleCheckStep5(pIdx)}
                            disabled={checking !== null || !step5Answers[pIdx].trim()}
                            className="absolute bottom-6 right-6 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center shadow-lg"
                          >
                            {checking === `step5-${pIdx}` ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Languages className="w-5 h-5 mr-2" />}
                            Check Đáp án
                          </button>
                        </div>
                      </div>

                      {step5Results[pIdx] && (
                        <div className={cn(
                          "p-8 rounded-[2.5rem] border",
                          step5Results[pIdx]?.correct ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
                        )}>
                          <div className="flex items-start space-x-4">
                            {step5Results[pIdx]?.correct ? <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-1" /> : <AlertCircle className="w-6 h-6 text-red-600 mt-1" />}
                            <div>
                              <h5 className="text-xl font-bold mb-3">{step5Results[pIdx]?.correct ? "Đoạn văn đạt yêu cầu!" : "Lưu ý về ngữ pháp & nội dung:"}</h5>
                              <p className="text-slate-700 leading-relaxed mb-6 whitespace-pre-wrap">{step5Results[pIdx]?.feedback}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {showFeedback && (
                        <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đoạn văn mẫu hoàn chỉnh:</p>
                          <div className="space-y-2 text-slate-700 leading-relaxed">
                            <p><span className="font-bold text-indigo-600">Topic:</span> {p.english.topicSentence}</p>
                            <p><span className="font-bold text-indigo-600">Support:</span> {p.english.supportingSentence}</p>
                            <p><span className="font-bold text-indigo-600">Example:</span> {p.english.example}</p>
                          </div>
                          <div className="pt-4 border-t border-slate-200 text-sm text-slate-600">
                            <p className="font-bold mb-1">Phân tích:</p>
                            <p>{p.explanation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Quay lại</span>
              </button>
              
              <div className="flex items-center space-x-3">
                {currentStep < 2 && (
                  <button
                    onClick={() => setShowFeedback(!showFeedback)}
                    className={cn(
                      "px-6 py-3 rounded-xl font-bold transition-all flex items-center space-x-2",
                      showFeedback ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                    )}
                  >
                    <Info className="w-5 h-5" />
                    <span>{showFeedback ? "Ẩn giải thích" : "Xem giải thích"}</span>
                  </button>
                )}

                {currentStep < 5 ? (
                  <button
                    onClick={() => {
                      setCurrentStep(prev => prev + 1);
                      setShowFeedback(false);
                    }}
                    className="flex items-center space-x-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                  >
                    <span>Tiếp theo</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="flex items-center space-x-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Hoàn thành & Nộp bài</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[3rem] p-12 text-center border border-slate-200 shadow-2xl"
          >
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <Trophy className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="text-4xl font-bold text-slate-900 mb-4">Chúc mừng bạn!</h3>
            <p className="text-slate-500 text-lg mb-8">Bạn đã hoàn thành bài tập viết chuyên sâu.</p>
            
            <div className="bg-slate-50 rounded-3xl p-8 max-w-sm mx-auto mb-10 border border-slate-100">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Điểm số của bạn</p>
              <p className="text-6xl font-black text-indigo-600">{score}<span className="text-2xl text-slate-300">/10</span></p>
            </div>

            <button
              onClick={() => navigate('/student')}
              className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl"
            >
              Quay lại Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
