import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RotateCcw, ShieldX, ShieldCheck } from 'lucide-react';

interface ConclusionStepProps {
  isAI: boolean;
  confidence: number;
  mediaType: 'image' | 'video';
  onReset: () => void;
}

export default function ConclusionStep({ isAI, confidence, mediaType, onReset }: ConclusionStepProps) {
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowVerdict(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const mediaNoun = mediaType === 'video' ? 'video' : 'image';

  return (
    <div className="animate-fade-in">
      {/* Verdict Card */}
      <div
        className={`relative rounded-2xl p-8 sm:p-12 text-center overflow-hidden ${
          isAI
            ? 'glass border border-red-500/20 spider-glow'
            : 'glass border border-green-500/20 spider-glow-blue'
        }`}
      >
        {/* Background glow */}
        <div
          className={`absolute inset-0 pointer-events-none ${
            isAI
              ? 'bg-gradient-radial from-red-500/10 to-transparent'
              : 'bg-gradient-radial from-green-500/10 to-transparent'
          }`}
          style={{
            background: isAI
              ? 'radial-gradient(circle at center, rgba(230,36,41,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle at center, rgba(34,197,94,0.08) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {showVerdict ? (
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center animate-scale-pop ${
                  isAI
                    ? 'bg-red-500/15 border-2 border-red-500/40'
                    : 'bg-green-500/15 border-2 border-green-500/40'
                }`}
              >
                {isAI ? (
                  <ShieldX className="w-10 h-10 text-red-400" />
                ) : (
                  <ShieldCheck className="w-10 h-10 text-green-400" />
                )}
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-white/10 animate-spin-slow" />
            )}
          </div>

          {/* Verdict */}
          {showVerdict && (
            <div className="animate-fade-up">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">
                Final Verdict
              </p>
              <h2
                className={`text-3xl sm:text-4xl md:text-5xl font-black mb-4 ${
                  isAI ? 'text-red-500 text-glow' : 'text-green-400'
                }`}
              >
                {isAI ? 'Possible AI / Manipulation Signals' : 'No Strong Signals Detected'}
              </h2>

              <p className="text-gray-400 max-w-md mx-auto mb-6 text-sm leading-relaxed">
                {isAI
                  ? `This ${mediaNoun} triggered several heuristic signals that can occur in AI-generated or edited media. These signals are not proof of origin and may also occur in authentic files.`
                  : `This ${mediaNoun} did not trigger strong signals in this heuristic check. That does not establish that it is authentic or unedited.`}
              </p>

              {/* Heuristic score gauge */}
              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Heuristic score
                  </p>
                  <p
                    className={`text-4xl font-black ${
                      isAI ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {confidence}%
                  </p>
                </div>
                <div className="h-12 w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <div
                    className={`flex items-center gap-1.5 text-sm font-bold ${
                      isAI ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {isAI ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {isAI ? 'Review' : 'Uncertain'}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={onReset}
                  className="px-6 py-3 glass rounded-xl text-sm font-semibold text-white hover:border-white/20 transition-all duration-300 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Scan Another {mediaType === 'video' ? 'Video' : 'Image'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
