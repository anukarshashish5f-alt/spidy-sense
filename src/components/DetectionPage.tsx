import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import Hero from './Hero';
import StepIndicator from './StepIndicator';
import UploadStep from './UploadStep';
import AnalyzeStep from './AnalyzeStep';
import type { AnalysisResult } from '@/utils/imageAnalysis';
import ExplainStep from './ExplainStep';
import ConclusionStep from './ConclusionStep';

type Step = 0 | 1 | 2 | 3 | 4;

export default function DetectionPage() {
  const [step, setStep] = useState<Step>(0);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleMediaSelected = (file: File | null, previewUrl: string, type: 'image' | 'video') => {
    setMediaFile(file);
    setMediaPreview(previewUrl);
    setMediaType(type);
  };

  // Keep ownership of the object URL here because it is reused across the upload,
  // analysis and report steps. Revoke the old URL when it is replaced or cleared.
  useEffect(() => {
    if (!mediaPreview) return;
    return () => URL.revokeObjectURL(mediaPreview);
  }, [mediaPreview]);

  const handleAnalyzeComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setStep(3);
  };


  const reset = () => {
    setStep(0);
    setMediaFile(null);
    setMediaPreview('');
    setMediaType('image');
    setAnalysisResult(null);
  };

  // Step 0: Hero
  if (step === 0) {
    return (
      <div>
        <Hero onStart={() => setStep(1)} />

        {/* How It Works section */}
        <section id="how-it-works" className="relative z-10 py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-center text-white mb-4">
              The <span className="text-red-500">Four-Step</span> Detection Process
            </h2>
            <p className="text-center text-gray-500 mb-14 max-w-2xl mx-auto">
              From upload to report, Spidy Sense measures selected image, video and audio statistics. These heuristic signals cannot confirm whether media is AI-generated or authentic.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  num: '01',
                  title: 'Upload',
                  desc: 'Choose a supported image or video file within the size limit shown in the uploader.',
                  icon: '📤',
                },
                {
                  num: '02',
                  title: 'Analyze',
                  desc: 'Heuristic checks examine pixel patterns, edges, noise, frequency, and selected temporal signals.',
                  icon: '🔍',
                },
                {
                  num: '03',
                  title: 'Explain',
                  desc: 'Review the measured feature scores and their limitations in plain language.',
                  icon: '📄',
                },
                {
                  num: '04',
                  title: 'Conclusion',
                  desc: 'A provisional assessment with the signals that influenced it, not proof of origin.',
                  icon: '✅',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="glass rounded-2xl p-6 hover:border-red-500/20 transition-all duration-300 group hover:translate-y-[-4px]"
                >
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <div className="text-xs font-mono text-red-400 mb-2">
                    STEP {item.num}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <button
                onClick={() => setStep(1)}
                className="px-8 py-4 gradient-spider rounded-xl text-lg font-bold text-white spider-glow hover:scale-105 transition-transform duration-300 inline-flex items-center gap-2"
              >
                Try It Now
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Steps 1-4: Detection flow
  return (
    <section className="relative z-10 min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <StepIndicator currentStep={step} />

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Step 1: <span className="text-red-500">Upload</span>
              </h2>
              <p className="text-gray-500 text-sm">
                Select an image or video to begin the detection process
              </p>
            </div>
            <UploadStep onMediaSelected={handleMediaSelected} />

            {mediaFile && (
              <div className="mt-8 text-center animate-fade-up">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-4 gradient-spider rounded-xl text-base font-bold text-white spider-glow hover:scale-105 transition-transform duration-300 inline-flex items-center gap-2"
                >
                  Proceed to Analysis
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Analyze */}
        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Step 2: <span className="text-red-500">Analyze</span>
              </h2>
              <p className="text-gray-500 text-sm">
                Spidy Sense is checking media patterns...
              </p>
            </div>
            <AnalyzeStep
              mediaPreview={mediaPreview}
              mediaFile={mediaFile!}
              mediaType={mediaType}
              onComplete={handleAnalyzeComplete}
            />
          </div>
        )}

        {/* Step 3: Explain */}
        {step === 3 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Step 3: <span className="text-red-500">Explain</span>
              </h2>
              <p className="text-gray-500 text-sm">
                Here's what our system found and why it matters
              </p>
            </div>
            <ExplainStep
              mediaPreview={mediaPreview}
              mediaType={mediaType}
              patterns={analysisResult?.patterns ?? []}
              method={analysisResult?.method}
              aiScore={analysisResult?.aiScore}
              realScore={analysisResult?.realScore}
            />
            <div className="mt-8 text-center">
              <button
                onClick={() => setStep(4)}
                className="px-8 py-4 gradient-spider rounded-xl text-base font-bold text-white spider-glow hover:scale-105 transition-transform duration-300 inline-flex items-center gap-2"
              >
                See Final Verdict
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Conclusion */}
        {step === 4 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Step 4: <span className="text-red-500">Conclusion</span>
              </h2>
              <p className="text-gray-500 text-sm">
                An evidence-based estimate with clear limits, not proof of origin
              </p>
            </div>
            <ConclusionStep
              isAI={analysisResult?.isAI ?? false}
              confidence={analysisResult?.confidence ?? 0}
              verdict={analysisResult?.verdict}
              method={analysisResult?.method}
              aiScore={analysisResult?.aiScore}
              realScore={analysisResult?.realScore}
              mediaType={mediaType}
              onReset={reset}
            />
          </div>
        )}

        {/* Back button for steps 1 and 3 */}
        {(step === 1 || step === 3) && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setStep(step === 1 ? 0 : (step - 1) as Step)}
              className="text-sm text-gray-500 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
