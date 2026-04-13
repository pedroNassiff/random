import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Work from './pages/Work.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Analytics from './pages/Analytics.jsx';
import Automation from './pages/Automation.jsx';
import Lab from './pages/Lab.jsx';
import LabDetail from './pages/LabDetail.jsx';
import BrainDoc from './pages/BrainDoc.jsx';
import SessionDetail from './pages/SessionDetail.jsx';
import AnalisisDatasets from './pages/AnalisisDatasets.jsx';
import PlanningProspeccion from './components/PlanningProspeccion.jsx';
import PageTransition from './components/PageTransition.jsx';
import { AnalyticsProvider } from './lib/useAnalytics.jsx';
import './index.css';

function AppRoutes() {
  const location = useLocation();
  
  return (
    <PageTransition>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/work" element={<Work />} />
        <Route path="/work/:projectId" element={<ProjectDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/lab/brain/doc" element={<BrainDoc />} />
        <Route path="/lab/brain/doc/session/:sessionId" element={<SessionDetail />} />
        <Route path="/lab/:id" element={<LabDetail />} />
        <Route path="/analisis-datasets" element={<AnalisisDatasets />} />
        <Route path="/planning-prospeccion" element={<PlanningProspeccion />} />
        <Route path="/planning-house" element={<Navigate to="/planning-prospeccion" replace />} />
        <Route path="/lanalisis-datasets" element={<Navigate to="/analisis-datasets" replace />} />
      </Routes>
    </PageTransition>
  );
}

function App() {
  return (
    <Router>
      <AnalyticsProvider>
        <AppRoutes />
      </AnalyticsProvider>
    </Router>
  );
}

export default App;
