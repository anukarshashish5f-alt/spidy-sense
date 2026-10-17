import { useEffect, useState } from 'react';
import { AlertTriangle, Activity, Waves, ScanLine, Layers, Mic } from 'lucide-react';
import type { DetectedPattern } from './AnalyzeStep';

interface ExplainStepProps {
  mediaPreview: string;
  mediaType: 'image' | 'video';
  patterns: DetectedPattern[];
  onComplete: () => void;
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

export default function ExplainStep({ mediaPreview, mediaType, patterns, onComplete }: ExplainStepProps) {
  const [visiblePatterns, setVisiblePatterns] = useState<number>(0);

  useEffect(() => {
    if (visiblePatterns < patterns.length) {
      const timer = setTimeout(() => {
        setVisiblePatterns((v) => v + 1);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }
  }, [visiblePatterns, patterns.length, onComplete]);

  const avgConfidence = patterns.length > 0
    ? Math.round(patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length)
    : 0;

  const mediaNoun = mediaType === 'video' ? 'video' : 'image';

  return (
    <div className="animate-fade-in space-y-6">
      {/* Summary */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">
              Pattern Analysis Report
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Our system scanned this {mediaNoun} across multiple detection layers and
              found <span className="text-red-400 font-semibold">{patterns.length} key signals</span> that
              strongly suggest this {mediaNoun} was generated or manipulated by AI. Here's
              what Spidy Sense's heuristic checks flagged, in plain language:
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-side: media with heatmap overlay + pattern list */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Media with visualized pattern overlay */}
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">
            Pattern Visualization
          </p>
          <div className="relative rounded-xl overflow-hidden bg-black/50">
            {mediaType === 'image' ? (
              <img
                src={mediaPreview}
                alt="Pattern visualization"
                className="w-full max-h-72 object-contain"
              />
            ) : (
              <video
                src={mediaPreview}
                controls
                className="w-full max-h-72 object-contain"
              />
            )}
            {/* Heatmap-style overlay */}
            <div
              className="absolute inset-0 mix-blend-overlay pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 30% 40%, rgba(230,36,41,0.5) 0%, transparent 25%), radial-gradient(circle at 70% 60%, rgba(230,36,41,0.4) 0%, transparent 20%), radial-gradient(circle at 50% 80%, rgba(255,107,53,0.3) 0%, transparent 15%), radial-gradient(circle at 80% 20%, rgba(230,36,41,0.3) 0%, transparent 18%)',
              }}
            />
            {/* Detection boxes */}
            <div className="absolute top-[15%] left-[20%] w-24 h-24 border-2 border-red-500/60 rounded animate-pulse pointer-events-none" />
            <div className="absolute bottom-[20%] right-[15%] w-20 h-20 border-2 border-amber-500/60 rounded animate-pulse delay-300 pointer-events-none" />
            <div className="absolute top-[50%] right-[30%] w-16 h-16 border-2 border-blue-500/50 rounded animate-pulse delay-500 pointer-events-none" />
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500/60" />
              <span>High confidence</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500/60" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500/60" />
              <span>Low</span>
            </div>
          </div>
        </div>

        {/* Pattern list */}
        <div className="space-y-3">
          {patterns.slice(0, visiblePatterns).map((pattern, i) => {
            const Icon = PATTERN_ICONS[pattern.type];
            const colorClass = PATTERN_COLORS[pattern.type];
            return (
              <div
                key={i}
                className="glass rounded-xl p-4 animate-slide-in-right"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-white truncate">
                        {pattern.name}
                      </h4>
                      <span className={`text-xs font-mono font-bold ml-2 ${
                        pattern.confidence > 85 ? 'text-red-400' : pattern.confidence > 70 ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {pattern.confidence}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {pattern.description}
                    </p>
                    {/* Confidence bar */}
                    <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          pattern.confidence > 85 ? 'bg-red-500' : pattern.confidence > 70 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pattern.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {visiblePatterns < patterns.length && (
            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-gray-500"
                    style={{ animation: `blink 1s ${i * 0.2}s step-end infinite` }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-600 font-mono">Scanning for more patterns...</span>
            </div>
          )}
        </div>
      </div>

      {/* Overall confidence */}
      {visiblePatterns >= patterns.length && patterns.length > 0 && (
        <div className="glass rounded-2xl p-5 animate-fade-up flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              Overall Manipulation Confidence
            </p>
            <p className="text-3xl font-black text-white">
              {avgConfidence}<span className="text-lg text-gray-500">%</span>
            </p>
          </div>
          <div className="w-24 h-24 relative flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#e62429" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(avgConfidence / 100) * 264} 264`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }}
              />
            </svg>
            <span className="absolute text-sm font-bold text-red-400">AI</span>
          </div>
        </div>
      )}
    </div>
  );
}
