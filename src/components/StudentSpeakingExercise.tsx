import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Mic, CheckCircle2, ChevronRight, Award, History, Info, Play, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lesson, Assignment, PronunciationResult, SpeakingSubmission } from '../types';
import StepProgress from './speaking/StepProgress';
import RecordButton from './speaking/RecordButton';
import AssessmentResult from './speaking/AssessmentResult';
import { mockAssessPronunciation } from '../utils/mockPronunciationAssessment';
import { cn } from '../lib/utils';

interface StudentSpeakingExerciseProps {
  lesson: Lesson;
  assignmentId?: string;
  studentEmail: string;
  studentName: string;
  onComplete: () => void;
}

const StudentSpeakingExercise: React.FC<StudentSpeakingExerciseProps> = ({
  lesson,
  assignmentId,
  studentEmail,
  studentName,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<PronunciationResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  // Store all results for submission
  const [step1Results, setStep1Results] = useState<PronunciationResult[]>([]);
  const [step2Results, setStep2Results] = useState<PronunciationResult[]>([]);
  const [step3Results, setStep3Results] = useState<PronunciationResult[]>([]);
  const [step4Result, setStep4Result] = useState<PronunciationResult | null>(null);

  const extras = lesson.speakingExtras;
  if (!extras) return <div>Invalid speaking lesson data.</div>;

  const currentItems = step === 1 ? extras.speakingVocabulary : 
                       step === 2 ? extras.phrases : 
                       step === 3 ? extras.sentences : 
                       [extras.paragraph];

  const currentTarget = currentItems[currentIndex];
  
  const currentPassingScore = step === 1 ? extras.passingPercentages.vocab :
                              step === 2 ? extras.passingPercentages.phrase :
                              step === 3 ? extras.passingPercentages.sentence :
                              extras.passingPercentages.pronunciation;

  const handleAssessmentResult = (result: PronunciationResult) => {
    setCurrentResult(result);
    setShowResult(true);
  };

  const handleContinue = () => {
    if (!currentResult) return;

    // Save result to respective step array
    if (step === 1) setStep1Results([...step1Results, currentResult]);
    if (step === 2) setStep2Results([...step2Results, currentResult]);
    if (step === 3) setStep3Results([...step3Results, currentResult]);
    if (step === 4) setStep4Result(currentResult);

    setShowResult(false);
    setCurrentResult(null);
    setAttempts(0);

    if (step < 4) {
      if (currentIndex < currentItems.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setStep((step + 1) as any);
        setCurrentIndex(0);
      }
    } else {
      submitResults();
    }
  };

  const submitResults = async () => {
    setLoading(true);
    try {
      const overallScore = Math.round(
        (step1Results.reduce((a, b) => a + b.accuracyScore, 0) / step1Results.length * 0.2) +
        (step2Results.reduce((a, b) => a + b.accuracyScore, 0) / step2Results.length * 0.2) +
        (step3Results.reduce((a, b) => a + b.accuracyScore, 0) / step3Results.length * 0.2) +
        ((step4Result?.pronunciationScore || 0) * 0.4)
      ) / 10; // Out of 10

      await addDoc(collection(db, 'results'), {
        lessonId: lesson.id,
        assignmentId: assignmentId || '',
        studentEmail: studentEmail.toLowerCase().trim(),
        studentName,
        score: overallScore,
        details: {
          speaking: true,
          step1: step1Results,
          step2: step2Results,
          step3: step3Results,
          step4: step4Result
        },
        completedAt: new Date().toISOString()
      });
      onComplete();
    } catch (error) {
      console.error("Error submitting speaking results:", error);
      alert("Lỗi khi lưu kết quả. Vui lòng thử lại.");
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

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <StepProgress 
        currentStep={step} 
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
                {step === 1 ? `Luyện từ ${currentIndex + 1}/${currentItems.length}` : 
                 step === 2 ? `Luyện cụm từ ${currentIndex + 1}/${currentItems.length}` :
                 step === 3 ? `Luyện câu ${currentIndex + 1}/${currentItems.length}` :
                 'Thử thách cuối cùng'}
              </span>
              <h3 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                {currentTarget}
              </h3>
            </div>

            <RecordButton 
              targetText={currentTarget}
              onAssess={(blob) => mockAssessPronunciation(blob, currentTarget)}
              onResult={handleAssessmentResult}
            />

            <div className="mt-20 flex gap-12 items-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-black mb-2 shadow-sm">
                  {currentPassingScore}%
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
              <AssessmentResult 
                result={currentResult}
                passingScore={currentPassingScore}
                showFluency={step === 4}
                attemptsLeft={3 - attempts}
                onRetry={() => {
                  setAttempts(prev => prev + 1);
                  setShowResult(false);
                }}
                onContinue={handleContinue}
              />
            )}
            {loading && (
              <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="font-bold text-slate-600">Đang lưu kết quả...</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentSpeakingExercise;
