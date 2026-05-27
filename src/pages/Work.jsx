import React, { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTracking, useEngagementTracking, useEventTracking } from '../lib/useAnalytics.jsx';
import { projects } from '../data/projects';
import ProjectHoverOverlay from '../components/ProjectHoverOverlay';
import AsciiParticleCard from '../components/AsciiParticleCard';
import GlitchButton from '../components/GlitchButton';
import ScrollingText from '../components/ScrollingText';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useExpandTransition } from '../lib/useExpandTransition';

gsap.registerPlugin(ScrollTrigger);

export default function Work() {
  const { t } = useTranslation();
  usePageTracking('work');
  const { trackClick } = useEventTracking();
  const portfolioRef = useEngagementTracking('work-portfolio');
  const project1Ref = useRef(null);
  const project2Ref = useRef(null);
  const project3Ref = useRef(null);
  const project4Ref = useRef(null);
  const project5Ref = useRef(null);
  const project6Ref = useRef(null);
  const project7Ref = useRef(null);
  const project8Ref = useRef(null);

  const { triggerExpand } = useExpandTransition();

  const handleProjectClick = useCallback((project, cardRef) => {
    trackClick('work_project_click', project.id, '.work-project-card');
    triggerExpand(project, cardRef);
  }, [triggerExpand, trackClick]);

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

    // Proyecto 6 - desde la derecha, termina en -40%
    gsap.fromTo(
      project6Ref.current,
      { x: '100vw', xPercent: 0 },
      {
        x: '0vw',
        xPercent: -10,
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
        xPercent: -90,
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
        xPercent: -10,
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
      <section ref={portfolioRef} className="relative w-full min-h-[3700px] bg-[#F8F8F7] px-6 md:px-16 py-24 max-w-[1600px] mx-auto mt-20">
        {/* Title */}
        <div className="absolute top-10 left-6 md:left-16">
          <h1 className="text-[40px] md:text-[50px] font-semibold text-[#1A1A1A]">
            {t('work.title')}
          </h1>
        </div>

        {/* Project 1 */}
        <AsciiParticleCard
          ref={project1Ref}
          image={projects[0].image}
          title={projects[0].title}
          onClick={() => handleProjectClick(projects[0], project1Ref)}
          className="absolute top-24 left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[0].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

        {/* Project 2 */}
        <AsciiParticleCard
          ref={project2Ref}
          image={projects[1].image}
          title={projects[1].title}
          onClick={() => handleProjectClick(projects[1], project2Ref)}
          className="absolute top-[40px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[1].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

        {/* Project 3 */}
        <AsciiParticleCard
          ref={project3Ref}
          image={projects[2].image}
          title={projects[2].title}
          onClick={() => handleProjectClick(projects[2], project3Ref)}
          className="absolute top-[20px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[2].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

        {/* Project 4 */}
        <AsciiParticleCard
          ref={project4Ref}
          image={projects[3].image}
          title={projects[3].title}
          onClick={() => handleProjectClick(projects[3], project4Ref)}
          className="absolute top-[2px] left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[3].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

        {/* Project 5 */}
        <AsciiParticleCard
          ref={project5Ref}
          image={projects[4].image}
          title={projects[4].title}
          onClick={() => handleProjectClick(projects[4], project5Ref)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[4].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

        {/* Project 6 */}
        <AsciiParticleCard
          ref={project6Ref}
          image={projects[5].image}
          title={projects[5].title}
          onClick={() => handleProjectClick(projects[5], project6Ref)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[5].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

        {/* Project 7 */}
        <AsciiParticleCard
          ref={project7Ref}
          image={projects[6].image}
          title={projects[6].title}
          onClick={() => handleProjectClick(projects[6], project7Ref)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[6].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

        {/* Project 8 */}
        <AsciiParticleCard
          ref={project8Ref}
          image={projects[7].image}
          title={projects[7].title}
          onClick={() => handleProjectClick(projects[7], project8Ref)}
          className="absolute left-1/2 w-[calc(100%-32px)] md:w-full max-w-[595px] lg:max-w-[646px] h-[340px] md:h-[612px] lg:h-[697px] rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 relative cursor-pointer"
        >
          <ProjectHoverOverlay title={projects[7].title} viewLabel={t('home.view_project')} />
        </AsciiParticleCard>

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
