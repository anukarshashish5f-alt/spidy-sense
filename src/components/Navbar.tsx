import { Radar, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Detect' },
    { id: 'pricing', label: 'Pricing' },
  ];

  const handleNav = (page: string) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <Radar className="w-7 h-7 text-red-500 group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute inset-0 blur-lg bg-red-500/30 group-hover:bg-red-500/50 transition-colors" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-white font-bold text-base tracking-wide">
                SPYDE
              </span>
              <span className="text-[10px] text-gray-400 tracking-[0.2em] uppercase">
                AI Image Detector
              </span>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => handleNav(link.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 relative group ${
                  currentPage === link.id
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {currentPage === link.id && (
                  <span className="absolute inset-0 bg-red-500/10 border border-red-500/30 rounded-lg" />
                )}
                <span className="relative">{link.label}</span>
              </button>
            ))}
            <button
              onClick={() => handleNav('pricing')}
              className="ml-3 px-5 py-2 gradient-spider rounded-lg text-sm font-semibold text-white spider-glow hover:scale-105 transition-transform duration-300"
            >
              Get Premium
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-300 p-2"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden glass-strong border-t border-white/5 animate-fade-in">
          <div className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => handleNav(link.id)}
                className={`block w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === link.id
                    ? 'bg-red-500/10 text-white border border-red-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => handleNav('pricing')}
              className="block w-full px-4 py-3 gradient-spider rounded-lg text-sm font-semibold text-white text-center"
            >
              Get Premium
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
