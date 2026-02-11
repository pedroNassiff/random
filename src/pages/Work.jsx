import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projects } from '../data/projects';
import GlitchButton from '../components/GlitchButton';
import ScrollingText from '../components/ScrollingText';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Work() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const project1Ref = useRef(null);
  const project2Ref = useRef(null);
  const project3Ref = useRef(null);
  const project4Ref = useRef(null);
  const project5Ref = useRef(null);
  const project6Ref = useRef(null);
  const project7Ref = useRef(null);
  const project8Ref = useRef(null);

  // Scroll to top al montar el componente
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Animaciones de proyectos
  useEffect(() => {
    if (!project1Ref.current || !project2Ref.current || !project3Ref.current || !project4Ref.current || !project5Ref.current || !project6Ref.current || !project7Ref.current || !project8Ref.current) {
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

    // Proyecto 3 - desde la izquierda, termina en -70%
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

    // Proyecto 5 - desde la izquierda, termina en -70%
    gsap.fromTo(
      project5Ref.current,
      { x: '-100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -70,
        scrollTrigger: {
          trigger: project5Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    // Proyecto 6 - desde la derecha, termina en -40%
    gsap.fromTo(
      project6Ref.current,
      { x: '100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -40,
        scrollTrigger: {
          trigger: project6Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    // Proyecto 7 - desde la izquierda, termina en -70%
    gsap.fromTo(
      project7Ref.current,
      { x: '-100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -70,
        scrollTrigger: {
          trigger: project7Ref.current,
          start: 'top bottom',
          end: 'top 30%',
          scrub: 2,
          markers: false
        }
      }
    );

    // Proyecto 8 - desde la derecha, termina en -40%
    gsap.fromTo(
      project8Ref.current,
      { x: '100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -40,
        scrollTrigger: {
          trigger: project8Ref.current,
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
    <div className="w-full min-h-screen bg-[#FDFCFB]">
      <Navbar />

      {/* Work Section */}
      <section className="relative w-full min-h-[3700px] bg-[#F8F8F7] px-6 md:px-16 py-24 max-w-[1600px] mx-auto mt-20">
        {/* Title */}
        <div className="absolute top-10 left-6 md:left-16">
          <h1 className="text-[40px] md:text-[50px] font-semibold text-[#1A1A1A]">
            {t('work.title')}
          </h1>
        </div>

        {/* Project 1 */}
        <div 
          ref={project1Ref} 
          onClick={() => navigate(`/work/${projects[0].id}`)}
          className="absolute top-24 left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[0].image} 
            alt={projects[0].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[0].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 2 */}
        <div 
          ref={project2Ref} 
          onClick={() => navigate(`/work/${projects[1].id}`)}
          className="absolute top-[40px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[1].image} 
            alt={projects[1].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[1].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 3 */}
        <div 
          ref={project3Ref} 
          onClick={() => navigate(`/work/${projects[2].id}`)}
          className="absolute top-[20px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[2].image} 
            alt={projects[2].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[2].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 4 */}
        <div 
          ref={project4Ref} 
          onClick={() => navigate(`/work/${projects[3].id}`)}
          className="absolute top-[2px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[3].image} 
            alt={projects[3].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[3].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

         {/* Project 5 */}
        <div 
          ref={project5Ref} 
          onClick={() => navigate(`/work/${projects[4].id}`)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[4].image} 
            alt={projects[4].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[4].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 6 */}
        <div 
          ref={project6Ref} 
          onClick={() => navigate(`/work/${projects[5].id}`)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[5].image} 
            alt={projects[5].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[5].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 7 */}
        <div 
          ref={project7Ref} 
          onClick={() => navigate(`/work/${projects[6].id}`)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[6].image} 
            alt={projects[6].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[6].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* Project 8 */}
        <div 
          ref={project8Ref} 
          onClick={() => navigate(`/work/${projects[7].id}`)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[1000px] h-[500px] md:h-[600px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <img 
            src={projects[7].image} 
            alt={projects[7].title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80"></div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6">
            <h3 className="text-[36px] font-semibold text-white text-center px-10">
              {projects[7].title}
            </h3>
            <GlitchButton variant="primary" className="w-[200px]">
              <ScrollingText text={t('home.view_project')} speed={8} textColor="text-[#1A1A1A]" />
            </GlitchButton>
          </div>
        </div>

        {/* CTA Section */}
        {/* <div className="absolute top-[3561px] left-16 max-w-[800px] flex flex-col gap-10">
          <h2 className="text-[48px] font-semibold text-[#1A1A1A] leading-tight">
            ¿Tienes un proyecto en mente?
          </h2>
          <p className="text-2xl text-[#666666]">
            Trabajemos juntos para crear algo único y memorable
          </p>
          <GlitchButton variant="secondary" className="w-[300px] self-start">
            <ScrollingText text="conversemos" speed={10} textColor="text-white" />
          </GlitchButton>
        </div> */}
      </section>

      <Footer />
    </div>
  );
}
