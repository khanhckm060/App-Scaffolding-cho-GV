import React from 'react';
import { Check, Mic, Layers, MessageSquare, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StepProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  stepLabels: string[];
}

const StepProgress: React.FC<StepProgressProps> = ({ currentStep, stepLabels }) => {
  const steps = [
    { id: 1, label: stepLabels[0], icon: Mic },
    { id: 2, label: stepLabels[1], icon: Layers },
    { id: 3, label: stepLabels[2], icon: MessageSquare },
    { id: 4, label: stepLabels[3], icon: FileText },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex justify-between items-center relative">
        {/* Progress Line Background */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
        
        {/* Progress Line Active */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
        ></div>

        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isCompleted ? "bg-indigo-600 border-indigo-600 text-white" : 
                  isActive ? "bg-white border-indigo-600 text-indigo-600 scale-110 shadow-lg shadow-indigo-100" : 
                  "bg-white border-slate-200 text-slate-400"
                )}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span 
                className={cn(
                  "mt-2 text-xs font-bold transition-colors duration-300",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepProgress;
