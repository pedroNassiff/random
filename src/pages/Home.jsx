import React, { Suspense, useEffect, useRef } from 'react';
import { ArrowDown, Github, Linkedin, Mail } from 'lucide-react';
import GlitchButton from '../components/GlitchButton';
import ScrollingText from '../components/ScrollingText';
import ChaosGlitchBadge from '../components/ChaosGlitchBadge';
import Scene3D from '../components/Scene3D';
import HolographicModel from '../components/HolographicModel';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Project images
import hermesDashboard from '../img/hermes/dashboard.png';
import calaveraHome from '../img/calavera/home.png';
import misiaHome from '../img/Misia/photos/home.png';
import hcgHome from '../img/hcg/home.png';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const containerRef = useRef(null);
  const heroSectionRef = useRef(null);
  const modelContainerRef = useRef(null);
  const projectsSectionRef = useRef(null);
  
  // Refs para proyectos
  const project1Ref = useRef(null);
  const project2Ref = useRef(null);
  const project3Ref = useRef(null);
  const project4Ref = useRef(null);
  
  // State para las props animadas del modelo
  const [modelProps, setModelProps] = React.useState({
    scale: 0.12,
    position: [0, -1.1, 0],
    rotation: [0, 0, 0],
    opacity: 1 // Agregar opacity
  });

  useEffect(() => {
    console.log('🔍 useEffect ejecutado');
    console.log('heroSectionRef.current:', heroSectionRef.current);
    console.log('modelContainerRef.current:', modelContainerRef.current);

    if (!heroSectionRef.current || !modelContainerRef.current) {
      console.log('❌ Refs no están listos todavía');
      return;
    }

    console.log('✅ Creando timeline GSAP');

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
        pin: false, // Quitar el pin
        markers: false, // Desactivar markers
        onUpdate: (self) => {
          console.log('📊 Scroll progress:', self.progress);
          
          const easeProgress = 1 - Math.pow(1 - self.progress, 3);
          
          const targetX = modelParameters.initialX + (easeProgress * (modelParameters.finalX - modelParameters.initialX));
          const targetY = modelParameters.initialY + (easeProgress * (modelParameters.finalY - modelParameters.initialY));
          const targetScale = modelParameters.initialScale + (easeProgress * (modelParameters.finalScale - modelParameters.initialScale));
          const targetRotationY = modelParameters.initialRotationY + (easeProgress * (modelParameters.finalRotationY - modelParameters.initialRotationY));
          
          // Fade out en los últimos 20% del scroll
          const targetOpacity = self.progress > 0.8 ? (1 - (self.progress - 0.8) / 0.2) : 1;
          
          console.log(`🎨 Modelo - scale: ${targetScale.toFixed(4)}, x: ${targetX.toFixed(4)}, y: ${targetY.toFixed(4)}, rotY: ${targetRotationY.toFixed(4)}, opacity: ${targetOpacity.toFixed(2)}`);
          
          setModelProps({
            scale: targetScale,
            position: [targetX, targetY, 0],
            rotation: [0, targetRotationY, 0],
            opacity: targetOpacity
          });
        },
        onEnter: () => console.log('🎬 ScrollTrigger ENTER'),
        onLeave: () => console.log('🏁 ScrollTrigger LEAVE'),
        onEnterBack: () => console.log('⬅️ ScrollTrigger ENTER BACK'),
        onLeaveBack: () => console.log('⬆️ ScrollTrigger LEAVE BACK')
      }
    });


    return () => {
      console.log('🧹 Limpiando ScrollTriggers');
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  // Animaciones de proyectos
  useEffect(() => {
    if (!project1Ref.current || !project2Ref.current || !project3Ref.current || !project4Ref.current) {
      return;
    }

    // Proyecto 1 - desde la izquierda, termina en -70%
    gsap.fromTo(
      project1Ref.current,
      { x: '-100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -70,
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
        xPercent: -40,
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
        xPercent: -70,
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
        xPercent: -40,
        scrollTrigger: {
          trigger: project4Ref.current,
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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-end px-22 py-10 max-w-[1400px] mx-auto bg-[#FDFCFB]/80 backdrop-blur-sm">
        <div className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold text-[#1A1A1A]">.RANDOM()</div>
        <nav className="flex gap-3">
          <GlitchButton variant="nav" onClick={() => document.getElementById('proyectos')?.scrollIntoView({ behavior: 'smooth' })}>
            Proyectos
          </GlitchButton>
            <GlitchButton variant="nav" onClick={() => document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth' })}>
            Servicios
          </GlitchButton>
          <GlitchButton variant="nav" onClick={() => document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth' })}>
            Lab
          </GlitchButton>
          <GlitchButton variant="nav" onClick={() => document.getElementById('info')?.scrollIntoView({ behavior: 'smooth' })}>
            Info
          </GlitchButton>
        </nav>
      </header>

      {/* Hero Section */}
      <section 
        ref={heroSectionRef}
        className="relative flex items-center justify-between gap-20 px-22 pt-[150px] pb-[100px] max-w-[1400px] mx-auto min-h-screen"
      >
        {/* Hero Left - Text */}
        <div className="flex flex-col gap-12 w-[980px] py-5">
          {/* Badge con efecto de caos */}
          <ChaosGlitchBadge text="Donde fluye ciencia y arte" />

          {/* Title */}
          <h1 className="text-[63px] font-semibold text-[#1A1A1A] leading-[1.1]">
            <span className="block">Explorando el caos</span>
            <span className="block">para encontrar ORDEN</span>
          </h1>
        </div>

        {/* Hero Right - 3D Model Container */}
        <div 
          ref={modelContainerRef}
          className="relative w-[600px] h-[700px] bg-[#0a0a0a] rounded-3xl overflow-hidden border border-[#1a1a1a]"
          style={{ opacity: modelProps.opacity }}
        >
          <Suspense fallback={
            <div className="flex items-center justify-center w-full h-full">
            
            </div>
          }>
            <Scene3D camera={{ position: [0, 0, 5], fov: 50 }} controls={false}>
              <HolographicModel 
                scale={modelProps.scale} 
                position={modelProps.position} 
                rotation={modelProps.rotation}
                autoRotate={false} 
              />
            </Scene3D>
          </Suspense>
        </div>
      </section>

      {/* Scroll Button */}
      <div className="flex justify-center py-10">
        <button className="flex items-center justify-center w-12 h-12 rounded-full border border-[#E0E0E0] hover:border-[#1A1A1A] transition-colors">
          <ArrowDown className="w-5 h-5 text-[#666666]" />
        </button>
      </div>

      {/* Projects Section */}
      <section id="proyectos" className="relative w-full min-h-[2700px] bg-[#F8F8F7] px-16 py-24 max-w-[1600px] mx-auto mt-20">
        {/* Title */}
        <div className="absolute top-0 left-16">
          <h2 className="text-[50px] font-semibold text-[#1A1A1A]">WORK</h2>
        </div>
  
        {/* Project 1 - Hermes */}
        <div ref={project1Ref} className="absolute top-24 left-1/2 w-full max-w-[1000px] h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative">
          {/* Imagen de fondo */}
          <img 
            src={hermesDashboard} 
            alt="Hermes Dashboard" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/90"></div>

          {/* Contenido */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              HERMES
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text="ver proyecto" speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 2 - Calavera Sur */}
        <div ref={project2Ref} className="absolute top-[40px] left-1/2 w-full max-w-[1000px] h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative">
          {/* Imagen de fondo */}
          <img 
            src={calaveraHome} 
            alt="Calavera Sur" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/90"></div>

          {/* Contenido */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              CALAVERA SUR
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text="ver proyecto" speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 3 - Misia */}
        <div ref={project3Ref} className="absolute top-[20px] left-1/2 w-full max-w-[1000px] h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative">
          {/* Imagen de fondo */}
          <img 
            src={misiaHome} 
            alt="Misia" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/90"></div>

          {/* Contenido */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              MISIA
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text="ver proyecto" speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 4 - Hub City Guides */}
        <div ref={project4Ref} className="absolute top-[2px] left-1/2 w-full max-w-[1000px] h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative">
          {/* Imagen de fondo */}
          <img 
            src={hcgHome} 
            alt="Hub City Guides" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay oscuro */}
          <div className="absolute inset-0 bg-black/90"></div>

          {/* Contenido */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              HUB CITY GUIDES
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text="ver proyecto" speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* CTA Section */}
        <div className="absolute top-[2561px] left-16 max-w-[800px] flex flex-col gap-10">
          <p className="text-2xl text-[#1A1A1A] leading-[1.6]">
            En cada proyecto tratamos de deconstruir para construir, de romper para crear, desde la creación de la marca y concepto, identidad, creación de sitio web y experiencias interactivas
          </p>
          <GlitchButton variant="secondary" className="self-start w-[300px]">
            <ScrollingText text="descubrir todos los proyectos" speed={10} textColor="text-white" />
          </GlitchButton>
        </div>
      </section>

      {/* Manifesto Section */}
      <section className="relative w-full min-h-[400px] px-20 py-[120px] max-w-[1600px] mx-auto">
        {/* Geometric Visual 2 */}
        <div className="absolute top-[120px] left-20 w-[400px] h-[300px]">
          <div className="absolute top-[15px] left-[60px] w-[280px] h-[280px] rounded-full border-[1.5px] border-[#1A1A1A] opacity-15" />
          <div className="absolute top-[55px] left-[100px] w-[200px] h-[200px] rounded-full border border-[#4A90E2] opacity-25" />
          <div className="absolute top-[85px] left-[130px] w-[140px] h-[140px] rounded-full border-[0.8px] border-[#E85A4F] opacity-30" />
          <div
            className="absolute top-[175px] left-[80px] w-[240px] h-[1px] bg-[#1A1A1A] opacity-15"
            style={{ transform: 'rotate(45deg)', transformOrigin: 'left center' }}
          />
          <div
            className="absolute top-[175px] left-[80px] w-[240px] h-[1px] bg-[#1A1A1A] opacity-15"
            style={{ transform: 'rotate(-45deg)', transformOrigin: 'left center' }}
          />
          <div className="absolute top-[171px] left-[196px] w-2 h-2 rounded-full bg-[#1A1A1A] opacity-60" />
          <div className="absolute top-[135px] left-[140px] w-[6px] h-[6px] rounded-full bg-[#4A90E2] opacity-70" />
          <div className="absolute top-[195px] left-[250px] w-[6px] h-[6px] rounded-full bg-[#E85A4F] opacity-70" />
        </div>

        {/* Quote */}
        <blockquote className="absolute top-[140px] right-20 max-w-[700px] text-[42px] font-semibold text-[#1A1A1A] leading-[1.3]">
          "Lo random no es caos,
          <br />
          es posibilidad sin explorar"
        </blockquote>
      </section>

      {/* Services Section */}
      <section id="servicios" className="w-full px-16 py-[120px] max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-16 pl-4">
          <h2 className="text-[50px] font-semibold text-[#1A1A1A]">SERVICIOS</h2>
        </div>
          {/* Title */}
        <div className="absolute top-0 left-16">
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-4 gap-6 px-4">
          {/* Service Card 1 */}
          <div className="flex flex-col p-10 bg-white rounded-2xl border border-[#E8E8E8] hover:border-[#E85A4F] hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-20">
              <span className="text-xl text-[#CCCCCC]">1.</span>
              <div className="w-8 h-8 rounded-full bg-[#E85A4F]" />
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">DESARROLLO WEB</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                Aplicaciones web modernas y escalables con las últimas tecnologías
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
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">CLOUD & DEVOPS</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                Infraestructura en la nube y automatización de despliegues
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
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">IA & ML</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                Inteligencia artificial y modelos de aprendizaje automático
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
              <h3 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight">EXPERIENCIAS 3D</h3>
              <p className="text-base text-[#666666] leading-[1.6]">
                Visualizaciones interactivas con WebGL y Three.js
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lab Section */}
      <section id="lab" className="w-full px-16 py-[120px] max-w-[1600px] mx-auto">
        <div className="flex items-center justify-end gap-3 mb-16 pr-4">
          <h2 className="text-[50px] font-semibold text-[#1A1A1A]">LAB</h2>
        </div>

        {/* Lab Grid - 4 Models with black background */}
        <div className="bg-[#0a0a0a] rounded-3xl p-10">
          <div className="grid grid-cols-4 gap-6">
            {/* Model 1 */}
            <div className="h-[400px]">
              <Suspense fallback={null}>
                <Scene3D camera={{ position: [0, 0, 3], fov: 50 }} controls={false}>
                  <HolographicModel 
                    scale={0.08} 
                    position={[0, -0.5, 0]} 
                    rotation={[0, 0, 0]}
                    autoRotate={true} 
                  />
                </Scene3D>
              </Suspense>
            </div>

            {/* Model 2 */}
            <div className="h-[400px]">
              <Suspense fallback={null}>
                <Scene3D camera={{ position: [0, 0, 3], fov: 50 }} controls={false}>
                  <HolographicModel 
                    scale={0.08} 
                    position={[0, -0.5, 0]} 
                    rotation={[0, 0, 0]}
                    autoRotate={true} 
                  />
                </Scene3D>
              </Suspense>
            </div>

            {/* Model 3 */}
            <div className="h-[400px]">
              <Suspense fallback={null}>
                <Scene3D camera={{ position: [0, 0, 3], fov: 50 }} controls={false}>
                  <HolographicModel 
                    scale={0.08} 
                    position={[0, -0.5, 0]} 
                    rotation={[0, 0, 0]}
                    autoRotate={true} 
                  />
                </Scene3D>
              </Suspense>
            </div>

            {/* Model 4 */}
            <div className="h-[400px]">
              <Suspense fallback={null}>
                <Scene3D camera={{ position: [0, 0, 3], fov: 50 }} controls={false}>
                  <HolographicModel 
                    scale={0.08} 
                    position={[0, -0.5, 0]} 
                    rotation={[0, 0, 0]}
                    autoRotate={true} 
                  />
                </Scene3D>
              </Suspense>
            </div>
          </div>
        </div>

        {/* CTA Section - Right aligned below models */}
        <div className="flex flex-col items-end gap-10 mt-16 pr-4">
          <p className="text-2xl text-[#1A1A1A] leading-[1.6] max-w-[800px] text-right">
            
          </p>
          <GlitchButton variant="secondary" className="w-[250px]">
            <ScrollingText text="ir al lab" speed={10} textColor="text-white" />
          </GlitchButton>
        </div>
      </section>

      {/* Footer */}
      <footer id="info" className="w-full bg-[#1A1A1A] px-16 py-[80px]">
        <div className="flex flex-col gap-10 max-w-[1600px] mx-auto">
          {/* Footer Top */}
          <div className="flex justify-between px-4">
            <div className="flex flex-col gap-4">
              <div className="text-xl font-semibold text-white">.RANDOM()</div>
            </div>

            <div className="flex gap-20">
              {/* Column 1 */}
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-white">Proyectos</h4>
                <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                  Generativos
                </a>
                <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                  Visualizaciones
                </a>
                <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                  Experimentos
                </a>
              </div>

              {/* Column 2 */}
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-white">Info</h4>
                <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                  Sobre mí
                </a>
                <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                  Proceso
                </a>
                <a href="#" className="text-sm text-[#999999] hover:text-white transition-colors">
                  Contacto
                </a>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="flex items-center justify-between pt-8 border-t border-[#333333] px-4">
            <p className="text-[13px] text-[#666666]">
              © 2024 .RANDOM() — Todos los derechos reservados
            </p>
            <div className="flex gap-6">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[#999999] hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-[#999999] hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="mailto:contact@random.com" className="text-[#999999] hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}