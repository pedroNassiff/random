import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';
import GlitchButton from '../components/GlitchButton';
import ScrollingText from '../components/ScrollingText';
import ChaosGlitchBadge from '../components/ChaosGlitchBadge';
import Scene3D from '../components/Scene3D';
import HolographicModel from '../components/HolographicModel';
import { WaterEffect } from '../components/WaterEffect';
import HeroGalaxy from '../components/HeroGalaxy';
import LabModelViewer from '../lab-core/LabModelViewer';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CookieConsent from '../components/CookieConsent';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
// Analytics
import { usePageTracking, useEngagementTracking, useEventTracking } from '../lib/useAnalytics.jsx';
import ProjectHoverOverlay from '../components/ProjectHoverOverlay';

// Project images
import hermesDashboard from '../img/hermes/dashboard.png';
import calaveraHome from '../img/calavera/home.png';
import misiaHome from '../img/Misia/photos/home.png';
import hcgHome from '../img/hcg/home.png';
import ndsHome from '../img/nds/home.png';
import { Water } from 'three/examples/jsm/Addons.js';

import MatrixRain from '../components/MatrixRain';



gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const heroSectionRef = useRef(null);
  const modelContainerRef = useRef(null);
  const projectsSectionRef = useRef(null);
  
  // Analytics tracking
  usePageTracking('home');
  const { trackClick } = useEventTracking();
  const heroRef = useEngagementTracking('home-hero');
  const projectsRef = useEngagementTracking('home-projects');
  const servicesRef = useEngagementTracking('home-services');
  const labRef = useEngagementTracking('home-lab');
  const aboutRef = useEngagementTracking('home-about');
  
  // Refs para proyectos
  const project1Ref = useRef(null);
  const project2Ref = useRef(null);
  const project3Ref = useRef(null);
  const project4Ref = useRef(null);
  const project5Ref = useRef(null);
  
  // Textos rotativos para el badge
  const badgeTexts = [
    "donde fluyen caos y orden",
    "donde fluyen ciencia y arte",
  ];
  const [currentBadgeIndex, setCurrentBadgeIndex] = useState(0);
  
  // Variantes poéticas para la segunda línea del hero
  const heroLineVariants = [
    // "para encontrar la frecuencia",
    "para revelar el patrón",
    "para trazar la geometría",
    // "para cristalizar el orden",
    "para capturar la esencia"
  ];
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isLineGlitching, setIsLineGlitching] = useState(false);
  
  // State para controlar la secuencia de efectos del hero
  const [heroPhase, setHeroPhase] = useState('water'); // 'water' | 'galaxy' | 'holographic' | 'idle'
  const [waterOpacity, setWaterOpacity] = useState(1.0);
  const [galaxyOpacity, setGalaxyOpacity] = useState(0.0);
  const [holographicOpacity, setHolographicOpacity] = useState(0.0);

  const [shouldRenderWater, setShouldRenderWater] = useState(true);
const [shouldRenderGalaxy, setShouldRenderGalaxy] = useState(false);
const [shouldRenderHolographic, setShouldRenderHolographic] = useState(false);

