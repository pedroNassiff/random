import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GlitchButton from './GlitchButton';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleNavClick = (sectionId) => {
    if (!isHome) {
      navigate('/');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-end px-22 py-10 max-w-[1400px] mx-auto bg-[#FDFCFB]/80 backdrop-blur-sm">
      <div className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold text-[#1A1A1A]">.RANDOM()</div>
      <nav className="flex gap-3">
        {isHome ? (
          <>
            <GlitchButton variant="nav" onClick={() => handleNavClick('proyectos')}>
              Proyectos
            </GlitchButton>
            <GlitchButton variant="nav" onClick={() => handleNavClick('servicios')}>
              Servicios
            </GlitchButton>
            <GlitchButton variant="nav" onClick={() => handleNavClick('lab')}>
              Lab
            </GlitchButton>
            <GlitchButton variant="nav" onClick={() => handleNavClick('info')}>
              Info
            </GlitchButton>
          </>
        ) : (
          <>
            <GlitchButton variant="nav" onClick={() => navigate('/')}>
              Home
            </GlitchButton>
            <GlitchButton variant="nav" onClick={() => handleNavClick('servicios')}>
              Servicios
            </GlitchButton>
            <GlitchButton variant="nav" onClick={() => handleNavClick('lab')}>
              Lab
            </GlitchButton>
            <GlitchButton variant="nav" onClick={() => handleNavClick('info')}>
              Info
            </GlitchButton>
          </>
        )}
      </nav>
    </header>
  );
}
