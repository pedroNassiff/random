import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePageTracking, useConversionTracking, useEventTracking } from '../lib/useAnalytics.jsx'
import { projects } from '../data/projects'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import GlitchButton from '../components/GlitchButton'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const ProjectDetail = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [nextProject, setNextProject] = useState(null)
  const imageRefs = useRef([])
  const descriptionRef = useRef(null)
  const heroImageRef   = useRef(null)
  const heroTitleRef   = useRef(null)
  
  usePageTracking(`work/${projectId}`);
  const { trackProjectView } = useConversionTracking();
  const { trackClick } = useEventTracking();

  useEffect(() => {
    // Buscar proyecto actual
    const currentProject = projects.find(p => p.id === projectId)
    if (!currentProject) {
      navigate('/work')
      return
    }
    setProject(currentProject)

    // Track project view as conversion
    trackProjectView(projectId);

    // Buscar siguiente proyecto
    const currentIndex = projects.findIndex(p => p.id === projectId)
    const nextIndex = (currentIndex + 1) % projects.length
    setNextProject(projects[nextIndex])

    // Scroll to top
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, navigate]) // trackProjectView se omite intencionalmente para evitar duplicados

  // ─── Hero exit narrative (scrubbed to scroll) ─────────────────────────────
  useEffect(() => {
    if (!project) return
    const ctx = gsap.context(() => {
      // Image parallax: hero image drifts up slower than scroll — adds depth
      if (heroImageRef.current) {
        gsap.to(heroImageRef.current, {
          yPercent: -18,
          ease: 'none',
          scrollTrigger: {
            start: 'top top',
            end: '+=110vh',
            scrub: 1.5,
          },
        })
      }
      // Hero title + meta dissolve as scroll begins
      if (heroTitleRef.current) {
        gsap.to(heroTitleRef.current, {
          opacity: 0,
          y: -55,
          ease: 'power2.in',
          scrollTrigger: {
            start: 'top top',
            end: '+=280',
            scrub: 0.8,
          },
        })
      }
    })
    return () => ctx.revert()
  }, [project])

  // ─── Image grid reveal ────────────────────────────────────────────────────
  useEffect(() => {
    if (!project || !project.images) return
    const ctx = gsap.context(() => {
      imageRefs.current.forEach((img) => {
        if (!img) return
        gsap.fromTo(
          img,
          { opacity: 0, y: 60, scale: 0.95 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: img,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      })
    })
    return () => ctx.revert()
  }, [project])

  // ─── Description: cinematic stagger reveal ────────────────────────────────
  useEffect(() => {
    if (!project || !descriptionRef.current) return
    const ctx = gsap.context(() => {
      // Heading
      const heading = descriptionRef.current.querySelector('h2')
      if (heading) {
        gsap.fromTo(
          heading,
          { opacity: 0, y: 60 },
          {
            opacity: 1, y: 0,
            duration: 1.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: heading,
              start: 'top 82%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      }
      // Body paragraph
      const body = descriptionRef.current.querySelectorAll('.desc-body')
      if (body.length) {
        gsap.fromTo(
          body,
          { opacity: 0, y: 45 },
          {
            opacity: 1, y: 0,
            stagger: 0.08,
            duration: 1.0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: body[0],
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      }
      // Info grid cells — cascade left to right
      const gridCells = descriptionRef.current.querySelectorAll('.desc-grid > div')
      if (gridCells.length) {
        gsap.fromTo(
          gridCells,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0,
            stagger: { each: 0.13, from: 'start' },
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: gridCells[0],
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      }
      // CTAs
      const ctas = descriptionRef.current.querySelectorAll('.desc-cta')
      if (ctas.length) {
        gsap.fromTo(
          ctas,
          { opacity: 0, y: 25 },
          {
            opacity: 1, y: 0,
            stagger: 0.12,
            duration: 0.75,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: ctas[0],
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      }
    })
    return () => ctx.revert()
  }, [project])

  if (!project) return null

  const handleNextProject = () => {
    if (nextProject) {
      trackClick('next_project_click', nextProject.id, '.next-project-button');
      navigate(`/work/${nextProject.id}`);
    }
  }

  // Generar seed único para cada proyecto
  const generateSeed = (id) => {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash) % 10000
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Hero Section — fullscreen, sticky so description slides over it */}
      <section className="sticky top-0 h-screen overflow-hidden z-0">
        {/* Imagen con parallax */}
        <img
          ref={heroImageRef}
          src={project.heroImage || project.image}
          alt={project.title}
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
          style={{ transformOrigin: 'center center' }}
        />
        {/* Gradiente: sutil arriba (navbar) + fuerte abajo (texto) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

        {/* Título + meta — centro-inferior, se desvanecen al hacer scroll */}
        <div
          ref={heroTitleRef}
          className="absolute bottom-0 left-0 right-0 pb-14 flex flex-col items-center text-center px-6 gap-3"
        >
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-white leading-none">
            {project.title}
          </h1>
          <div className="flex items-center gap-5 text-white/55 font-mono text-xs md:text-sm uppercase tracking-[0.2em]">
            <span>{project.year}</span>
            <span>·</span>
            <span>{project.type || project.category}</span>
          </div>
        </div>
      </section>

      {/*
        Descripción — slides over the sticky hero.
        The section has NO solid background at the top: a CSS gradient
        from transparent → black creates a seamless dissolve from the
        hero image into the dark content area.  Text starts below the
        gradient so it always reads on solid black.
      */}
      <section
        ref={descriptionRef}
        className="relative z-10 min-h-screen"
        style={{
          background: 'linear-gradient(180deg, transparent 0, rgba(0,0,0,0.8) 10vh, #000 18vh)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6" style={{ paddingTop: '20vh', paddingBottom: '5rem' }}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 md:mb-10">Descripción</h2>

          {/* Info del Proyecto — antes del texto */}
          <div className="desc-grid grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-8xl mb-12 md:mb-16 pb-10 border-b border-white/10">
            <div>
              <h3 className="text-sm font-mono text-gray-500 uppercase mb-2">Cliente</h3>
              <p className="text-lg md:text-xl">{project.client || project.title}</p>
            </div>
            <div>
              <h3 className="text-sm font-mono text-gray-500 uppercase mb-2">Año</h3>
              <p className="text-lg md:text-xl">{project.year}</p>
            </div>
            <div>
              <h3 className="text-sm font-mono text-gray-500 uppercase mb-2">Tecnología</h3>
              <p className="text-lg md:text-xl">{project.technologies || project.category}</p>
            </div>
          </div>

          <div className="max-w-8xl mb-12 md:mb-16">
            <p className="desc-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed mb-8">
              {project.fullDescription || project.description} 
            </p>
          </div>

          {/* CTA Lab — solo si el proyecto tiene experimento interactivo */}
          {project.labLink && (
            <div className="desc-cta mt-16 md:mt-20 pt-12 border-t border-white/10">
              <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.25em] mb-4">Experimento interactivo</p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <p className="text-gray-400 text-sm max-w-md leading-relaxed">
                  Este proyecto tiene una versión interactiva en el Lab. Explorá el modelo en tiempo real.
                </p>
                <GlitchButton
                  variant="primary"
                  onClick={() => {
                    trackClick('lab_cta_click', project.id);
                    navigate(project.labLink);
                  }}
                  className="flex items-center gap-3 font-mono tracking-widest uppercase text-sm"
                >
                  IR AL LAB
                </GlitchButton>
              </div>
            </div>
          )}

          {/* CTA Documentación — solo si el proyecto tiene doc */}
          {project.docLink && (
            <div className="desc-cta mt-8 md:mt-10 pt-10 border-t border-white/10">
              <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.25em] mb-4">Documentación del proyecto</p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <p className="text-gray-400 text-sm max-w-md leading-relaxed">
                  Explorá el research completo: objetivos, marco teórico, arquitectura, sesiones de datos y roadmap.
                </p>
                <GlitchButton
                  variant="secondary"
                  onClick={() => {
                    trackClick('doc_cta_click', project.id);
                    navigate(project.docLink);
                  }}
                  className="flex items-center gap-3 font-mono tracking-widest uppercase text-sm"
                >
                  VER DOCS
                </GlitchButton>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Grid de Imágenes - Masonry Layout */}
      {project.images && project.images.length > 0 && (
        <section className="relative z-10 bg-black py-16 md:py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="masonry-grid">
              {project.images.map((img, index) => (
                <div
                  key={index}
                  ref={el => imageRefs.current[index] = el}
                  className={`masonry-item ${img.size || 'medium'}`}
                >
                  <div className="project-detail-image">
                    <img 
                      src={img.src} 
                      alt={`${project.title} - ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Siguiente Proyecto */}
      {nextProject && (
        <section className="relative z-10 bg-black py-20 md:py-32 px-6">
          <div className="max-w-7xl mx-auto flex justify-center md:justify-end">
            <button
              onClick={handleNextProject}
              className="group text-center md:text-right"
            >
              <p className="text-sm font-mono text-gray-500 uppercase mb-2">Siguiente Proyecto</p>
              <h3 className="text-3xl md:text-5xl lg:text-6xl font-bold group-hover:text-gray-400 transition-colors duration-300">
                {nextProject.title}
              </h3>
            </button>
          </div>
        </section>
      )}

      <Footer />

      <style>{`
        .masonry-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 16px;
        }

        @media (min-width: 768px) {
          .masonry-grid {
            grid-template-columns: repeat(12, 1fr);
            gap: 24px;
          }

          .masonry-item.tiny {
            grid-column: span 3;
          }

          .masonry-item.small {
            grid-column: span 4;
          }

          .masonry-item.medium {
            grid-column: span 6;
          }

          .masonry-item.large {
            grid-column: span 8;
          }

          .masonry-item.full {
            grid-column: span 12;
          }
        }

        .project-detail-image {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .project-detail-image:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}

export default ProjectDetail
