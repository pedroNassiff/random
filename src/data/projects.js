import hermesDashboard from '../img/hermes/dashboard.png';
import calaveraHome from '../img/calavera/home.png';
import misiaHome from '../img/Misia/photos/home.png';
import hcgHome from '../img/hcg/home.png';
import cenitHome from '../img/Cenit/photos/chacoH2-home.png';
import lavazzaHome from '../img/Lavazza/photos/lavazzaV1.jpg';
import shujmanHome from '../img/Shujman/photos/shujmanV1-home.png';
import ndsHome from '../img/nds/home.png';

// calavera images
import calaveraH1 from '../img/calavera/analyze_tags.png';

// Misia images
import misiaH1 from '../img/Misia/photos/misiaH1.png';
import misiaH2 from '../img/Misia/photos/misiah2.png';
import misiaH3 from '../img/Misia/photos/misiaH3.png';
import misiaV3 from '../img/Misia/photos/misiaV3.png';

// Cenit images
import cenitH1 from '../img/Cenit/photos/chacoH1.png';
import cenitH3 from '../img/Cenit/photos/chacoH3.png';
import cenitH4 from '../img/Cenit/photos/chacoH4.png';
import cenitH5 from '../img/Cenit/photos/chacoH5.png';
import cenitHV2 from '../img/Cenit/photos/chacoHV2.png';
import cenitV1 from '../img/Cenit/photos/chacoV1-home.png';
import cenitV4 from '../img/Cenit/photos/chacoV4.png';

// Lavazza images
import lavazzaH1 from '../img/Lavazza/photos/lavazzaH1.png';
import lavazzaH2 from '../img/Lavazza/photos/lavazzaH2.png';
import lavazzaH3 from '../img/Lavazza/photos/lavazzaH3-home (1).png';
import lavazzaV2 from '../img/Lavazza/photos/lavazzaV2.png';

// Shujman images
import shujmanH1 from '../img/Shujman/photos/shujmanH1.png';
import shujmanH2 from '../img/Shujman/photos/shujmanH2.png';
import shujmanH3 from '../img/Shujman/photos/shujmnaH3.png';
import shujmanV2 from '../img/Shujman/photos/shujmanV2.png';
import shujmanV3 from '../img/Shujman/photos/shujmanV3.png';

// HCG images
import hcg1 from '../img/hcg/to-home.png';
import hcg2 from '../img/hcg/to-calendar.png';

import hcg3 from '../img/hcg/to-series.png';
import hcg4 from '../img/hcg/to-gg.png';
import hcg5 from '../img/hcg/mobile-login.png';
import hcg6 from '../img/hcg/mobile-calendar.png';
import hcg7 from '../img/hcg/mobile-tours.png';
import hcg8 from '../img/hcg/mobile-tour.png';

// NDS images
import nds1 from '../img/nds/nds1.png';
import nds2 from '../img/nds/nds2.png';
import nds3 from '../img/nds/nds3.png';
import nds4 from '../img/nds/nds4.png';
import nds5 from '../img/nds/nds5.png';
import nds6 from '../img/nds/nds6.png';






