import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, Waves, ScanLine, Layers, Mic } from 'lucide-react';
import type { DetectedPattern } from './AnalyzeStep';

interface ExplainStepProps {
  mediaPreview: string;
  mediaType: 'image' | 'video';
  patterns: DetectedPattern[];
  method?: 'trained-model' | 'heuristic';
  aiScore?: number;
  realScore?: number;
}

const PATTERN_ICONS = {
  frequency: Waves,
  edge: Activity,
  noise: ScanLine,
  artifact: Layers,
  audio: Mic,
} as const;

const PATTERN_COLORS = {
  frequency: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  edge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  noise: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  artifact: 'text-red-400 bg-red-500/10 border-red-500/30',
  audio: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
} as const;

export default function ExplainStep({ mediaPreview, mediaType, patterns, method = 'heuristic', aiScore, realScore }: ExplainStepProps) {
  const [visiblePatterns, setVisiblePatterns] = useState(0);

  // Reveal the explanation gradually, but never navigate away automatically.
  // Visitors should have time to read the report before choosing the final verdict.
  useEffect(() => {
    if (visiblePatterns >= patterns.length) return;
    const timer = window.setTimeout(() => setVisiblePatterns((v) => v + 1), 180);
    return () => window.clearTimeout(timer);
  }, [visiblePatterns, patterns.length]);

  const averageSignal = patterns.length
    ? Math.round(patterns.reduce((sum, pattern) => sum + pattern.confidence, 0) / patterns.length)
    : 0;
  const mediaNoun = mediaType === 'video' ? 'video' : 'image';

  return (
    <div className="animate-fade-in space-y-6">
      <section className="glass rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h3 className="mb-2 text-lg font-bold text-white">{method === 'trained-model' ? 'Trained image model report' : 'Experimental video signal report'}</h3>
            <p className="text-sm leading-relaxed text-gray-400">
              {method === 'trained-model' ? 'A pretrained image-classification model compared this image with its AI-generated and real-image classes. These model outputs are useful signals, not proof of origin.' : `The browser calculated ${patterns.length} feature scores for this ${mediaNoun} using handcrafted statistical rules. These signals are not a validated way to determine whether a video was AI-generated.`}
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">How to read these results</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">
            {method === 'trained-model' ? 'The selected model reports imperfect accuracy in its published evaluation and may miss newer generators or misclassify real images. Editing, resizing, screenshots, and compression can also affect results.' : 'High or low values can be caused by scene motion, lighting, compression, camera movement, or audio conditions. These rules have not been validated on a representative labeled video test set. Treat this report as exploratory only.'}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Original media preview</p>
          <div className="overflow-hidden rounded-xl bg-black/40">
            {mediaType === 'image' ? (
              <img src={mediaPreview} alt="Original uploaded image" className="max-h-80 w-full object-contain" />
            ) : (
              <video src={mediaPreview} controls playsInline className="max-h-80 w-full object-contain" />
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            The model evaluates the image as a whole. It does not identify specific pixels as AI-generated.
          </p>
        </div>

        <div className="space-y-3">
          {patterns.slice(0, visiblePatterns).map((pattern, index) => {
            const Icon = PATTERN_ICONS[pattern.type];
            const colorClass = PATTERN_COLORS[pattern.type];
            const score = Math.max(0, Math.min(100, Math.round(pattern.confidence)));
            return (
              <article key={`${pattern.name}-${index}`} className="glass rounded-xl p-4 animate-slide-in-right">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h4 className="text-sm font-bold text-white">{pattern.name}</h4>
                      <span className="shrink-0 font-mono text-xs font-semibold text-gray-300">{score}/100</span>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-400">{pattern.description}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-red-500" style={{ width: `${score}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-600">Heuristic feature score, not confidence or probability</p>
                  </div>
                </div>
              </article>
            );
          })}

          {visiblePatterns < patterns.length && (
            <div className="glass flex items-center gap-3 rounded-xl p-4" aria-live="polite">
              <div className="flex gap-1">
                {[0, 1, 2].map((index) => (
                  <span key={index} className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                ))}
              </div>
              <span className="text-xs text-gray-500">Preparing the next feature score…</span>
            </div>
          )}
          {patterns.length === 0 && (
            <div className="glass rounded-xl p-5 text-sm text-gray-400">
              No feature results were returned for this file. Try a different file format.
            </div>
          )}
        </div>
      </div>

      {method !== 'trained-model' && visiblePatterns >= patterns.length && patterns.length > 0 && (
        <section className="glass flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Average feature score</p>
            <p className="mt-1 text-3xl font-black text-white">{averageSignal}<span className="ml-1 text-base font-medium text-gray-500">/100</span></p>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-gray-500">
              This average summarizes the displayed heuristics. It is not an AI-generation probability and is not a substitute for checking provenance or reliable source context.
            </p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white/10">
            <span className="text-sm font-bold text-gray-200">{averageSignal}</span>
          </div>
        </section>
      )}
    </div>
  );
}
