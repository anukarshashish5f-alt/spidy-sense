import { Radar, Github, Mail, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative z-10 mt-20 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <Radar className="h-7 w-7 text-red-500" />
              <div>
                <span className="text-lg font-bold tracking-wide text-white">SPYDE SENSE</span>
                <p className="text-xs uppercase tracking-wider text-gray-500">Media signal explorer</p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-gray-400">
              A browser-based project for exploring image and video statistics. It uses handcrafted heuristics, not a trained AI detector, so results are exploratory signals rather than proof of origin.
            </p>
            <p className="mt-3 text-xs text-gray-600">Built as a student innovation project.</p>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Platform</h2>
            <ul className="space-y-2">
              <li><button type="button" onClick={() => onNavigate('home')} className="text-sm text-gray-400 hover:text-red-400">Detect media</button></li>
              <li><button type="button" onClick={() => onNavigate('pricing')} className="text-sm text-gray-400 hover:text-red-400">Plan preview</button></li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Project links</h2>
            <div className="flex gap-3">
              <a href="https://github.com/anukarshashish5f-alt/spidy-sense" target="_blank" rel="noreferrer" aria-label="Open Spidy Sense GitHub repository" className="flex h-10 w-10 items-center justify-center rounded-lg glass text-gray-300 transition hover:border-red-500/30 hover:text-white">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://github.com/anukarshashish5f-alt/spidy-sense/issues" target="_blank" rel="noreferrer" aria-label="Contact via GitHub issues" className="flex h-10 w-10 items-center justify-center rounded-lg glass text-gray-300 transition hover:border-red-500/30 hover:text-white">
                <Mail className="h-5 w-5" />
              </a>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-600">Use GitHub Issues for bug reports and feature requests.</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl glass p-4 text-center">
          <p className="text-sm text-gray-400">
            <span className="font-semibold text-red-400">Spidy Sense</span>
            {' · '}Student innovation project
            {' · '}Detection results are experimental and unvalidated.
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-gray-600">© 2026 Spidy Sense.</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-600">Built with <Heart className="h-3 w-3 text-red-500" /> for learning</p>
        </div>
      </div>
    </footer>
  );
}
