import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Work from './pages/Work.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Analytics from './pages/Analytics.jsx';
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
