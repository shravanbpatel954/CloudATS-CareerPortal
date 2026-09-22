import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Briefcase, 
  Building, 
  FileText, 
  Send, 
  RefreshCw, 
  Check, 
  X,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { vaultApi } from '../api';

function formatBytes(bytes) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function CandidatePortal({ jobId, onNavigateToRecruiter }) {
  const [job, setJob] = useState(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    portfolio: '',
    experienceYears: '2',
    notes: ''
  });
  const [resumeFile, setResumeFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    setLoadingJob(true);
    setError(null);
    try {
      if (jobId) {
        const data = await vaultApi.getPublicJob(jobId);
        setJob(data);
      } else {
        // Fallback to first available job
        const allJobs = await vaultApi.getJobs();
        if (allJobs && allJobs.length > 0) {
          setJob(allJobs[0]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Job role details could not be loaded.');
    } finally {
      setLoadingJob(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      setError('Please attach your resume document (.pdf, .docx, .doc, .txt)');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('jobId', job?.id || jobId || 'general');
      formData.append('name', form.name);
      formData.append('email', form.email);
      formData.append('phone', form.phone);
      formData.append('portfolio', form.portfolio);
      formData.append('experienceYears', form.experienceYears);
      formData.append('notes', form.notes);

      const res = await vaultApi.applyCandidate(formData);
      setSuccessData(res);
      setResumeFile(null);
      setForm({
        name: '',
        email: '',
        phone: '',
        portfolio: '',
        experienceYears: '2',
        notes: ''
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submission failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 font-sans text-sm pb-20 selection:bg-blue-600 selection:text-white">
      {/* Candidate Top Header */}
      <header className="border-b border-[#161f36] bg-[#0c1222]/95 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-base tracking-tight">CloudATS Career Portal</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Encrypted AWS Storage</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs">Direct Candidate Application Gateway</p>
          </div>
        </div>

        {/* Discreet Recruiter Portal Link */}
        {onNavigateToRecruiter && (
          <button
            onClick={onNavigateToRecruiter}
            className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition"
          >
            <Lock className="w-3 h-3" />
            <span className="hidden sm:inline">Recruiter Access</span>
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl flex items-center justify-between text-red-300 text-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading Job State */}
        {loadingJob ? (
          <div className="py-20 text-center text-slate-400 space-y-3 bg-[#0d1424]/40 border border-[#1a233b] rounded-2xl">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-300">Loading Job Opening Details...</p>
          </div>
        ) : job ? (
          <div className="space-y-6">
            {/* Job Overview Card */}
            <div className="bg-gradient-to-br from-[#0c1324] via-[#0d1830] to-[#0a1020] border border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold">
                    {job.department || 'Engineering'}
                  </span>
                  <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs">
                    Min. {job.minExperienceYears || 1}+ Years Experience
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active Opening
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-white tracking-tight">{job.title}</h2>
                <p className="text-slate-300 text-xs leading-relaxed max-w-2xl">
                  {job.description}
                </p>
              </div>

              {/* Skills Tags */}
              <div className="mt-5 pt-4 border-t border-[#1a2540] space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-300">Target Skills & Technical Competencies:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(job.requiredSkills || []).map(skill => (
                    <span key={skill} className="px-2.5 py-1 bg-[#141e36] text-blue-200 border border-blue-500/30 rounded-md text-xs font-mono">
                      {skill}
                    </span>
                  ))}
                  {(job.preferredSkills || []).map(skill => (
                    <span key={skill} className="px-2.5 py-1 bg-[#12192c] text-slate-400 border border-[#1f2d4d] rounded-md text-xs font-mono italic">
                      +{skill} (Preferred)
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Submission Form or Success Receipt */}
            {successData ? (
              <div className="bg-[#0c1222] border border-emerald-500/40 rounded-2xl p-8 text-center space-y-5 shadow-2xl animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">Application Received & Stored in Cloud!</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Your resume has been uploaded directly to the AWS S3 recruitment vault and analyzed by our automated screening engine.
                  </p>
                </div>

                {/* Application Details Receipt */}
                <div className="bg-[#080c16] border border-[#162038] rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-2.5 font-mono">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Application ID:</span>
                    <span className="text-blue-400 font-bold">{successData.applicationId}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Target Role:</span>
                    <span className="text-slate-200">{successData.targetJob?.title}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>AWS Cloud Status:</span>
                    <span className="text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Stored in S3
                    </span>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => setSuccessData(null)}
                    className="px-5 py-2.5 bg-[#141d33] hover:bg-[#1d2a4a] text-slate-200 border border-[#212d4a] rounded-lg text-xs font-medium transition"
                  >
                    Submit Another Application
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#0c1222] border border-[#172036] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="border-b border-[#161f36] pb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                    <span>Candidate Submission Form</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submit your candidate profile and upload your resume document.
                  </p>
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-medium block">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-medium block">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="sarah.jenkins@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-medium block">
                      Contact Phone Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+1 (555) 234-5678"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-medium block">Years of Relevant Experience</label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={form.experienceYears}
                      onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
                      className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-300 font-medium block">LinkedIn Profile or Portfolio URL</label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/sarah-jenkins or https://github.com/..."
                      value={form.portfolio}
                      onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
                      className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-300 font-medium block">Cover Note / Key Highlights (Optional)</label>
                    <textarea
                      rows="3"
                      placeholder="Briefly highlight your experience with the required skills..."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full bg-[#080c16] border border-[#1c2742] rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition resize-none"
                    />
                  </div>
                </div>

                {/* Resume File Upload Drop Box */}
                <div className="space-y-2">
                  <label className="text-slate-300 font-medium text-xs block">
                    Upload Resume Document (.pdf, .docx, .doc, .txt) <span className="text-red-400">*</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.docx,.doc,.txt"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                      resumeFile 
                        ? 'border-emerald-500/60 bg-emerald-950/20' 
                        : 'border-[#1f2c4a] hover:border-blue-500/50 bg-[#080c16]/70'
                    }`}
                  >
                    {resumeFile ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white text-xs block">{resumeFile.name}</span>
                          <span className="text-[11px] text-emerald-400 font-mono">{formatBytes(resumeFile.size)} • Ready for AWS Ingestion</span>
                        </div>
                        <span className="text-[11px] text-slate-400 underline mt-1">Click to select different file</span>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white text-xs block">Click or Drag & Drop your Resume here</span>
                          <span className="text-[11px] text-slate-400">Supported formats: PDF, Microsoft Word (.docx, .doc), or Plain Text</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Uploading to AWS S3 & Scoring...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Application</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="py-16 text-center border border-dashed border-[#1a233b] rounded-2xl bg-[#0b101d]/50 p-6 space-y-3">
            <Building className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-white font-semibold text-sm">Job Opening Not Found</p>
            <p className="text-slate-400 text-xs">The requested job link may have expired or is no longer active.</p>
          </div>
        )}
      </main>
    </div>
  );
}
