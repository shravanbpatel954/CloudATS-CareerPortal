import React, { useState } from 'react';
import { Lock, Shield, Key, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { vaultApi } from '../api';

export default function RecruiterLogin({ onLoginSuccess }) {
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePasscodeLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await vaultApi.loginRecruiter({ passcode });
      if (res.authenticated) {
        localStorage.setItem('cloudats_recruiter_auth', JSON.stringify(res));
        onLoginSuccess(res);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid passcode. (Default: cloudats2026)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Top Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto text-white shadow-xl shadow-blue-500/25">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CloudATS Recruiter Access</h1>
          <p className="text-xs text-slate-400">
            Enter your recruiter passcode to access the candidate screening pipeline
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0c1222] border border-[#172036] rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl flex items-center gap-2 text-red-300 text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Clean Passcode Login Form */}
          <form onSubmit={handlePasscodeLogin} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium block">
                Recruiter Passcode
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter your recruiter passcode..."
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#080c16] border border-[#1c2742] rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50 text-xs"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Unlocking Recruiter Dashboard...</span>
                </>
              ) : (
                <>
                  <span>Unlock Recruiter Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Information */}
          <div className="pt-3 border-t border-[#161f36] flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted cloud connection to AWS S3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
