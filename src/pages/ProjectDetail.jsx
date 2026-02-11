import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projects } from '../data/projects'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const ProjectDetail = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [nextProject, setNextProject] = useState(null)
  const imageRefs = useRef([])

  useEffect(() => {
    // Buscar proyecto actual
    const currentProject = projects.find(p => p.id === projectId)
    if (!currentProject) {
      navigate('/work')
      return
    }
    setProject(currentProject)

    // Buscar siguiente proyecto
    const currentIndex = projects.findIndex(p => p.id === projectId)
    const nextIndex = (currentIndex + 1) % projects.length
    setNextProject(projects[nextIndex])

    // Scroll to top
    window.scrollTo(0, 0)
  }, [projectId, navigate])

  useEffect(() => {
    if (!project || !project.images) return

    // Animar imágenes con GSAP
    imageRefs.current.forEach((img, index) => {
      if (img) {
        gsap.fromTo(
          img,
          {
            opacity: 0,
            y: 60,
            scale: 0.95
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: img,
              start: 'top 85%',
              end: 'top 50%',
              toggleActions: 'play none none reverse'
            }
          }
        )
      }
    })

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill())
    }
  }, [project])

  if (!project) return null

  const handleNextProject = () => {
    if (nextProject) {
      navigate(`/work/${nextProject.id}`)
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

      {/* Hero Section */}
      <section 
        className="relative h-screen min-h-[600px] md:min-h-[800px] flex items-end justify-start overflow-hidden pt-24 md:pt-32"
      >
        {/* Imagen de fondo */}
        <div 
          className="absolute left-0 right-0 bottom-0 top-20 md:top-[100px]"
          style={{
            backgroundImage: `url(${project.heroImage || project.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Overlay oscuro superior para navbar - SOLO DESKTOP */}
        <div className="hidden md:block absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black via-black/90 to-transparent" />
        
        {/* Overlay oscuro inferior para título */}
        <div className="absolute bottom-0 left-0 right-0 h-48 md:h-64 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        
        {/* Contenido */}
        <div className="relative z-10 text-left px-6 md:px-8 lg:px-16 pb-6 md:pb-8 lg:pb-12">
          <h1 className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight">
            {project.title}
          </h1>
        </div>
      </section>

      {/* Descripción del Proyecto */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 md:mb-12">Descripción</h2>
          
          <div className="max-w-8xl mb-12 md:mb-16">
            <p className="text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed mb-8">
              {project.fullDescription || project.description} 
            </p>
          </div>

          {/* Info del Proyecto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-8xl">
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
        </div>
      </section>

      {/* Grid de Imágenes - Masonry Layout */}
      {project.images && project.images.length > 0 && (
        <section className="py-16 md:py-24 px-6">
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
        <section className="py-20 md:py-32 px-6">
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
