import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const vaultApi = {
  // S3 & Cloud Base
  getStatus: () => api.get('/status').then(r => r.data),
  getFiles: () => api.get('/files').then(r => r.data),
  uploadFile: (file) => {
    const data = new FormData();
    data.append('file', file);
    return api.post('/files/upload', data).then(r => r.data);
  },
  getShareUrl: (key, expiresIn = 3600) => api.get('/files/share', { params: { key, expiresIn } }).then(r => r.data),
  deleteFile: (key) => api.delete('/files', { params: { key } }).then(r => r.data),
  
  // AWS Cloud Ecosystem Overview
  getCloudOverview: () => api.get('/cloud/overview').then(r => r.data),

  // Recruiter Authentication
  loginRecruiter: (creds) => api.post('/auth/recruiter', creds).then(r => r.data),

  // ATS Job Profiles & Candidates
  getJobs: () => api.get('/jobs').then(r => r.data),
  createJob: (job) => api.post('/jobs', job).then(r => r.data),
  deleteJob: (id) => api.delete(`/jobs/${id}`).then(r => r.data),
  getPublicJob: (id) => api.get(`/jobs/${id}/public`).then(r => r.data),

  // Candidate Application Submission (Public URL Flow)
  applyCandidate: (formData) => {
    return api.post('/candidate/apply', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data);
  },

  // ATS Pipeline & Candidate Intelligence
  getPipeline: (jobId) => api.get('/ats/pipeline', { params: { jobId } }).then(r => r.data),
  evaluateAll: (jobId, customJob) => api.post('/ats/evaluate-all', { jobId, customJob }).then(r => r.data),
  evaluateSingle: (key, jobId, customJob) => api.post('/ats/evaluate-single', { key, jobId, customJob }).then(r => r.data),
  deleteApplication: (id) => api.delete(`/candidate/application/${id}`).then(r => r.data),
  getExportCsvUrl: (jobId) => `/api/ats/export${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`,

  // Document Inspection
  analyzeDocument: (key) => api.post('/ai/analyze-document', { key }).then(r => r.data),
  analyzeImage: (key) => api.post('/ai/analyze-image', { key }).then(r => r.data),
};

