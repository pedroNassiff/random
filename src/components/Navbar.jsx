import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GlitchButton from './GlitchButton';
import { Menu, X, BarChart3 } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isHome = location.pathname === '/';
  const isProjectPage = location.pathname.startsWith('/work/');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (sectionId) => {
    setMobileMenuOpen(false);
    if (!isHome) {
      navigate('/');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHomeClick = () => {
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between md:justify-end px-6 md:px-22 py-10 transition-all duration-300 ${
        isScrolled 
          ? 'bg-[#FDFCFB]/80 backdrop-blur-sm shadow-sm' 
          : 'bg-transparent md:max-w-[1400px] md:mx-auto'
      }`}>
        <div className={`absolute left-1/2 -translate-x-1/2 text-xl font-semibold transition-colors duration-300 ${
          isScrolled ? 'text-[#1A1A1A]' : (isProjectPage ? 'text-white' : 'text-[#1A1A1A]')
        }`}>.RANDOM()</div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-3 items-center">
          {isHome ? (
            <>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={() => handleNavClick('proyectos')}>
                {t('nav.projects')}
              </GlitchButton>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={() => handleNavClick('servicios')}>
                {t('nav.services')}
              </GlitchButton>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={() => handleNavClick('lab')}>
                {t('nav.lab')}
              </GlitchButton>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={() => handleNavClick('about')}>
                {t('nav.about')}
              </GlitchButton>
            </>
          ) : (
            <>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={handleHomeClick}>
                {t('nav.home')}
              </GlitchButton>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={() => handleNavClick('servicios')}>
                {t('nav.services')}
              </GlitchButton>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={() => handleNavClick('lab')}>
                {t('nav.lab')}
              </GlitchButton>
              <GlitchButton variant="nav" isWhiteText={!isScrolled && isProjectPage} onClick={() => handleNavClick('about')}>
                {t('nav.about')}
              </GlitchButton>
            </>
          )}
          {/* Analytics Dashboard Link */}
          {/* <button
            onClick={() => navigate('/analytics')}
            className={`ml-2 p-2 rounded-lg transition-all duration-300 hover:scale-110 ${
              isScrolled || !isProjectPage 
                ? 'text-[#1A1A1A] hover:bg-[#1A1A1A]/10' 
                : 'text-white hover:bg-white/10'
            }`}
            title="Analytics Dashboard"
          >
            <BarChart3 className="w-5 h-5" />
          </button> */}
        </nav>

        {/* Mobile Hamburger */}
        <button 
          className={`md:hidden z-[60] transition-colors duration-300 ${
            mobileMenuOpen ? 'text-[#1A1A1A]' : (isScrolled ? 'text-[#1A1A1A]' : (isProjectPage ? 'text-white' : 'text-[#1A1A1A]'))
          }`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 z-40 bg-[#FDFCFB] flex flex-col items-center justify-center gap-8 transition-all duration-300 md:hidden ${
        mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        {isHome ? (
          <>
            <button onClick={() => handleNavClick('proyectos')} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.projects')}
            </button>
            <button onClick={() => handleNavClick('servicios')} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.services')}
            </button>
            <button onClick={() => handleNavClick('lab')} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.lab')}
            </button>
            <button onClick={() => handleNavClick('about')} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.about')}
            </button>
          </>
        ) : (
          <>
            <button onClick={handleHomeClick} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.home')}
            </button>
            <button onClick={() => handleNavClick('servicios')} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.services')}
            </button>
            <button onClick={() => handleNavClick('lab')} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.lab')}
            </button>
            <button onClick={() => handleNavClick('about')} className="text-2xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity">
              {t('nav.about')}
            </button>
          </>
        )}
        {/* Analytics link in mobile menu */}
        {/* <button 
          onClick={() => { setMobileMenuOpen(false); navigate('/analytics'); }} 
          className="flex items-center gap-2 text-xl font-medium text-[#1A1A1A] hover:opacity-70 transition-opacity"
        >
          <BarChart3 className="w-5 h-5" />
          Analytics
        </button> */}
      </div>
    </>
  );
}