const [matrixOpacity, setMatrixOpacity] = useState(0.0);
const [shouldRenderMatrix, setShouldRenderMatrix] = useState(false);

  
  // State para las props animadas del modelo
  const [modelProps, setModelProps] = React.useState({
    scale: 0.12,
    position: [0, -1.1, 0],
    rotation: [0, 0, 0],
    opacity: 1
  });

  // Memoizar props para evitar re-renders
  const holographicPosition = React.useMemo(() => [0, -1.3, 0], []);
  const holographicRotation = React.useMemo(() => [0, 0, 0], []);

  // Rotación de variantes poéticas cada 3 segundos con glitch
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setIsLineGlitching(true);
      
      setTimeout(() => {
        setCurrentLineIndex((prev) => (prev + 1) % heroLineVariants.length);
        setIsLineGlitching(false);
      }, 300); // Duración del glitch
    }, 3000); // Cambia cada 3 segundos

    return () => clearInterval(rotationInterval);
  }, [heroLineVariants.length]);

  // Manejo de la secuencia de efectos del hero con transiciones suaves
  useEffect(() => {
  // Pre-cargar galaxy
  const preloadGalaxyTimer = setTimeout(() => {
    setShouldRenderGalaxy(true);
  }, 5900);

  // Transición water -> galaxy
  const waterToGalaxyTimer = setTimeout(() => {
    setHeroPhase('galaxy');
    const startTime = Date.now();
    const duration = 2000;
    
    const transitionInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      
      setWaterOpacity(1.0 - eased);
      setGalaxyOpacity(eased);
      
      if (progress >= 1) clearInterval(transitionInterval);
    }, 16);
  }, 6000);

  const unmountWaterTimer = setTimeout(() => setShouldRenderWater(false), 8100);

  // Pre-cargar holographic
  const preloadHolographicTimer = setTimeout(() => {
    setShouldRenderHolographic(true);
  }, 17900);

  // Transición galaxy -> holographic
  const galaxyToHolographicTimer = setTimeout(() => {
    setHeroPhase('holographic');
    const startTime = Date.now();
    const duration = 2000;
    
    const transitionInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      
      setGalaxyOpacity(1.0 - eased);
      setHolographicOpacity(eased);
      
      if (progress >= 1) clearInterval(transitionInterval);
    }, 16);
  }, 18000);

  const unmountGalaxyTimer = setTimeout(() => setShouldRenderGalaxy(false), 20100);
  const idleTimer = setTimeout(() => setHeroPhase('idle'), 45000);

  //  efecto matrix
  const preloadMatrixTimer = setTimeout(() => {
    setShouldRenderMatrix(true);
  }, 27900);

  const matrixFadeInTimer = setTimeout(() => {
    const startTime = Date.now();
    const duration = 2000;
    
    const fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      
      setMatrixOpacity(eased * 0.8); // Max opacity 0.8 para que no tape todo
      
      if (progress >= 1) clearInterval(fadeInterval);
    }, 16);
  }, 28000);


  return () => {
    clearTimeout(preloadGalaxyTimer);
    clearTimeout(waterToGalaxyTimer);
    clearTimeout(unmountWaterTimer);
    clearTimeout(preloadHolographicTimer);
    clearTimeout(galaxyToHolographicTimer);
    clearTimeout(unmountGalaxyTimer);
    clearTimeout(idleTimer);
    clearTimeout(preloadMatrixTimer);
    clearTimeout(matrixFadeInTimer);
  };
}, []);

  useEffect(() => {
    if (!heroSectionRef.current || !modelContainerRef.current) {
      return;
    }

    const modelParameters = {
      initialScale: 0.12,
      finalScale: 0.12,
      initialX: 0,
      initialY: -1.1,
      finalX: 0,
      finalY: -4.67,
      initialRotationY: 0,
      finalRotationY: Math.PI
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: heroSectionRef.current,
        start: 'top top',
        end: '+=1500',
        scrub: 1,
        pin: false,
        markers: false,
        onUpdate: (self) => {
          const easeProgress = 1 - Math.pow(1 - self.progress, 3);
          
          const targetX = modelParameters.initialX + (easeProgress * (modelParameters.finalX - modelParameters.initialX));
          const targetY = modelParameters.initialY + (easeProgress * (modelParameters.finalY - modelParameters.initialY));
          const targetScale = modelParameters.initialScale + (easeProgress * (modelParameters.finalScale - modelParameters.initialScale));
          const targetRotationY = modelParameters.initialRotationY + (easeProgress * (modelParameters.finalRotationY - modelParameters.initialRotationY));
          
          // Fade out en los últimos 20% del scroll
          const targetOpacity = self.progress > 0.8 ? (1 - (self.progress - 0.8) / 0.2) : 1;
          
          setModelProps({
            scale: targetScale,
            position: [targetX, targetY, 0],
            rotation: [0, targetRotationY, 0],
            opacity: targetOpacity
          });
        }
      }
    });


    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  // Animaciones de proyectos
  useEffect(() => {
    if (!project1Ref.current || !project2Ref.current || !project3Ref.current || !project4Ref.current || !project5Ref.current) {
      return;
    }

    // Proyecto 1 - desde la izquierda, termina en -70%
    gsap.fromTo(
      project1Ref.current,
      { x: '-100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -90,
        scrollTrigger: {
          trigger: project1Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    // Proyecto 2 - desde la derecha, termina en -40%
    gsap.fromTo(
      project2Ref.current,
      { x: '100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -10,
        scrollTrigger: {
          trigger: project2Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    // Proyecto 3 - desde la izquierda, termina en -90%
    gsap.fromTo(
      project3Ref.current,
      { x: '-100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -90,
        scrollTrigger: {
          trigger: project3Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    // Proyecto 4 - desde la derecha, termina en -40%
    gsap.fromTo(
      project4Ref.current,
      { x: '100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -10,
        scrollTrigger: {
          trigger: project4Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    // Proyecto 5 - desde la izquierda, termina en -70%
    gsap.fromTo(
      project5Ref.current,
      { x: '-100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -90,
        scrollTrigger: {
          trigger: project5Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full min-h-screen bg-[#FDFCFB] font-['Inter',sans-serif]">
      <Navbar />

       {/* Hero Section */}
      <section 
        ref={(el) => {
          heroSectionRef.current = el;
          heroRef.current = el;
        }}
        className="relative flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20 px-6 md:px-16 lg:px-22 pt-32 md:pt-[150px] pb-16 md:pb-[100px] max-w-[1400px] mx-auto min-h-screen"
      >
        {/* Hero Left - Text */}
        <div className="flex flex-col gap-8 md:gap-12 w-full lg:w-[980px] py-5">
          <ChaosGlitchBadge 
            text={badgeTexts[currentBadgeIndex]} 
            onGlitchEnd={() => {
              setCurrentBadgeIndex((prev) => (prev + 1) % badgeTexts.length);
            }}
          />
          <h1 className="text-[36px] md:text-[30px] lg:text-[47px] font-semibold text-[#1A1A1A] leading-[1.1]">
            <span className="block">Explorando el caos</span>
            <span 
              className={`block glitch-text ${isLineGlitching ? 'active' : ''}`}
              data-text={heroLineVariants[currentLineIndex]}
            >
              {heroLineVariants[currentLineIndex]}
            </span>
          </h1>
        </div>

       {/* Hero Right - 3D Model Container */}
<div 
  ref={modelContainerRef}
  className="relative w-full max-w-[600px] h-[500px] md:h-[600px] lg:h-[670px] bg-[#0a0a0a] rounded-3xl overflow-hidden border border-[#1a1a1a]"
  style={{ opacity: modelProps.opacity }}
>
  {/* Scene3D con los modelos 3D */}
  <Suspense fallback={
    <div className="flex items-center justify-center w-full h-full">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  }>
    <Scene3D 
      camera={{ position: [0, 0, 5], fov: 50 }} 
      controls={heroPhase === 'idle'}
      lookAt={[0, 0, 0]}
    >
      {shouldRenderWater && (
        <Suspense fallback={null}>
          <WaterEffect scale={0.4} position={[0, 0, 0]} opacity={waterOpacity} />
        </Suspense>
      )}

      {shouldRenderGalaxy && (
        <Suspense fallback={null}>
          <HeroGalaxy 
            scale={4.0} 
            position={[0, 0, 0]} 
            rotation={[0, 0, 0]} 
            autoRotate={true}
            startReveal={heroPhase === 'galaxy' || heroPhase === 'holographic'} 
            opacity={galaxyOpacity} 
          />
        </Suspense>
      )}

      {shouldRenderHolographic && (
        <Suspense fallback={null}>
          <HolographicModel 
            scale={0.12} 
            position={holographicPosition} 
            rotation={holographicRotation} 
            autoRotate={true} 
            opacity={holographicOpacity} 
          />
        </Suspense>
      )}
    </Scene3D>
  </Suspense>

  {/*  Matrix Rain - SE SUPERPONE SOBRE TODO */}
  {shouldRenderMatrix && (
    <MatrixRain opacity={matrixOpacity} />
  )}
</div>
      </section>

      {/* Projects Section */}
      <section id="proyectos" ref={projectsRef} className="relative w-full min-h-[2400px] md:min-h-[4600px] lg:min-h-[4800px] bg-[#F8F8F7] px-6 md:px-16 py-24 pb-32 md:pb-24 max-w-[1600px] mx-auto mt-20">
        {/* Title */}
        <div className="absolute top-0 left-6 md:left-16">
          <h2 className="text-[40px] md:text-[50px] font-semibold text-[#1A1A1A]">{t('home.work_title')}</h2>
        </div>
  
        {/* Project 1 - Hermes */}
        <div 
          ref={project1Ref} 
          onClick={() => {
            trackClick('project_card_click', 'hermes', '.project-card');
            navigate('/work/hermes');
          }}
          className="absolute top-24 left-1/2 w-[calc(100%-32px)] md:w-full max-w-[700px] lg:max-w-[760px] h-[400px] md:h-[720px] lg:h-[820px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          {/* Imagen de fondo */}
          <img 
            src={hermesDashboard} 
            alt="Hermes Dashboard" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/50"></div>

          <ProjectHoverOverlay title="HERMES" viewLabel={t('home.view_project')} />
        </div>

        {/* Project 2 - Calavera Sur */}
        <div 
          ref={project2Ref} 
          onClick={() => {
            trackClick('project_card_click', 'calavera-sur', '.project-card');
            navigate('/work/calavera-sur');
          }}
          className="absolute top-[40px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[700px] lg:max-w-[760px] h-[400px] md:h-[720px] lg:h-[820px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          {/* Imagen de fondo */}
          <img 
            src={calaveraHome} 
            alt="Calavera Sur" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/80"></div>

          <ProjectHoverOverlay title="CALAVERA SUR" viewLabel={t('home.view_project')} />
        </div>

        {/* Project 3 - Misia */}
        <div 
          ref={project3Ref} 
          onClick={() => {
            trackClick('project_card_click', 'misia', '.project-card');
            navigate('/work/misia');
          }}
          className="absolute top-[20px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[700px] lg:max-w-[760px] h-[400px] md:h-[720px] lg:h-[820px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          {/* Imagen de fondo */}
          <img 
            src={misiaHome} 
            alt="Misia" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/80"></div>

          <ProjectHoverOverlay title="MISIA" viewLabel={t('home.view_project')} />
        </div>

        {/* Project 4 - Hub City Guides */}
        <div 
          ref={project4Ref} 
          onClick={() => {
            trackClick('project_card_click', 'hub-city-guides', '.project-card');
            navigate('/work/hub-city-guides');
          }}
          className="absolute top-[2px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[700px] lg:max-w-[760px] h-[400px] md:h-[720px] lg:h-[820px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          {/* Imagen de fondo */}
          <img 
            src={hcgHome} 
            alt="Hub City Guides" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/80"></div>

          <ProjectHoverOverlay title="HUB CITY GUIDES" viewLabel={t('home.view_project')} />
        </div>

        {/* Project 5 - NDS */}
        <div 
          ref={project5Ref} 
          onClick={() => {
            trackClick('project_card_click', 'nds', '.project-card');
            navigate('/work/nds');
          }}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[700px] lg:max-w-[760px] h-[400px] md:h-[720px] lg:h-[820px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          {/* Imagen de fondo */}
          <img 
            src={ndsHome} 
            alt="NDS" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/80"></div>

          <ProjectHoverOverlay title="NDS" viewLabel={t('home.view_project')} />
        </div>

        {/* CTA Section */}
        <div className="absolute top-[2150px] md:top-[4400px] lg:top-[4300px] left-6 md:left-16 right-6 md:right-auto max-w-[800px] flex flex-col gap-10 z-50">
          <p className="text-xl md:text-2xl text-[#1A1A1A] leading-[1.6] text-left">
            {t('home.cta_description')}
          </p>
          <GlitchButton 
            variant="primary" 
            className="self-start md:self-start mx-auto md:mx-0 w-[300px] relative z-50 cursor-pointer"
            onClick={() => {
              trackClick('cta_click', 'discover_all_projects', '.cta-button');
              navigate('/work');
            }}
          >
            <ScrollingText text={t('home.discover_all')} speed={10} textColor="text-[#1A1A1A]" />
          </GlitchButton>
        </div>
      </section>


      {/* Services Section */}
      <section id="servicios" ref={servicesRef} className="w-full px-6 md:px-16 py-10 md:py-[10px] mt-[200px] md:mt-0 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-12 md:mb-16 pl-0 md:pl-4">
          <h2 className="text-[40px] md:text-[50px] font-semibold text-[#1A1A1A]">{t('home.services_title')}</h2>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-0 md:px-4">
          {/* Service Card 1 */}
          <div className="flex flex-col p-10 bg-white rounded-2xl border border-[#E8E8E8] hover:border-[#E85A4F] hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-20">
              <span className="text-xl text-[#CCCCCC]">1.</span>
              <div className="w-8 h-8 rounded-full bg-[#E85A4F]" />
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">{t('home.services.web_dev.title')}</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                {t('home.services.web_dev.description')}
              </p>
            </div>
          </div>

          {/* Service Card 2 */}
          <div className="flex flex-col p-10 bg-white rounded-2xl border border-[#E8E8E8] hover:border-[#1A1A1A] hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-20">
              <span className="text-xl text-[#CCCCCC]">2.</span>
              <div className="w-8 h-8 rounded-full bg-[#1A1A1A]" />
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">{t('home.services.cloud.title')}</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                {t('home.services.cloud.description')}
              </p>
            </div>
          </div>

          {/* Service Card 3 */}
          <div className="flex flex-col p-10 bg-white rounded-2xl border border-[#E8E8E8] hover:border-[#4A90E2] hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-20">
              <span className="text-xl text-[#CCCCCC]">3.</span>
              <div className="w-8 h-8 rounded-full bg-[#4A90E2]" />
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">{t('home.services.ai.title')}</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                {t('home.services.ai.description')}
              </p>
            </div>
          </div>

          {/* Service Card 4 */}
          <div className="flex flex-col p-10 bg-white rounded-2xl border border-[#E8E8E8] hover:border-[#8BC34A] hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-20">
              <span className="text-xl text-[#CCCCCC]">4.</span>
              <div className="w-8 h-8 rounded-full bg-[#8BC34A]" />
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">{t('home.services.3d.title')}</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                {t('home.services.3d.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lab Section */}
      <section id="lab" ref={labRef} className="w-full px-6 md:px-16 py-20 md:py-[120px] max-w-[1600px] mx-auto">
        <div className="flex items-center justify-start md:justify-end gap-3 mb-12 md:mb-16 pr-0 md:pr-4">
          <h2 className="text-[40px] md:text-[50px] font-semibold text-[#1A1A1A]">{t('home.lab_title')}</h2>
        </div>

        {/* Lab Grid - 4 Different Experiments */}
        <div className="bg-[#0a0a0a] rounded-3xl p-6 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Experiment 1 - Brain/Hermes */}
            <Suspense fallback={
              <div className="h-[400px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <LabModelViewer 
                experimentId="brain" 
                className="h-[400px] rounded-xl overflow-hidden cursor-pointer"
                onClick={() => {
                  trackClick('lab_experiment_click', 'brain', '.lab-experiment');
                  navigate('/work/hermes');
                }}
              />
            </Suspense>

            {/* Experiment 2 - Retratarte */}
            <Suspense fallback={
              <div className="h-[400px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <LabModelViewer 
                experimentId="retratarte" 
                className="h-[400px] rounded-xl overflow-hidden cursor-pointer"
              />
            </Suspense>

            {/* Experiment 3 - Tesseract */}
            <Suspense fallback={
              <div className="h-[400px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <LabModelViewer 
                experimentId="tesseract" 
                className="h-[400px] rounded-xl overflow-hidden cursor-pointer"
              />
            </Suspense>

            {/* Experiment 4 - Galaxy */}
            <Suspense fallback={
              <div className="h-[400px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <LabModelViewer 
                experimentId="galaxy" 
                className="h-[400px] rounded-xl overflow-hidden cursor-pointer"
              />
            </Suspense>
          </div>
        </div>

        {/* CTA Section - Right aligned below models */}
        <div className="flex flex-col items-center md:items-end gap-10 mt-12 md:mt-16 pr-0 md:pr-4">
          <p className="text-2xl text-[#1A1A1A] leading-[1.6] max-w-[800px] text-center md:text-right">
            
          </p>
          <GlitchButton 
            variant="primary" 
            className="w-[250px] mx-auto md:mx-0"
            onClick={() => { trackClick('lab_cta_click', 'go_to_lab', '.lab-button'); navigate('/lab'); }}
          >
            <ScrollingText text={t('home.go_to_lab')} speed={10} textColor="text-[#1A1A1A]" />
          </GlitchButton>
        </div>
      </section>

      {/* About Section */}
      <section id="about" ref={aboutRef} className="w-full px-6 md:px-16 py-20 md:py-[120px] max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-12 md:mb-16 pl-0 md:pl-4">
          <h2 className="text-[40px] md:text-[50px] font-semibold text-[#1A1A1A]">{t('home.about_title')}</h2>
        </div>
        
        <div className="flex flex-col gap-12">
          <div className="max-w-[900px]">
            <p className="text-xl md:text-2xl text-[#1A1A1A] leading-[1.7] mb-8 text-left">
              {t('home.about_text_1')}
            </p>
          </div>
          
          <div className="max-w-[900px]">
            <p className="text-lg md:text-xl text-[#666666] leading-[1.8] text-left">
              {t('home.about_text_2')}
            </p>
          </div>
        </div>
      </section>

      <Footer />
      
      {/* Cookie Consent */}
      <CookieConsent />
    </div>
  );
}