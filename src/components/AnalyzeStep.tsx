import { useEffect, useState } from 'react';
import { AlertTriangle, ScanLine } from 'lucide-react';
import { analyzeImage, analyzeVideo, type AnalysisResult, type MediaType } from '../utils/imageAnalysis';

interface AnalyzeStepProps {
  mediaPreview: string;
  mediaFile: File;
  mediaType: MediaType;
  onComplete: (result: AnalysisResult) => void;
}

export interface DetectedPattern {
  name: string;
  description: string;
  confidence: number;
  type: 'artifact' | 'frequency' | 'noise' | 'edge' | 'audio';
}

export default function AnalyzeStep({ mediaPreview, mediaFile, mediaType, onComplete }: AnalyzeStepProps) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Preparing local analysis…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const messages = mediaType === 'video'
      ? ['Reading video metadata…', 'Sampling video frames…', 'Checking experimental motion and audio signals…', 'Summarizing observations…']
      : ['Loading the pretrained image classifier…', 'Preparing the image…', 'Running AI-versus-real inference…', 'Preparing the model scores…'];

    const run = async () => {
      try {
        // Progress describes the work actually being attempted. It is not a model confidence score.
        setProgress(8);
        setMessage(messages[0]);
        timer = setInterval(() => {
          if (cancelled) return;
          setProgress((value) => Math.min(value + 7, 92));
        }, 140);
        const result = mediaType === 'video'
          ? await analyzeVideo(mediaFile)
          : await analyzeImage(mediaFile);
        if (cancelled) return;
        if (timer) clearInterval(timer);
        setProgress(100);
        setMessage(mediaType === 'image' ? 'Pretrained image model complete' : 'Experimental video analysis complete');
        window.setTimeout(() => {
          if (!cancelled) onComplete(result);
        }, 250);
      } catch (err) {
        if (timer) clearInterval(timer);
        if (cancelled) return;
        setProgress(0);
        setError(err instanceof Error ? err.message : 'The selected media could not be analyzed.');
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [mediaFile, mediaType, onComplete]);

  return (
    <div className="animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl glass p-5 sm:p-8">
        <div className="relative mb-6 overflow-hidden rounded-xl bg-black/40">
          {mediaType === 'image' ? (
            <img src={mediaPreview} alt="Selected image being analyzed" className="mx-auto max-h-80 w-full object-contain" />
          ) : (
            <video src={mediaPreview} controls muted playsInline className="mx-auto max-h-80 w-full object-contain" />
          )}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 right-0 h-px bg-red-400/70 shadow-[0_0_24px_rgba(230,36,41,0.9)]" style={{ top: `${progress}%` }} />
          </div>
        </div>

        <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-gray-300"><ScanLine className="h-4 w-4 text-red-400" />{message}</span>
            <span className="font-mono text-red-300">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full gradient-spider transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Analysis could not finish</p>
                <p className="mt-1 text-amber-100/80">{error}</p>
                <p className="mt-2 text-amber-100/80">Try another image/video, or use a shorter video in a browser that supports this format.</p>
              </div>
            </div>
          )}
          {!error && <p className="text-xs leading-relaxed text-gray-500">{mediaType === 'image' ? 'Images are analyzed by a pretrained classifier in your browser. The first run downloads model files; scores are not guaranteed probabilities and the model can make mistakes.' : 'Video analysis still uses experimental handcrafted statistics. It does not yet use a trained video-origin detection model, so its result is especially uncertain.'}</p>}
        </div>
      </div>
    </div>
  );
}
