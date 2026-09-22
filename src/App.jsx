import React, { useState, useEffect } from 'react';
import CandidatePortal from './components/CandidatePortal';
import RecruiterLogin from './components/RecruiterLogin';
import RecruiterDashboard from './components/RecruiterDashboard';

export default function App() {
  // Mode: 'candidate' | 'recruiter'
  const [mode, setMode] = useState('recruiter');
  const [applyJobId, setApplyJobId] = useState(null);
  const [recruiterAuth, setRecruiterAuth] = useState(null);

  useEffect(() => {
    // 1. Detect candidate URL query params (?apply=JOB_ID or ?job=JOB_ID)
    const params = new URLSearchParams(window.location.search);
    const candidateParam = params.get('apply') || params.get('job');
    const path = window.location.pathname;

    if (candidateParam) {
      setApplyJobId(candidateParam);
      setMode('candidate');
    } else if (path.startsWith('/apply')) {
      const parts = path.split('/apply/');
      if (parts[1]) setApplyJobId(parts[1]);
      setMode('candidate');
    } else {
      // 2. Check existing recruiter session
      const savedAuth = localStorage.getItem('cloudats_recruiter_auth');
      if (savedAuth) {
        try {
          const parsed = JSON.parse(savedAuth);
          if (parsed && parsed.authenticated) {
            setRecruiterAuth(parsed);
          }
        } catch (e) {
          localStorage.removeItem('cloudats_recruiter_auth');
        }
      }
    }
  }, []);

  const handleRecruiterLogin = (authData) => {
    setRecruiterAuth(authData);
    setMode('recruiter');
  };

  const handleRecruiterLogout = () => {
    localStorage.removeItem('cloudats_recruiter_auth');
    setRecruiterAuth(null);
  };

  const handleSwitchToRecruiter = () => {
    setMode('recruiter');
    window.history.pushState({}, '', window.location.pathname);
  };

  // 1. CANDIDATE PORTAL VIEW (For Applicants with Shared Link)
  if (mode === 'candidate') {
    return (
      <CandidatePortal 
        jobId={applyJobId} 
        onNavigateToRecruiter={handleSwitchToRecruiter} 
      />
    );
  }

  // 2. RECRUITER VIEW (LOCKED BEHIND AUTH)
  if (!recruiterAuth) {
    return <RecruiterLogin onLoginSuccess={handleRecruiterLogin} />;
  }

  // 3. RECRUITER COMMAND CENTER
  return (
    <RecruiterDashboard 
      user={recruiterAuth} 
      onLogout={handleRecruiterLogout} 
    />
  );
}
