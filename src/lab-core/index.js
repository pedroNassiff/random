import { lazy } from 'react'

// Importar componentes directamente (no lazy) para usar dentro de R3F Canvas
import BrainModel from './brain/BrainModel'
import RetratatarteModel from './retratarte/RetratatarteModel'
import TesseractModel from './tesseract/TesseractModel'
import GalaxyModel from './galaxy/GalaxyModel'

/**
 * LAB_EXPERIMENTS - Registry de experimentos del Lab
 */
export const LAB_EXPERIMENTS = {
  brain: {
    id: 'brain',
    name: 'HERMES',
    description: 'Neurofeedback & Teoría Sintergética',
    component: BrainModel,
    link: '/hermes',
    tags: ['3d', 'shader', 'neuroscience'],
    colors: {
      primary: '#00E5FF',
      secondary: '#E040FB'
    }
  },
  
  retratarte: {
    id: 'retratarte',
    name: 'RETRATARTE',
    description: 'Patrones generativos & geometría sagrada',
    component: RetratatarteModel,
    link: null,
    tags: ['shader', 'generative', 'patterns'],
    colors: {
      primary: '#FFD700',
      secondary: '#FF6B6B'
    }
  },

  tesseract: {
    id: 'tesseract',
    name: 'TESSERACT',
    description: 'Proyección de hipercubo 4D',
    component: TesseractModel,
    link: null,
    tags: ['3d', '4d', 'geometry'],
    colors: {
      primary: '#FFD700',
      secondary: '#4169E1'
    }
  },

  galaxy: {
    id: 'galaxy',
    name: 'GALAXY',
    description: 'Sistema particulas y patrones generativos',
    component: GalaxyModel,
    link: null,
    tags: ['particles', 'patrones', 'generativos'],
    colors: {
      primary: '#FF6030',
      secondary: '#1B3984'
    }
  }
}

/**
 * Obtener lista de experimentos como array
 */
export const getExperimentsList = () => Object.values(LAB_EXPERIMENTS)

/**
 * Obtener experimento por ID
 */
export const getExperiment = (id) => LAB_EXPERIMENTS[id]

/**
 * IDs disponibles en orden
 */
export const EXPERIMENT_IDS = ['brain', 'retratarte', 'tesseract', 'galaxy']

export default LAB_EXPERIMENTS
