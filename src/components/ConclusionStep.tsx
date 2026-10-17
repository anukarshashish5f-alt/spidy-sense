import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert, ShieldCheck, CircleHelp } from 'lucide-react';

interface ConclusionStepProps {
  isAI: boolean;
  confidence: number;
  verdict?: 'ai' | 'real' | 'uncertain';
  method?: 'trained-model' | 'heuristic';
  aiScore?: number;
  realScore?: number;
  mediaType: 'image' | 'video';
  onReset: () => void;
}

export default function ConclusionStep({
  isAI,
  confidence,
  verdict = 'uncertain',
  method = 'heuristic',
  aiScore,
  realScore,
  mediaType,
  onReset,
}: ConclusionStepProps) {
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowVerdict(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  const title = verdict === 'ai'
    ? 'Likely AI-generated'
    : verdict === 'real'
      ? 'Likely real'
      : 'Uncertain result';
  const summary = method === 'trained-model'
    ? verdict === 'ai'
      ? 'The trained image classifier leaned toward its AI-generated class. It can still make mistakes, particularly on new generators, edits, screenshots, or compressed images.'
      : verdict === 'real'
        ? 'The trained image classifier leaned toward its real-image class. This is not proof of authenticity, and AI-generated images can be missed.'
        : 'The trained image classifier did not produce a strong enough signal for a clear verdict. Treat this image as unverified.'
    : 'Video analysis still uses experimental handcrafted statistical rules, not a trained video-origin detector. Spidy Sense cannot give a reliable AI-versus-real verdict for this video yet.';

  const icon = verdict === 'ai'
    ? <ShieldAlert className="h-8 w-8 text-amber-300" />
    : verdict === 'real'
      ? <ShieldCheck className="h-8 w-8 text-sky-300" />
      : <CircleHelp className="h-8 w-8 text-amber-200" />;

  return (
    <div className="animate-fade-in">
      <section className="glass relative overflow-hidden rounded-2xl border border-white/10 p-6 text-center sm:p-10">
        <div className="relative z-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            {showVerdict ? icon : <span className="h-8 w-8 animate-pulse rounded-full bg-white/20" />}
          </div>
          {showVerdict && (
            <div className="animate-fade-up">
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-gray-500">
                {method === 'trained-model' ? 'Pretrained image classifier' : 'Experimental video heuristics'}
              </p>
              <h2 className="mb-4 text-3xl font-black text-white sm:text-4xl">{title}</h2>
              <p className="mx-auto mb-7 max-w-2xl text-sm leading-relaxed text-gray-400">{summary}</p>
              <div className="mx-auto mb-7 max-w-xl rounded-xl border border-white/10 bg-black/20 p-4 text-left">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {method === 'trained-model' ? 'Model scores are not probabilities' : 'No validated video detector'}
                </div>
                {method === 'trained-model' ? (
                  <div className="space-y-2 text-sm text-gray-400">
                    <p>AI-generated class: <strong className="text-white">{aiScore ?? confidence}/100</strong></p>
                    <p>Real-image class: <strong className="text-white">{realScore ?? 0}/100</strong></p>
                    <p className="pt-1">These are the model's class scores, not calibrated chances that the file is AI-generated or authentic. The model's published evaluation is imperfect, so mistakes are expected.</p>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-gray-400">The existing video signal score is based on handcrafted rules and has not been validated on a representative test set. It should not be interpreted as a confidence percentage.</p>
                )}
              </div>
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
