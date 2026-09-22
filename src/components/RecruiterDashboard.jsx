import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Sparkles, 
  Search, 
  RefreshCw, 
  Trash2, 
  Link2, 
  FileText, 
  Download, 
  X, 
  Copy, 
  Check, 
  AlertCircle,
  Briefcase,
  Users,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Layers,
  ChevronRight,
  ExternalLink,
  Plus,
  FileSpreadsheet,
  Share2,
  Shield,
  Server,
  Cloud,
  ArrowRight,
  LogOut,
  UserCheck
} from 'lucide-react';
import { vaultApi } from '../api';

function formatBytes(bytes) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function RecruiterDashboard({ user, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [pipelineData, setPipelineData] = useState({ targetJob: null, candidates: [], loading: true });
  const [status, setStatus] = useState({ configured: false, loading: true });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Feedback
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [candidateModal, setCandidateModal] = useState({ isOpen: false, data: null });
  const [shareModal, setShareModal] = useState({ isOpen: false, fileKey: '', url: '', expiry: 3600, copied: false, loading: false });
  const [createJobModal, setCreateJobModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cloudHudModal, setCloudHudModal] = useState(false);

  const [newJobForm, setNewJobForm] = useState({
    title: '',
    department: 'Engineering',
    minExperienceYears: 2,
    requiredSkills: '',
    preferredSkills: '',
    description: ''
  });

  const recruiterFileInputRef = useRef(null);

  useEffect(() => {
    loadJobs();
    checkAwsStatus();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      loadPipeline(selectedJobId);
    }
  }, [selectedJobId]);

  const checkAwsStatus = async () => {
    try {
      const res = await vaultApi.getStatus();
      setStatus({ ...res, loading: false });
    } catch {
      setStatus({ configured: false, loading: false });
    }
  };

  const loadJobs = async () => {
    try {
      const data = await vaultApi.getJobs();
      const list = Array.isArray(data) ? data : [];
      setJobs(list);
      if (list.length > 0 && !selectedJobId) {
        setSelectedJobId(list[0].id);
      }
    } catch (e) {
      console.warn('Failed to load jobs', e);
    }
  };

  const loadPipeline = async (jobId) => {
    setPipelineData(prev => ({ ...prev, loading: true }));
    setError(null);
    try {
      const res = await vaultApi.getPipeline(jobId);
      setPipelineData({
        targetJob: res.targetJob,
        candidates: res.candidates || [],
        loading: false
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load candidate pipeline');
      setPipelineData(prev => ({ ...prev, loading: false }));
    }
  };

  // Direct Resume Upload
  const handleRecruiterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPipelineData(prev => ({ ...prev, loading: true }));
    setError(null);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('jobId', selectedJobId);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

      await vaultApi.applyCandidate(formData);
      setSuccessMsg(`"${file.name}" uploaded to AWS S3 & ATS scored!`);
      if (recruiterFileInputRef.current) recruiterFileInputRef.current.value = '';
      
      await loadPipeline(selectedJobId);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // 1-Click Copy Candidate Link
  const handleCopyCandidateUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}?apply=${selectedJobId}`;
    navigator.clipboard.writeText(url);
    setCopyFeedback(true);
    setSuccessMsg(`Candidate application link copied: ${url}`);
    setTimeout(() => {
      setCopyFeedback(false);
      setSuccessMsg(null);
    }, 4000);
  };

  // Open Candidate Portal in New Tab
  const handlePreviewCandidatePortal = () => {
    const url = `${window.location.origin}${window.location.pathname}?apply=${selectedJobId}`;
    window.open(url, '_blank');
  };

  // Download Excel / CSV
  const handleExportExcel = () => {
    const exportUrl = vaultApi.getExportCsvUrl(selectedJobId);
    const link = document.createElement('a');
    link.href = exportUrl;
    link.setAttribute('download', `CloudATS_${selectedJobId}_Candidates_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMsg('Candidate spreadsheet downloaded in Excel format (.csv)!');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Create Custom Job Role
  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      const res = await vaultApi.createJob(newJobForm);
      if (res.success) {
        await loadJobs();
        setSelectedJobId(res.job.id);
        setCreateJobModal(false);
        setNewJobForm({
          title: '',
          department: 'Engineering',
          minExperienceYears: 2,
          requiredSkills: '',
          preferredSkills: '',
          description: ''
        });
        setSuccessMsg(`Job role "${res.job.title}" created successfully!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create job');
    }
  };

  // Delete Candidate Application
  const handleDeleteApplication = async (id) => {
    try {
      await vaultApi.deleteApplication(id);
      setDeleteTarget(null);
      await loadPipeline(selectedJobId);
      setSuccessMsg('Candidate removed from pipeline');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete application');
    }
  };

  // S3 Presigned Share Link
  const handleOpenShare = async (key, expiry = 3600) => {
    setShareModal({ isOpen: true, fileKey: key, url: '', expiry, copied: false, loading: true });
    try {
      const res = await vaultApi.getShareUrl(key, expiry);
      setShareModal(prev => ({ ...prev, url: res.url, loading: false }));
    } catch {
      setError('Failed to generate presigned S3 link.');
      setShareModal(prev => ({ ...prev, loading: false }));
    }
  };

  const currentJob = jobs.find(j => j.id === selectedJobId) || pipelineData.targetJob;

  const filteredCandidates = (pipelineData.candidates || []).filter(c => {
    const q = searchQuery.toLowerCase();
    const name = c.candidate?.name?.toLowerCase() || '';
    const email = c.candidate?.email?.toLowerCase() || '';
    const skills = (c.candidate?.skills || []).join(' ').toLowerCase();
    const filename = c.filename?.toLowerCase() || '';
    return name.includes(q) || email.includes(q) || skills.includes(q) || filename.includes(q);
  });

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 font-sans text-sm pb-24 selection:bg-blue-600 selection:text-white">
      {/* Recruiter Header */}
      <header className="border-b border-[#161f36] bg-[#0c1222]/95 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-base tracking-tight">CloudATS Recruiter Panel</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>AWS Live</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs hidden sm:block">Automated Resume Screening & Candidate Ranking Engine</p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AWS Cloud Info Button */}
          <button
            onClick={() => setCloudHudModal(true)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1628] hover:bg-[#142038] text-slate-300 border border-[#1a2540] rounded-lg text-xs font-mono transition"
            title="View AWS Infrastructure Details"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span>S3: {status.bucket || 'cloudats-bucket'}</span>
          </button>

          {/* Recruiter Logout */}
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-[#141d33] hover:bg-red-950/40 hover:text-red-300 text-slate-400 border border-[#212d4a] hover:border-red-800/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            title="Lock Dashboard & Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock / Logout</span>
          </button>
        </div>
      </header>

      {/* Global Alerts Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl flex items-center justify-between text-red-300 text-xs mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl flex items-center justify-between text-emerald-300 text-xs mb-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-2 space-y-6">
        {/* Top Control Bar: Active Role Selector & 1-Click Action Buttons */}
        <div className="bg-[#0c1222] border border-[#172036] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Role Picker */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Select Job Role to Screen:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="bg-[#080c16] border border-[#1c2742] text-white rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 min-w-[260px]"
                  >
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.department})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setCreateJobModal(true)}
                    className="px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Add a new job opening"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Role</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Recruiter Primary Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* 1-Click Copy Candidate Link */}
              <button
                onClick={handleCopyCandidateUrl}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow ${
                  copyFeedback
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/20'
                }`}
                title="Share this URL with candidates to apply"
              >
                {copyFeedback ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copyFeedback ? 'Link Copied to Clipboard!' : 'Share Candidate Link'}</span>
              </button>

              {/* Preview Candidate Portal */}
              <button
                onClick={handlePreviewCandidatePortal}
                className="px-3 py-2 bg-[#141d33] hover:bg-[#1e293b] text-slate-300 border border-[#212d4a] rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                title="Open the public candidate application portal in a new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Candidate Portal</span>
              </button>

              {/* Export to Excel (.csv) */}
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
                title="Download all candidate details and scores into an Excel spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Excel (.csv)</span>
              </button>

              {/* Direct Recruiter Resume Upload */}
              <input
                type="file"
                ref={recruiterFileInputRef}
                onChange={handleRecruiterUpload}
                className="hidden"
                accept=".docx,.pdf,.doc,.txt"
              />
              <button
                onClick={() => recruiterFileInputRef.current?.click()}
                className="p-2 bg-[#141d33] hover:bg-[#1e293b] text-slate-300 border border-[#212d4a] rounded-lg transition"
                title="Directly upload a resume file to S3 and score"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Job Summary */}
          {currentJob && (
            <div className="pt-3 border-t border-[#161f36] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm">{currentJob.title}</span>
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded text-[11px] font-mono">
                    {currentJob.department}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded text-[11px]">
                    Min. {currentJob.minExperienceYears}+ Yrs Required
                  </span>
                </div>
                <p className="text-slate-400 text-xs line-clamp-1 max-w-3xl">{currentJob.description}</p>
              </div>

              {/* Required Skills Badges */}
              <div className="flex flex-wrap items-center gap-1">
                {(currentJob.requiredSkills || []).slice(0, 6).map(skill => (
                  <span key={skill} className="px-2 py-0.5 bg-[#141e36] text-slate-300 border border-[#212d4a] rounded text-[11px] font-mono">
                    {skill}
                  </span>
                ))}
                {(currentJob.requiredSkills || []).length > 6 && (
                  <span className="text-slate-500 text-[10px]">+{((currentJob.requiredSkills || []).length - 6)} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Candidate Pipeline Header & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter applicants by name, email, or detected skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0c1222] border border-[#172036] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              <strong>{filteredCandidates.length}</strong> applicant{filteredCandidates.length === 1 ? '' : 's'} (Ranked by ATS Match Score)
            </span>
            <button
              onClick={() => loadPipeline(selectedJobId)}
              className="p-1.5 bg-[#0c1222] hover:bg-[#162038] text-slate-400 hover:text-white border border-[#172036] rounded-lg transition"
              title="Refresh Pipeline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pipelineData.loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ranked Candidate Pipeline */}
        {pipelineData.loading ? (
          <div className="py-20 text-center text-slate-400 space-y-3 bg-[#0c1222]/50 border border-[#172036] rounded-2xl">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-300">Evaluating candidate pipeline in AWS Cloud...</p>
            <p className="text-[11px] text-slate-500">Ranking applicants by skills match, experience, and job relevance</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-[#1a233b] rounded-2xl bg-[#0b101d]/50 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#131b30] flex items-center justify-center mx-auto text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No applicants for this role yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Share the application link with candidates or upload resumes directly to score them.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleCopyCandidateUrl}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow inline-flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Candidate Application Link</span>
              </button>
              <button
                onClick={() => recruiterFileInputRef.current?.click()}
                className="px-4 py-2 bg-[#141e36] hover:bg-[#1d2a4a] text-slate-200 border border-[#212d4a] text-xs font-medium rounded-lg inline-flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Sample Resume</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCandidates.map((c, index) => {
              const evalData = c.evaluation || {};
              const cand = c.candidate || {};
              const isTopRank = index === 0;

              return (
                <div
                  key={c.id || c.key || index}
                  className={`bg-[#0c1222] border rounded-2xl p-4 sm:p-5 transition hover:border-blue-500/50 relative overflow-hidden ${
                    isTopRank 
                      ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/20' 
                      : 'border-[#172036]'
                  }`}
                >
                  {/* Rank Badge */}
                  <div className={`absolute top-0 right-0 text-white text-[10px] font-bold px-3.5 py-1 rounded-bl-xl flex items-center gap-1 shadow ${
                    isTopRank
                      ? 'bg-gradient-to-l from-emerald-600 to-teal-600'
                      : index === 1
                      ? 'bg-gradient-to-l from-blue-600 to-indigo-600'
                      : 'bg-[#1a253e] text-slate-300'
                  }`}>
                    <Award className="w-3 h-3" />
                    <span>RANK #{c.rank || index + 1}</span>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    {/* Candidate Identity & Scores */}
                    <div className="flex items-start gap-4">
                      {/* ATS Score Circle */}
                      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border font-bold flex-shrink-0 ${
                        evalData.atsScore >= 80 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : evalData.atsScore >= 60
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>
                        <span className="text-lg leading-none">{evalData.atsScore || 0}%</span>
                        <span className="text-[9px] font-medium opacity-80 mt-0.5">MATCH</span>
                      </div>

                      {/* Candidate Details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 
                            className="text-sm font-bold text-white hover:text-blue-400 cursor-pointer" 
                            onClick={() => setCandidateModal({ isOpen: true, data: c })}
                          >
                            {cand.name || c.filename}
                          </h3>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                            evalData.badgeColor === 'emerald'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : evalData.badgeColor === 'blue'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {evalData.recommendation || 'Scored'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-400 text-xs flex-wrap">
                          {cand.email && <span>{cand.email}</span>}
                          {cand.phone && <span>• {cand.phone}</span>}
                          <span>• ~{cand.estimatedYears || 1} Yrs Exp</span>
                          {c.appliedAt && <span className="text-slate-500 font-mono">• {new Date(c.appliedAt).toLocaleDateString()}</span>}
                        </div>

                        {/* Score Breakdown Bars */}
                        <div className="pt-2 flex items-center gap-4 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span>Skills Match:</span>
                            <span className="font-semibold text-slate-200">{evalData.scoreBreakdown?.skillsScore || 0}%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>Experience:</span>
                            <span className="font-semibold text-slate-200">{evalData.scoreBreakdown?.experienceScore || 0}%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>Relevance:</span>
                            <span className="font-semibold text-slate-200">{evalData.scoreBreakdown?.keywordScore || 0}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      <button
                        onClick={() => setCandidateModal({ isOpen: true, data: c })}
                        className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Evaluation Report</span>
                      </button>

                      {c.key && (
                        <button
                          onClick={() => handleOpenShare(c.key)}
                          className="p-1.5 bg-[#141b2b] hover:bg-[#1d273d] text-slate-300 border border-[#212b42] rounded-lg transition"
                          title="Generate Presigned S3 Share Link"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {c.previewUrl && (
                        <a
                          href={c.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-[#141b2b] hover:bg-[#1d273d] text-slate-300 border border-[#212b42] rounded-lg transition"
                          title="Download Resume Document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => setDeleteTarget(c.id || c.key)}
                        className="p-1.5 bg-[#141b2b] hover:bg-red-950/50 hover:text-red-400 border border-[#212b42] text-slate-400 rounded-lg transition"
                        title="Delete candidate application"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Matched vs Missing Skills Tags */}
                  <div className="mt-3.5 pt-3 border-t border-[#161f36] grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {/* Matched Skills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-slate-400 text-[11px] font-medium">Matched:</span>
                      {(evalData.matchedSkills || []).length > 0 ? (
                        evalData.matchedSkills.map(s => (
                          <span key={s} className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded text-[10px] font-mono">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">No direct skill matches</span>
                      )}
                    </div>

                    {/* Missing Skills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <XCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-slate-400 text-[11px] font-medium">Missing:</span>
                      {(evalData.missingSkills || []).length > 0 ? (
                        evalData.missingSkills.map(s => (
                          <span key={s} className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded text-[10px] font-mono">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-emerald-400 text-[11px] font-medium">All required skills met!</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* MODAL 1: CANDIDATE DETAILED EVALUATION REPORT */}
      {candidateModal.isOpen && candidateModal.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0d1424] border border-[#202d4a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#11192e] border-b border-[#1d2842] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                  {candidateModal.data.evaluation?.atsScore || 0}%
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {candidateModal.data.candidate?.name || candidateModal.data.filename}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Target Role: <strong>{currentJob?.title}</strong> • Rank #{candidateModal.data.rank || 1}
                  </p>
                </div>
              </div>
              <button onClick={() => setCandidateModal({ isOpen: false, data: null })} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="bg-[#080c16] border border-[#18233a] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 text-[10px] block">Email</span>
                  <span className="text-slate-200 font-medium">{candidateModal.data.candidate?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Phone</span>
                  <span className="text-slate-200 font-medium">{candidateModal.data.candidate?.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Est. Experience</span>
                  <span className="text-slate-200 font-medium">{candidateModal.data.candidate?.estimatedYears || 1}+ Years</span>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-slate-500 text-[10px] block">Portfolio / Links</span>
                  <span className="text-blue-400 font-medium truncate block">
                    {candidateModal.data.candidate?.portfolio || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Skills breakdown */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 text-xs">Skill Breakdown & Competencies</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-xl space-y-2">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4" /> Matched Required Skills
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(candidateModal.data.evaluation?.matchedSkills || []).map(s => (
                        <span key={s} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl space-y-2">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                      <XCircle className="w-4 h-4" /> Missing Key Requirements
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(candidateModal.data.evaluation?.missingSkills || []).map(s => (
                        <span key={s} className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-mono">
                          {s}
                        </span>
                      ))}
                      {(candidateModal.data.evaluation?.missingSkills || []).length === 0 && (
                        <span className="text-emerald-400 text-xs">All required skills met!</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Interview Prep */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h4 className="font-bold text-slate-200 text-xs">Auto-Generated Technical Interview Questions</h4>
                </div>
                <div className="space-y-2">
                  {(candidateModal.data.evaluation?.interviewQuestions || []).map((q, idx) => (
                    <div key={idx} className="p-3 bg-[#080c16] border border-[#1a253d] rounded-xl text-slate-300 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-xs leading-relaxed">{q}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-[#0a0f1d] border-t border-[#1d2842] flex items-center justify-between">
              {candidateModal.data.previewUrl ? (
                <a
                  href={candidateModal.data.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#141d33] hover:bg-[#1f2d4e] text-slate-200 border border-[#212d4a] rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download S3 Resume</span>
                </a>
              ) : <div />}

              <button
                onClick={() => setCandidateModal({ isOpen: false, data: null })}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: S3 PRESIGNED SHARE URL */}
      {shareModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0d1424] border border-[#202d4a] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm">AWS S3 Presigned URL</h3>
              </div>
              <button onClick={() => setShareModal({ ...shareModal, isOpen: false })} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Time-limited, encrypted temporary link allowing secure download without making S3 bucket public.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-semibold block">Expiration Duration:</label>
              <select
                value={shareModal.expiry}
                onChange={(e) => handleOpenShare(shareModal.fileKey, parseInt(e.target.value))}
                className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3 py-2 text-xs text-slate-200"
              >
                <option value={3600}>1 Hour</option>
                <option value={86400}>24 Hours (1 Day)</option>
                <option value={604800}>7 Days</option>
              </select>
            </div>

            {shareModal.loading ? (
              <div className="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                <span>Signing AWS S3 URL...</span>
              </div>
            ) : shareModal.url ? (
              <div className="space-y-2">
                <div className="p-2.5 bg-[#080c16] border border-[#1c2742] rounded-lg font-mono text-[11px] text-slate-300 break-all max-h-24 overflow-y-auto">
                  {shareModal.url}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareModal.url);
                    setShareModal(prev => ({ ...prev, copied: true }));
                    setTimeout(() => setShareModal(prev => ({ ...prev, copied: false })), 2000);
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  {shareModal.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{shareModal.copied ? 'Copied Presigned Link!' : 'Copy Presigned URL'}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE JOB ROLE */}
      {createJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#0d1424] border border-[#202d4a] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm">Create New Job Role</h3>
              </div>
              <button onClick={() => setCreateJobModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Cloud DevOps Engineer"
                  value={newJobForm.title}
                  onChange={(e) => setNewJobForm({ ...newJobForm, title: e.target.value })}
                  className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Department</label>
                  <input
                    type="text"
                    value={newJobForm.department}
                    onChange={(e) => setNewJobForm({ ...newJobForm, department: e.target.value })}
                    className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Min Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={newJobForm.minExperienceYears}
                    onChange={(e) => setNewJobForm({ ...newJobForm, minExperienceYears: e.target.value })}
                    className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Required Skills (Comma separated) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS, Terraform, Docker, Kubernetes, Python"
                  value={newJobForm.requiredSkills}
                  onChange={(e) => setNewJobForm({ ...newJobForm, requiredSkills: e.target.value })}
                  className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Job Description & Responsibilities *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Describe key responsibilities and expectations..."
                  value={newJobForm.description}
                  onChange={(e) => setNewJobForm({ ...newJobForm, description: e.target.value })}
                  className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateJobModal(false)}
                  className="px-3.5 py-1.5 bg-[#141b2b] hover:bg-[#1e293b] text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs shadow"
                >
                  Create Role & Generate Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#0d1424] border border-[#202d4a] rounded-2xl shadow-2xl p-5 space-y-3 text-xs">
            <h3 className="font-bold text-white text-sm">Remove Candidate</h3>
            <p className="text-slate-400">
              Are you sure you want to remove this candidate application from the pipeline?
            </p>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 bg-[#141b2b] text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteApplication(deleteTarget)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CLOUD HUD MODAL */}
      {cloudHudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-[#0d1424] border border-[#202d4a] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">AWS Cloud Architecture Ecosystem</h3>
              </div>
              <button onClick={() => setCloudHudModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Live status of all interconnected AWS Cloud services powering the recruitment pipeline:
            </p>

            <div className="space-y-2.5 text-xs">
              {/* Service 1: S3 */}
              <div className="p-3 bg-[#080c16] border border-[#162038] rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>AWS S3 (Simple Storage Service)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">Object storage for candidate resumes & encrypted presigned URLs</p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-emerald-400 block">{status.bucket || 'dsccproj'}</span>
                  <span className="text-slate-500">{status.region || 'eu-north-1'}</span>
                </div>
              </div>

              {/* Service 2: STS */}
              <div className="p-3 bg-[#080c16] border border-[#162038] rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>AWS STS (Security Token Service)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">IAM Caller validation & dynamic session identity</p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-blue-400 block">{status.account ? `Account: ${status.account}` : 'Authenticated'}</span>
                  <span className="text-slate-500 truncate max-w-[140px] block">{status.arn || 'IAM Session'}</span>
                </div>
              </div>

              {/* Service 3: Textract */}
              <div className="p-3 bg-[#080c16] border border-[#162038] rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span>AWS Textract (AI Document Intelligence)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">OCR text extraction & skills parsing from PDF/Word documents</p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-cyan-400">Active (OCR Ready)</span>
                </div>
              </div>

              {/* Service 4: CloudWatch */}
              <div className="p-3 bg-[#080c16] border border-[#162038] rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    <span>AWS CloudWatch (Telemetry & Metrics)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">Publishes custom metrics: ResumesIngested, TopMatches, ATS Scores</p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-indigo-400">Namespace: CloudATS</span>
                </div>
              </div>

              {/* Service 5: SES */}
              <div className="p-3 bg-[#080c16] border border-[#162038] rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>AWS SES (Simple Email Service)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">Automated application confirmation emails & recruiter alerts</p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <span className="text-amber-400">Integrated</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setCloudHudModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs shadow"
              >
                Close Architecture View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
