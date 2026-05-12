import React from 'react';
import { PronunciationResult } from '../../types';
import { cn } from '../../lib/utils';
import { CheckCircle2, XCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface AssessmentResultProps {
  result: PronunciationResult;
  passingScore: number;       // % để pass
  showFluency?: boolean;      // Chỉ Step 4
  onContinue?: () => void;
  onRetry?: () => void;
  attemptsLeft?: number;
}

const AssessmentResult: React.FC<AssessmentResultProps> = ({ 
  result, 
  passingScore, 
  showFluency = false,
  onContinue,
  onRetry,
  attemptsLeft = 3
}) => {
  const isPassed = result.accuracyScore >= passingScore;

  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-xl mx-auto w-full">
      <div className="flex flex-col items-center">
        {/* Circle Score */}
        <div className="relative w-40 h-40 mb-6">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="74"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-slate-100"
            />
            <circle
              cx="80"
              cy="80"
              r="74"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={465}
              strokeDashoffset={465 - (465 * result.accuracyScore) / 100}
              className={cn(
                "transition-all duration-1000",
                isPassed ? "text-emerald-500" : "text-amber-500"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold text-slate-900">{result.accuracyScore}%</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Độ chính xác</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "flex items-center px-6 py-2 rounded-full mb-8 font-bold text-lg",
          isPassed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        )}>
          {isPassed ? (
            <><CheckCircle2 className="w-6 h-6 mr-2" /> Tuyệt vời! Đã đạt</>
          ) : (
            <><XCircle className="w-6 h-6 mr-2" /> Chưa đạt yêu cầu ({passingScore}%)</>
          )}
        </div>

        {/* Word Breakdown */}
        <div className="w-full mb-8">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Chi tiết từng từ:</h4>
          <div className="flex flex-wrap gap-2 justify-center">
            {result.words.map((word, idx) => (
              <div 
                key={idx}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all relative group",
                  word.accuracyScore >= 90 ? "bg-emerald-50 text-emerald-700" :
                  word.accuracyScore >= 70 ? "bg-amber-50 text-amber-700" :
                  "bg-rose-50 text-rose-700 border-b-2 border-rose-300"
                )}
              >
                {word.word}
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-40">
                  <div className="bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-xl">
                    <p className="font-bold">Độ chính xác: {word.accuracyScore}%</p>
                    {word.errorType !== 'None' && <p className="text-rose-400 mt-1">Lỗi: {word.errorType}</p>}
                  </div>
                  <div className="w-2 h-2 bg-slate-900 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fluency Score for Step 4 */}
        {showFluency && (
          <div className="w-full bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-slate-600">Độ trôi chảy (Fluency)</span>
              <span className="text-indigo-600 font-extrabold">{result.fluencyScore}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-1000"
                style={{ width: `${result.fluencyScore}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 w-full">
          {!isPassed && attemptsLeft > 0 && (
            <button 
              onClick={onRetry}
              className="flex-1 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all"
            >
              <RotateCcw className="w-5 h-5 mr-2" /> Thử lại ({attemptsLeft})
            </button>
          )}
          {(isPassed || attemptsLeft === 0) && onContinue && (
            <button 
              onClick={onContinue}
              className="flex-1 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all"
            >
              Tiếp theo <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentResult;
