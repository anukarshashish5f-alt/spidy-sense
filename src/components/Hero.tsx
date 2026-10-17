import { Radar, ShieldCheck, Sparkles, ChevronDown } from 'lucide-react';

interface HeroProps {
  onStart: () => void;
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-12 z-10">
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-fade-up">
          <Sparkles className="w-4 h-4 text-red-400" />
          <span className="text-sm text-gray-300 tracking-wide">
            NEC Junior 2026-27 · Startup Mela · Task 4
          </span>
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6 animate-fade-up delay-100">
          <span className="text-white text-glow-white">SPYDE</span>
          <span className="text-red-500 text-glow">SENSE</span>
        </h1>

        <p className="text-xl sm:text-2xl text-gray-300 font-light mb-4 animate-fade-up delay-200">
          AI Image & Video Detection Platform
        </p>

        <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up delay-300">
          Upload any image or video and let our advanced pattern recognition system detect
          possible manipulation signals. Results are heuristic indicators, not definitive proof of a file's origin.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up delay-500">
          <button
            onClick={onStart}
            className="px-8 py-4 gradient-spider rounded-xl text-lg font-bold text-white spider-glow hover:scale-105 transition-transform duration-300 flex items-center gap-2"
          >
            <Radar className="w-5 h-5" />
            Start Detection
          </button>
          <a
            href="#how-it-works"
            className="px-8 py-4 glass rounded-xl text-lg font-semibold text-gray-300 hover:text-white hover:border-white/20 transition-all duration-300 flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5 text-red-400" />
            How It Works
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto animate-fade-up delay-700">
          {[
            { value: '4-Step', label: 'Detection Process' },
            { value: 'Heuristic', label: 'Signal Analysis' },
            { value: 'Local', label: 'Browser Analysis' },
          ].map((stat, i) => (
            <div key={i} className="glass rounded-xl py-4 px-2 sm:px-6">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-float">
        <ChevronDown className="w-6 h-6 text-gray-600" />
      </div>
    </section>
  );
}
