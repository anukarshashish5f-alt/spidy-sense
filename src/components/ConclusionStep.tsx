import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';

interface ConclusionStepProps {
  isAI: boolean;
  confidence: number;
  mediaType: 'image' | 'video';
  onReset: () => void;
}

export default function ConclusionStep({ isAI, confidence, mediaType, onReset }: ConclusionStepProps) {
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowVerdict(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  const value = Math.max(0, Math.min(100, confidence));
  const isNearBoundary = value >= 45 && value <= 55;
  const title = isAI ? 'Signals worth reviewing' : 'No strong signals found';
  const summary = isAI
    ? 'Some measured patterns matched the app’s heuristic rules for synthetic or edited media. These patterns are not proof of AI generation.'
    : 'The selected file did not strongly match the app’s heuristic rules. This does not prove that the file is authentic or unedited.';

  return (
    <div className="animate-fade-in">
      <section className="glass relative overflow-hidden rounded-2xl border border-white/10 p-6 text-center sm:p-10">
        <div className="relative z-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            {showVerdict ? (isAI ? <ShieldAlert className="h-8 w-8 text-amber-300" /> : <ShieldCheck className="h-8 w-8 text-sky-300" />) : <span className="h-8 w-8 animate-pulse rounded-full bg-white/20" />}
          </div>
          {showVerdict && (
            <div className="animate-fade-up">
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-gray-500">Heuristic assessment</p>
              <h2 className="mb-4 text-3xl font-black text-white sm:text-4xl">{title}</h2>
              <p className="mx-auto mb-7 max-w-2xl text-sm leading-relaxed text-gray-400">{summary}</p>
              <div className="mx-auto mb-7 max-w-xl rounded-xl border border-white/10 bg-black/20 p-4 text-left">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Not a calibrated probability
                </div>
                <p className="text-sm leading-relaxed text-gray-400">Signal score: <strong className="text-white">{value}/100</strong>. This is an internal heuristic score, not a percentage chance that the file is AI-generated. It has not been validated against a labeled benchmark.</p>
              </div>
              {isNearBoundary && <p className="mb-6 text-sm text-amber-200">The score is near the decision boundary, so treat the result as especially uncertain.</p>}
              <button onClick={onReset} className="inline-flex items-center gap-2 rounded-xl glass px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30">
                <RotateCcw className="h-4 w-4" /> Analyze another {mediaType}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
