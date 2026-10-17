import { Upload, Search, FileText, CheckCircle } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
}

const STEPS = [
  { num: 1, label: 'Upload', icon: Upload },
  { num: 2, label: 'Analyze', icon: Search },
  { num: 3, label: 'Explain', icon: FileText },
  { num: 4, label: 'Conclusion', icon: CheckCircle },
];

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center mb-10">
      <div className="flex items-center gap-2 sm:gap-4">
        {STEPS.map((step, i) => {
          const isActive = currentStep === step.num;
          const isComplete = currentStep > step.num;
          const Icon = step.icon;

          return (
            <div key={step.num} className="flex items-center gap-2 sm:gap-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-500 relative ${
                    isActive
                      ? 'gradient-spider spider-glow scale-110'
                      : isComplete
                      ? 'bg-green-500/20 border border-green-500/40'
                      : 'glass border border-white/5'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors duration-300 ${
                      isActive
                        ? 'text-white'
                        : isComplete
                        ? 'text-green-400'
                        : 'text-gray-600'
                    }`}
                  />
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl border-2 border-red-500/40 animate-pulse-ring" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors duration-300 hidden sm:block ${
                    isActive
                      ? 'text-white'
                      : isComplete
                      ? 'text-green-400'
                      : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="relative w-8 sm:w-16 h-0.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-green-500 to-red-500 transition-transform duration-700 origin-left ${
                      isComplete ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