export const projects = [
  {
    id: 'hermes',
    title: 'HERMES',
    image: hermesDashboard,
    heroImage: hermesDashboard,
    description: 'Plataforma neurológica que fusiona ciencia y consciencia con IA y visualización 3D',
    fullDescription: 'HERMES traduce ondas cerebrales en geometría viva. Conectamos un Muse 2 headband para capturar señales EEG en tiempo real – te pones el dispositivo y empiezas a ver tu campo neuronal desplegarse en 3D mientras meditas, focalizas o simplemente observas. El sistema procesa estas señales con un VAE (Variational Autoencoder) entrenado sobre el dataset PhysioNet de "motor imagery" – ese momento donde imaginas mover tu mano pero no la mueves, pura intención sin acción física. El modelo comprime esa información en un espacio latente que llamamos Campo Sintérgico, siguiendo las teorías de Jacobo Grinberg sobre cómo el cerebro interactúa con un campo pre-espacial de potencialidades. La coherencia neuronal se calcula como la inversa de la varianza del latent space (menos ruido = mayor sintergia), y las dimensiones principales del vector se mapean a coordenadas 3D en tiempo real. El resultado: una interfaz Three.js donde ves tu actividad cerebral como un sistema de partículas que colapsa y expande durante ejercicios de meditación o concentración, visualizando literalmente el "campo neuronal" que emerge entre la conciencia y la materia. WebSockets mantienen todo sincronizado – el backend en Python procesa las señales del Muse 2 con PyTorch mientras el frontend renderiza la topología del campo. Es neurociencia + filosofía ejecutándose a 60fps con hardware consumer.',
    category: 'Health Tech × Consciousness',
    year: '2025',
    client: 'Random Lab',
    technologies: 'React, Three.js, PyTorch VAE, Muse 2 EEG, WebSockets, PhysioNet',
    link: '/project/hermes',
    labLink: '/lab/brain',
    images: [
      { src: hermesDashboard, size: 'large' },
      { src: hermesDashboard, size: 'medium' },
      { src: hermesDashboard, size: 'medium' },
      { src: hermesDashboard, size: 'full' }
    ]
  },
  {
    id: 'calavera-sur',
    title: 'CALAVERA SUR',
    image: calaveraHome,
    heroImage: calaveraHome,
    description: 'IA que entiende patrones textiles',
    fullDescription: 'Calavera Sur resuelve un problema real: encontrar ese diseño que tenés en la cabeza pero no sabés cómo buscarlo. El sistema permite la subida de imágenes y las procesa con IA para reconocer patrones, texturas, composiciones y colores. Cada imagen se convierte en un embedding vectorial usando OpenAI text-embedding-ada-002 – básicamente traduce la estética visual a un punto en un espacio matemático de alta dimensión. Esos vectores se guardan en PostgreSQL con pgvector, que permite búsquedas por similitud semántica usando cosine distance. En lugar de solo buscar "rayas verticales azules", preguntás "estilo navy clásico" y el modelo entiende la vibra completa. El backend está en FastAPI + SQLAlchemy 2.0 corriendo en Cloud Run serverless, imágenes hosteadas en GCS, y toda la pipeline CI/CD automatizada con Cloud Build. La búsqueda devuelve resultados rankeados por similitud conceptual – no hace falta que coincidan exactamente las palabras, el modelo comprende la intención. Es como tener un asistente que entiende de moda y puede navegar todo el archivo visual al instante.',
    category: 'AI × Fashion Search',
    year: '2025',
    client: 'Calavera Sur',
    technologies: 'Python-FastAPI, PostgreSQL + pgvector, OpenAI Embeddings, GCP Cloud Run',
    link: '/project/calavera-sur',
    images: [
      { src: calaveraH1, size: 'large' }
    ]
  },
  {
    id: 'misia',
    title: 'MISIA',
    image: misiaHome,
    heroImage: misiaHome,
    description: 'E-commerce con customización total – elegís tela, color, talle y ves el diseño en vivo',
    fullDescription: 'MISIA es básicamente el Nike By You pero para indumentaria local. La idea era simple: que puedas customizar tu prenda desde cero eligiendo cada detalle – tela, color, talle, corte – y ver el resultado renderizado en tiempo real antes de comprar. Cada producto tiene opciones configurables que se cargan dinámicamente desde el backend Laravel, y el frontend React actualiza la vista previa instantáneamente mientras ajustás parámetros. El sistema genera SKUs únicos para cada combinación de customización, maneja el inventario de materiales base en MySQL, y calcula precios dinámicamente según las opciones elegidas. Integración con Stripe para pagos, panel de admin para gestionar las opciones de customización disponibles por categoría, y un sistema de preview visual que muestra cómo queda tu diseño específico. No es solo un catálogo – es una herramienta de diseño donde el usuario se vuelve co-creador. Cada compra es única porque vos la configuraste.',
    category: 'E-commerce × Product Customization',
    year: '2018',
    client: 'MISIA Fashion',
    technologies: 'React, Laravel, Stripe, MySQL, Dynamic SKU Generator',
    link: '/project/misia',
    images: [
      { src: misiaH1, size: 'large' },
      { src: misiaV3, size: 'medium' },
      { src: misiaH2, size: 'medium' },
      { src: misiaH3, size: 'full' }
    ]
  },
  {
    id: 'hub-city-guides',
    title: 'HUB CITY GUIDES',
    image: hcgHome,
    heroImage: hcgHome,
    description: 'Marketplace B2B que conecta guías con agencias, con geotracking GPS que limpia ruido en tiempo real',
    fullDescription: 'Hub City Guides resuelve la logística del turismo. Frontend en Vue.js + Ionic Capacitor para web y mobile nativa, backend NestJS para administración de tours, chat en tiempo real con Firebase. Lo interesante es el sistema de geotracking: capturamos GPS crudo del celular del guía durante el tour y lo procesamos con un pipeline de Python/FastAPI que aplica map-matching (proyectar puntos sobre calles reales), filtro de Kalman para suavizar trayectorias, detección de paradas con DBSCAN clustering, y algoritmo de Haversine para cálculos de distancia. El GPS raw llega con ruido, deriva, saltos – el sistema lo limpia automáticamente. Los datos van a PostgreSQL, rutas procesadas se cachean en Redis para consultas rápidas. El resultado: rutas limpias para visualización en mapas, métricas precisas (distancia, velocidad, paradas), y segmentación automática de la ruta en tramos lógicos. Los guías ven tours disponibles, aplican con "like", las agencias gestionan asignaciones, y todo el tracking GPS se procesa en background con Bull queues. Es logística turística con la precisión de un sistema de navegación.',
    category: 'B2B Platform × Geospatial',
    year: '2024',
    client: 'Hub City Guides',
    technologies: 'Vue.js, Ionic, NestJS, Python/FastAPI, PostgreSQL, Redis, Firebase',
    link: '/project/hub-city-guides',
    images: [
      { src: hcg1, size: 'large' },
      { src: hcg2, size: 'medium' },
      { src: hcg3, size: 'medium' },
      { src: hcg4, size: 'medium' },
      { src: hcg5, size: 'tiny' },
      { src: hcg6, size: 'tiny' },
      { src: hcg7, size: 'tiny' },
      { src: hcg8, size: 'tiny' }
    ]
  },
  {
    id: 'nds',
    title: 'NDS',
    image: ndsHome,
    heroImage: ndsHome,
    description: 'Soluciones empresariales que conectan datos, herramientas y equipos con IA y automatización',
    fullDescription: 'En el caos de los sistemas empresariales fragmentados – ERP que no hablan con CRM, datos atrapados en silos, workflows manuales que consumen horas – encontramos nuestro campo de trabajo. NDS nació para traducir ese ruido en sinfonía: conectamos lo desconectado, automatizamos lo repetitivo, y convertimos datos dispersos en decisiones en tiempo real. Cada proyecto es una pieza de ingeniería que fusiona lo técnico con lo estratégico – Python/Django construyendo APIs que orquestan flujos entre plataformas legacy y sistemas modernos, React.js diseñando interfaces donde la complejidad se vuelve claridad, pipelines CI/CD en Google Cloud Platform y OpenShift RedHat garantizando que todo se deploya sin fricción. No es solo código que integra sistemas; es arquitectura que elimina el trabajo manual, machine learning que anticipa patrones en datos históricos, y dashboards que transforman métricas en narrativas accionables. Trabajamos donde la tecnología se encuentra con la operación real de las organizaciones – ese espacio donde un proceso que tomaba días puede ejecutarse en segundos, donde información que vivía en silos ahora fluye libremente entre departamentos, donde decisiones que dependían de intuición ahora se basan en datos consolidados. El resultado no es una plataforma más: es infraestructura invisible que permite a los equipos enfocarse en lo que realmente importa mientras la tecnología orquesta el resto en segundo plano.',
    category: 'Enterprise Solutions × AI Automation',
    year: '2021-2024',
    client: 'NDS Tech',
    technologies: 'Python/Django, React.js, GCP, OpenShift RedHat, AI/ML Integration',
    link: '/project/nds',
    images: [
      { src: nds1, size: 'large' },
      { src: nds2, size: 'medium' },
      { src: nds3, size: 'medium' },
      { src: nds4, size: 'medium' },
      { src: nds5, size: 'medium' },
      { src: nds6, size: 'full' }
    ]
  },
  {
    id: 'cenit',
    title: 'CENIT',
    image: cenitHome,
    heroImage: cenitHome,
    description: 'Plataforma de cursos y capacitaciones en informática',
    fullDescription: 'El conocimiento técnico tiene su propio ritmo – hay quienes aprenden en aulas tradicionales, y hay quienes necesitan su propio camino, su propio tiempo. CENIT construye ese espacio: una plataforma educativa donde la formación en tecnologías de la información se adapta al estudiante, no al revés. Cursos online diseñados con una pedagogía que entiende que aprender a programar, administrar sistemas o diseñar arquitecturas no es memorizar sintaxis – es construir una nueva forma de pensar. El sistema rastrea cada avance: qué módulos completaste, dónde te trabaste, qué conceptos dominás y cuáles necesitan refuerzo. Certificaciones que validan competencias reales, no solo asistencia. Backend en Django manejando usuarios, contenido y progreso; frontend en React donde cada lección se despliega con claridad visual; PostgreSQL guardando el historial de aprendizaje de cada estudiante como un mapa de su evolución técnica. No es solo videoclases y PDFs – es un sistema que entiende que formar profesionales IT requiere estructura, seguimiento y contenido que evoluciona con la industria. Cada certificado que sale de CENIT representa horas de práctica guiada, ejercicios resueltos y conceptos que ahora forman parte del lenguaje del estudiante.',
    category: 'Educación',
    year: '2018',
    client: 'Instituto CENIT',
    technologies: 'React, Django, PostgreSQL',
    link: '/project/cenit',
    images: [
      { src: cenitH1, size: 'large' },
      { src: cenitV1, size: 'small' },
      { src: cenitV4, size: 'small' },
      { src: cenitH3, size: 'medium' },
      { src: cenitHV2, size: 'medium' },
      { src: cenitH4, size: 'full' },
      { src: cenitH5, size: 'large' }
    ]
  },
  {
    id: 'lavazza',
    title: 'CAFÉ LAVAZZA',
    image: lavazzaHome,
    heroImage: lavazzaHome,
    description: 'Landing page para marca de café premium',
    fullDescription: 'El café premium no se explica con palabras – se comunica con atmósfera, con el vapor que sube de la taza en la fotografía, con el espacio negativo que rodea cada elemento. Para Café Lavazza construimos una landing que respira elegancia minimalista: cada scroll revela una nueva capa de la experiencia – el grano, el proceso, la taza perfecta. GSAP orquestando animaciones sutiles que guían la mirada sin distraer, transiciones que se sienten orgánicas como el humo que se disuelve en el aire. La fotografía no está ahí para rellenar – cada imagen cuenta una parte de la historia: el origen, la preparación, ese momento de pausa que solo un buen café puede crear. Tipografía que habla con autoridad sin gritar, espacios en blanco que le dan al contenido lugar para respirar. No hay elementos de más porque cada cosa que pusimos tiene un propósito: generar esa sensación de calidad que no necesita convencerte, solo mostrarse. React componiendo la interfaz con fluidez, Tailwind CSS manteniendo cada pixel en su lugar exacto. Es diseño que se retira para dejar que el producto hable – y cuando el producto es café de este nivel, menos es infinitamente más.',
    category: 'Landing Page',
    year: '2024',
    client: 'Café Lavazza',
    technologies: 'React, GSAP, Tailwind CSS',
    link: '/project/lavazza',
    images: [
      { src: lavazzaH3, size: 'full' },
      { src: lavazzaV2, size: 'medium' },
      { src: lavazzaH1, size: 'medium' },
      { src: lavazzaH2, size: 'large' }
    ]
  },
  {
    id: 'shujman',
    title: 'SHUJMAN',
    image: shujmanHome,
    heroImage: shujmanHome,
    description: 'Landing web corporativo y portfolio',
    fullDescription: 'La consultoría inmobiliaria vive de reputación construida proyecto tras proyecto, decisión tras decisión acertada. Shujman necesitaba un espacio digital que comunicara esa trayectoria sin caer en el corporativismo genérico – algo profesional pero humano, serio pero accesible. Diseñamos una presencia web que funciona como portfolio en movimiento: cada caso de éxito se despliega con su contexto, su desafío específico, la solución implementada. No es solo "antes y después" – es narrativa de cómo se resuelven problemas complejos en desarrollo y consultoría inmobiliaria. El equipo no aparece como fotos corporativas sin alma: cada perfil cuenta quién es, qué hace, por qué está ahí. La interfaz mantiene limpieza visual porque en este rubro el diseño no debe competir con el contenido – debe sostenerlo, darle estructura, hacerlo fácil de navegar. Next.js garantizando performance y SEO porque una consultora que no aparece en búsquedas no existe para clientes potenciales; React componiendo cada sección con la lógica de quien entiende que la web corporativa no es catálogo estático sino herramienta de presentación activa. Desplegado en Vercel con edge functions que mantienen todo rápido sin importar desde dónde se acceda. Es la traducción digital de años de experiencia en el sector – profesional donde tiene que serlo, clara donde necesita serlo, y humana porque al final del día son personas hablándole a personas sobre espacios donde vivir y trabajar.',
    category: 'Corporate',
    year: '2017',
    client: 'Shujman Consultores',
    technologies: 'React, Next.js, Vercel',
    link: '/project/shujman',
    images: [
      { src: shujmanH1, size: 'large' },
      { src: shujmanV2, size: 'medium' },
      { src: shujmanV3, size: 'small' },
      { src: shujmanH2, size: 'medium' },
      { src: shujmanH3, size: 'full' }
    ]
  }

];
