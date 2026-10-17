import { Radar, Github, Mail, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative z-10 border-t border-white/5 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Radar className="w-7 h-7 text-red-500" />
              <div>
                <span className="text-white font-bold text-lg tracking-wide">
                  SPYDE
                </span>
                <p className="text-xs text-gray-500 tracking-wider uppercase">
                  AI Image Detector
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-md">
              An innovative AI-powered platform that detects manipulated and
              AI-generated images through a transparent four-step analysis process.
              Built for NEC Junior 2026-27 Startup Mela.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-2">
              {[
                { label: 'Detect Image', page: 'home' },
                { label: 'Pricing', page: 'pricing' },
                { label: 'How It Works', page: 'home' },
              ].map((link, i) => (
                <li key={i}>
                  <button
                    onClick={() => onNavigate(link.page)}
                    className="text-sm text-gray-500 hover:text-red-400 transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Connect
            </h4>
            <div className="flex gap-3">
              <button className="w-10 h-10 rounded-lg glass flex items-center justify-center text-gray-400 hover:text-white hover:border-red-500/30 transition-all">
                <Github className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-lg glass flex items-center justify-center text-gray-400 hover:text-white hover:border-red-500/30 transition-all">
                <Mail className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* NEC banner */}
        <div className="rounded-xl glass p-4 mb-6 text-center">
          <p className="text-sm text-gray-400">
            <span className="text-red-400 font-semibold">NEC Junior 2026-27</span>
            {' — '}Task 4: Startup Mela
            {' — '}An innovation project demonstrating creativity, teamwork, and
            entrepreneurial thinking.
          </p>
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
          <p className="text-xs text-gray-600">
            (c) 2026 Spyde. All rights reserved.
          </p>
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            Built with <Heart className="w-3 h-3 text-red-500" /> for NEC Junior
          </p>
        </div>
      </div>
    </footer>
  );
}
