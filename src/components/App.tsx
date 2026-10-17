import { useState, useEffect } from 'react';
import WebPattern from './components/WebPattern';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DetectionPage from './components/DetectionPage';
import PricingPage from './components/PricingPage';

type Page = 'home' | 'pricing';

function App() {
  const [page, setPage] = useState<Page>('home');

  const handleNavigate = (newPage: string) => {
    setPage(newPage as Page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    document.title = 'Spidy Sense — Media Pattern Analysis';
  }, []);

  return (
    <div className="relative min-h-screen gradient-dark spider-grid">
      <WebPattern />
      <Navbar currentPage={page} onNavigate={handleNavigate} />

      <main className="relative z-10">
        {page === 'home' && <DetectionPage />}
        {page === 'pricing' && <PricingPage onNavigate={handleNavigate} />}
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}

export default App;
