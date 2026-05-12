import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Mic, CheckCircle2, ChevronRight, Award, History, Info, Play, Loader2, SkipForward, Check, X, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lesson, PronunciationResult } from '../types';
import StepProgress from './speaking/StepProgress';
import RecordButton from './speaking/RecordButton';
import AssessmentResult from './speaking/AssessmentResult';
import { mockAssessPronunciation } from '../utils/mockPronunciationAssessment';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { cn } from '../lib/utils';

interface StudentSpeakingExerciseProps {
  lesson: Lesson;
  assignmentId?: string;
  studentEmail: string;
  studentName: string;
  onComplete: () => void;
}

interface StepItemResult {
  item: string;
  passed: boolean;
  skipped: boolean;
  bestScore: number;
}

const StudentSpeakingExercise: React.FC<StudentSpeakingExerciseProps> = ({
  lesson,
  assignmentId,
  studentEmail,
  studentName,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<PronunciationResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const { speak, isSpeaking, supported } = useSpeechSynthesis();

  // Store results for each step
  const [stepResults, setStepResults] = useState<{
    step1: StepItemResult[];
    step2: StepItemResult[];
    step3: StepItemResult[];
    step4: PronunciationResult | null;
  }>({ step1: [], step2: [], step3: [], step4: null });

  const extras = lesson.speakingExtras;
  if (!extras) return <div>Invalid speaking lesson data.</div>;

  const items = useMemo(() => {
    if (currentStep === 1) return extras.speakingVocabulary;
    if (currentStep === 2) return extras.phrases;
    if (currentStep === 3) return extras.sentences;
    return [extras.cleanedParagraph || extras.paragraph];
  }, [currentStep, extras]);

  const currentItem = items[currentItemIndex];
  
  const passingScore = useMemo(() => {
    if (currentStep === 1) return extras.passingPercentages.vocab;
    if (currentStep === 2) return extras.passingPercentages.phrase;
    if (currentStep === 3) return extras.passingPercentages.sentence;
    return extras.passingPercentages.pronunciation;
  }, [currentStep, extras]);

  const handleAssessmentResult = (result: PronunciationResult) => {
    setCurrentResult(result);
    setShowResult(true);

    // If passed, auto-continue after 1.5s
    if (result.accuracyScore >= passingScore) {
      if (currentStep < 4 || (result.fluencyScore >= extras.passingPercentages.fluency)) {
        setTimeout(() => {
          if (showResult) handleContinue(result);
        }, 1500);
      }
    }
  };

  const handleContinue = (resultOverride?: PronunciationResult) => {
    const resultToUse = resultOverride || currentResult;
    if (!resultToUse) return;

    const passed = resultToUse.accuracyScore >= passingScore;
    
    // Save result
    const newResult: StepItemResult = {
      item: currentItem,
      passed,
      skipped: false,
      bestScore: resultToUse.accuracyScore
    };

    if (currentStep === 1) setStepResults(prev => ({ ...prev, step1: [...prev.step1, newResult] }));
    else if (currentStep === 2) setStepResults(prev => ({ ...prev, step2: [...prev.step2, newResult] }));
    else if (currentStep === 3) setStepResults(prev => ({ ...prev, step3: [...prev.step3, newResult] }));
    else if (currentStep === 4) setStepResults(prev => ({ ...prev, step4: resultToUse }));

    proceed();
  };

  const handleSkip = () => {
    const skipResult: StepItemResult = {
      item: currentItem,
      passed: false,
      skipped: true,
      bestScore: 0
    };

    if (currentStep === 1) setStepResults(prev => ({ ...prev, step1: [...prev.step1, skipResult] }));
    else if (currentStep === 2) setStepResults(prev => ({ ...prev, step2: [...prev.step2, skipResult] }));
    else if (currentStep === 3) setStepResults(prev => ({ ...prev, step3: [...prev.step3, skipResult] }));
    
    proceed();
  };

  const proceed = () => {
    setShowResult(false);
    setCurrentResult(null);
    setAttempts(0);

    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
    } else {
      if (currentStep < 4) {
        setCurrentStep((currentStep + 1) as any);
        setCurrentItemIndex(0);
      } else {
        setIsFinished(true);
      }
    }
  };

  const submitResults = async () => {
    setLoading(true);
    try {
      const calculateAvg = (results: StepItemResult[]) => 
        results.length > 0 ? results.reduce((a, b) => a + b.bestScore, 0) / results.length : 0;

      const s1Avg = calculateAvg(stepResults.step1);
      const s2Avg = calculateAvg(stepResults.step2);
      const s3Avg = calculateAvg(stepResults.step3);
      const s4Score = stepResults.step4?.accuracyScore || 0;
      const s4Fluency = stepResults.step4?.fluencyScore || 0;

      // Overall Score Out of 100
      // Step 1: 15%, Step 2: 20%, Step 3: 25%, Step 4: 40% (split into Pronunciation 25% + Fluency 15%)
      const overallScore = Math.round(
        (s1Avg * 0.15 + s2Avg * 0.20 + s3Avg * 0.25 + s4Score * 0.25 + s4Fluency * 0.15)
      );

      const submissionData = {
        lessonId: lesson.id,
        assignmentId: assignmentId || '',
        studentEmail: studentEmail.toLowerCase().trim(),
        studentName,
        score: overallScore,
        details: {
          step1: stepResults.step1,
          step2: stepResults.step2,
          step3: stepResults.step3,
          step4: stepResults.step4
        },
        completedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'speaking_submissions'), submissionData);
      
      // Also save to generic results for compatibility
      await addDoc(collection(db, 'results'), {
        ...submissionData,
        details: { speaking: true, ...submissionData.details }
      });

      onComplete();
    } catch (error) {
      console.error("Error submitting results:", error);
      alert("Lỗi khi lưu kết quả. Vui lòng kiểm tra kết nối mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (!isStarted) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] p-10 border border-slate-200 shadow-xl shadow-indigo-50"
        >
          <div className="flex items-center mb-8">
            <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-100 mr-6">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{lesson.title}</h2>
              <p className="text-slate-500 font-bold flex items-center mt-1">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs mr-2">{lesson.level}</span> Luyện phát âm
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 mb-8">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
              <Info className="w-4 h-4 mr-1 text-indigo-500" /> Hướng dẫn
            </h4>
            <div className="space-y-4 text-slate-600 font-medium">
              <p>Bài luyện tập gồm 4 bước:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center bg-white p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">1</span>
                  Luyện phát âm từ vựng chính
                </div>
                <div className="flex items-center bg-white p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">2</span>
                  Luyện phát âm cụm từ (Phrases)
                </div>
                <div className="flex items-center bg-white p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">3</span>
                  Luyện phát âm câu hoàn chỉnh
                </div>
                <div className="flex items-center bg-white p-3 rounded-xl border border-slate-100">
                  <span className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">4</span>
                  Đọc toàn bộ đoạn văn
                </div>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Nội dung bài học:</h4>
            <div className="text-2xl font-bold text-slate-800 leading-relaxed bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
              {extras.paragraph}
            </div>
          </div>

          <button 
            onClick={() => setIsStarted(true)}
            className="w-full bg-slate-900 border-b-4 border-slate-950 hover:bg-slate-800 text-white font-extrabold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center text-xl group"
          >
            Bắt đầu luyện tập <Play className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    );
  }

  if (isFinished) {
    const s1Passed = stepResults.step1.filter(r => r.passed).length;
    const s2Passed = stepResults.step2.filter(r => r.passed).length;
    const s3Passed = stepResults.step3.filter(r => r.passed).length;

    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[2rem] p-10 border border-slate-200 shadow-xl text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
            <Award className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Hoàn thành bài luyện tập!</h2>
          <p className="text-slate-500 font-bold mb-10">Chúc mừng bạn đã nỗ lực luyện phát âm hôm nay.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 text-left">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Step 1: Từ vựng</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-slate-700">{s1Passed}/{stepResults.step1.length} đạt</span>
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Step 2: Cụm từ</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-slate-700">{s2Passed}/{stepResults.step2.length} đạt</span>
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Step 3: Câu</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-slate-700">{s3Passed}/{stepResults.step3.length} đạt</span>
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Step 4: Tổng quát</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-slate-700">{stepResults.step4?.pronunciationScore}% Phát âm</span>
                <span className="text-lg font-bold text-indigo-600">{stepResults.step4?.fluencyScore}% Trôi chảy</span>
              </div>
            </div>
          </div>

          <button 
            onClick={submitResults}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center text-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Nộp kết quả & Kết thúc"}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <StepProgress 
        currentStep={currentStep} 
        stepLabels={['Từ vựng', 'Cụm từ', 'Câu', 'Đoạn văn']} 
      />

      <AnimatePresence mode="wait">
        {!showResult ? (
          <motion.div 
            key="exercise"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center py-12"
          >
            <div className="text-center mb-12 max-w-2xl">
              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                {currentStep === 1 ? `Luyện từ ${currentItemIndex + 1}/${items.length}` : 
                 currentStep === 2 ? `Luyện cụm từ ${currentItemIndex + 1}/${items.length}` :
                 currentStep === 3 ? `Luyện câu ${currentItemIndex + 1}/${items.length}` :
                 'Thử thách cuối cùng'}
              </span>
              <h3 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
                {currentItem}
              </h3>
              
              {supported && (
                <button 
                  onClick={() => speak(currentItem)}
                  className={cn(
                    "inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl font-bold transition-all",
                    isSpeaking 
                      ? "bg-indigo-100 text-indigo-700 animate-pulse" 
                      : "bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                  )}
                >
                  <Volume2 className={cn("w-5 h-5", isSpeaking && "animate-bounce")} />
                  {isSpeaking ? "Đang phát..." : "Nghe mẫu"}
                </button>
              )}
            </div>

            <RecordButton 
              targetText={currentItem}
              onAssess={(blob) => mockAssessPronunciation(blob, currentItem)}
              onResult={handleAssessmentResult}
            />

            <div className="mt-20 flex gap-12 items-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-black mb-2 shadow-sm">
                  {passingScore}%
                </div>
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Yêu cầu đạt</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-amber-600 font-black mb-2 shadow-sm">
                  {3 - attempts}
                </div>
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Số lần thử lại</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {currentResult && (
              <div className="space-y-6">
                <AssessmentResult 
                  result={currentResult}
                  passingScore={passingScore}
                  showFluency={currentStep === 4}
                  attemptsLeft={3 - attempts}
                  onRetry={() => {
                    setAttempts(prev => prev + 1);
                    setShowResult(false);
                  }}
                  onContinue={() => handleContinue()}
                />
                
                {!currentResult.accuracyScore || (currentResult.accuracyScore < passingScore && attempts >= 2 && currentStep < 4 && (
                  <button 
                    onClick={handleSkip}
                    className="w-full max-w-xl mx-auto flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold transition-colors"
                  >
                    Bỏ qua từ này <SkipForward className="w-5 h-5 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentSpeakingExercise;
