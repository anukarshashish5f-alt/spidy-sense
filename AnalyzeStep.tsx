import { useEffect, useState } from 'react';
import { analyzeImage, analyzeVideo, type AnalysisResult } from '@/utils/imageAnalysis';

interface AnalyzeStepProps {
  mediaPreview: string;
  mediaFile: File;
  mediaType: 'image' | 'video';
  onComplete: (result: AnalysisResult) => void;
}

export interface DetectedPattern {
  name: string;
  description: string;
  confidence: number;
  type: 'artifact' | 'frequency' | 'noise' | 'edge' | 'audio';
}

const SCAN_MESSAGES_IMAGE = [
  'Initializing media pattern analysis...',
  'Computing multi-scale Laplacian noise residuals...',
  'Running Sobel edge analysis with direction entropy...',
  'Performing multi-block DCT frequency analysis...',
  'Extracting Local Binary Pattern texture features...',
  'Computing 2D spectral power profile...',
  'Analyzing color histogram and channel correlation...',
  'Comparing heuristic image signals...',
  'Compiling pattern analysis report...',
];

const SCAN_MESSAGES_VIDEO = [
  'Initializing media pattern analysis...',
  'Extracting 8 key frames from video...',
  'Decoding audio track for voice analysis...',
  'Computing multi-scale Laplacian noise per frame...',
  'Running Sobel edge and LBP texture analysis...',
  'Analyzing voice spectral envelope and formant frequencies...',
  'Extracting pitch contour and speech prosody features...',
  'Analyzing inter-frame motion vectors and temporal coherence...',
  'Measuring harmonic structure and recording environment artifacts...',
  'Comparing video and audio heuristic signals...',
  'Compiling pattern analysis report...',
];

export default function AnalyzeStep({ mediaPreview, mediaFile, mediaType, onComplete }: AnalyzeStepProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  const scanMessages = mediaType === 'video' ? SCAN_MESSAGES_VIDEO : SCAN_MESSAGES_IMAGE;
  const duration = mediaType === 'video' ? 8000 : 6000;

  useEffect(() => {
    const interval = 50;
    const steps = duration / interval;
    let current = 0;

    const timer = setInterval(() => {
      current++;
      setProgress((current / steps) * 100);
      setMessageIndex(Math.min(
        Math.floor((current / steps) * scanMessages.length),
        scanMessages.length - 1
      ));

      if (current >= steps) {
        clearInterval(timer);
        setScanComplete(true);
        const analysis = mediaType === 'video'
          ? analyzeVideo(mediaFile)
          : analyzeImage(mediaFile);

        analysis
          .then((result) => {
            setTimeout(() => onComplete(result), 600);
          })
          .catch(() => {
            setTimeout(() =>
              onComplete({
                patterns: [{
                  name: 'Analysis Error',
                  description: `Unable to complete ${mediaType} analysis. Please try a different ${mediaType}.`,
                  confidence: 0,
                  type: 'artifact',
                }],
                isAI: false,
                confidence: 0,
                metrics: {
                  noiseScore: 0, edgeScore: 0, frequencyScore: 0,
                  colorScore: 0, symmetryScore: 0, compressionScore: 0,
                  metadataScore: 0, textureScore: 0, spectralScore: 0,
                  patchScore: 0, multiScaleScore: 0, overallScore: 0,
                },
                mediaType,
              }), 600);
          });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete, mediaFile, mediaType, scanMessages.length, duration]);

  return (
    <div className="animate-fade-in">
      <div className="relative rounded-2xl overflow-hidden glass p-6 sm:p-8">
        {/* Media with scan overlay */}
        <div className="relative rounded-xl overflow-hidden mb-6 bg-black/50">
          {mediaType === 'image' ? (
            <img
              src={mediaPreview}
              alt="Analyzing"
              className="w-full max-h-80 object-contain"
              style={{ filter: scanComplete ? 'none' : 'contrast(1.1) brightness(0.9)' }}
            />
          ) : (
            <video
              src={mediaPreview}
              className="w-full max-h-80 object-contain"
              style={{ filter: scanComplete ? 'none' : 'contrast(1.1) brightness(0.9)' }}
            />
          )}

          {/* Scanning line */}
          {!scanComplete && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"
                style={{
                  top: `${progress}%`,
                  boxShadow: '0 0 20px rgba(230, 36, 41, 0.8), 0 0 40px rgba(230, 36, 41, 0.4)',
                  transition: 'top 0.05s linear',
                }}
              />
              <div
                className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-red-500/10 to-transparent"
                style={{ top: `${progress}%`, transition: 'top 0.05s linear' }}
              />
              {/* Grid overlay */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
            </div>
          )}

          {/* Corner markers */}
          {[
            'top-2 left-2 border-t-2 border-l-2',
            'top-2 right-2 border-t-2 border-r-2',
            'bottom-2 left-2 border-b-2 border-l-2',
            'bottom-2 right-2 border-b-2 border-r-2',
          ].map((pos, i) => (
            <div
              key={i}
              className={`absolute ${pos} w-6 h-6 border-red-500/60 rounded-sm pointer-events-none`}
            />
          ))}

          {scanComplete && (
            <div className="absolute inset-0 bg-green-500/5 flex items-center justify-center animate-fade-in pointer-events-none">
              <div className="px-4 py-2 rounded-lg glass-strong text-sm text-green-400 font-semibold">
                Scan Complete
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 font-mono">
              {scanMessages[messageIndex]}
            </span>
            <span className="text-red-400 font-mono font-bold">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="h-2 rounded-full bg-white/5 overflow-hidden relative">
            <div
              className="h-full gradient-spider rounded-full transition-all duration-75 relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 shimmer-text opacity-50" />
            </div>
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-red-500"
                  style={{
                    animation: `blink 1s ${i * 0.2}s step-end infinite`,
                    opacity: scanComplete ? 0.3 : 1,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-gray-600 font-mono">
              {scanComplete ? 'Analysis finalized' : 'Spidy Sense active...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
