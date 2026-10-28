import React, { useState } from 'react';
import { 
  GraduationCap, 
  User, 
  X, 
  Save, 
  Edit3,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  LogIn,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRoadmap } from '../context/RoadmapContext';

// ─── Admin credentials (change these as needed) ───────────────────────────────
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin@123';
// ──────────────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { user, isSupabaseConfigured, updateProfile } = useAuth();
  const { resetProgress } = useRoadmap();

  // ── Student Profile modal state ──
  const [isResetting, setIsResetting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || 'Student');
  const [emailInput, setEmailInput] = useState(user?.email || 'student@example.com');
  const [goalInput, setGoalInput] = useState(user?.goal || 'Full-Stack Web Development');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Admin Login modal state ──
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const handleStartNew = async () => {
    if (window.confirm('Start a fresh new learning journey? This will reset your progress to 0% so you can begin clean.')) {
      setIsResetting(true);
      try {
        await resetProgress();
        await fetch('/api/ai/chat/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: user?.id || 'student-demo-1' })
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (updateProfile) {
      updateProfile({
        name: nameInput.trim() || 'Student',
        email: emailInput.trim() || 'student@example.com',
        goal: goalInput.trim() || 'Full-Stack Web Development',
      });
    }
    setIsEditOpen(false);
    setPasswordInput('');
  };

  const openAdminModal = () => {
    setAdminUsername('');
    setAdminPassword('');
    setAdminError('');
    setAdminSuccess(false);
    setShowAdminPassword(false);
    setIsEditOpen(false);       // close student profile modal first
    setIsAdminModalOpen(true);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername.trim() === ADMIN_USERNAME && adminPassword === ADMIN_PASSWORD) {
      setAdminSuccess(true);
      setAdminError('');
      setIsAdminLoggedIn(true);
      setTimeout(() => {
        setIsAdminModalOpen(false);
        setAdminSuccess(false);
      }, 1500);
    } else {
      setAdminError('Invalid admin username or password. Please try again.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-gray-800/80 bg-[#0B0F19]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-teal-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0B0F19] rounded-[11px] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Teacher Luna</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AI Study Mentor
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium hidden sm:block">
                Conversational Learning Progress Tracker
              </p>
            </div>
          </div>

          {/* Action Buttons & Student Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Admin badge (shown when admin is logged in) */}
            {isAdminLoggedIn && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                <ShieldCheck className="w-3 h-3" />
                <span className="hidden sm:inline">Admin</span>
              </div>
            )}

            <button
              onClick={handleStartNew}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 hover:from-indigo-500/20 hover:via-purple-500/20 hover:to-pink-500/20 border border-indigo-500/30 hover:border-indigo-400/50 text-indigo-300 hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95 group"
              title="Start a new learning journey (Reset progress to 0%)"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-indigo-400 group-hover:text-cyan-300 transition-transform duration-300 ${isResetting ? 'animate-spin' : 'group-hover:-rotate-90'}`} />
              <span className="hidden sm:inline">Start New</span>
              <Sparkles className="w-3 h-3 text-amber-400 opacity-80 group-hover:opacity-100" />
            </button>

            {/* Student Profile Button (Click to edit) */}
            <button
              onClick={() => {
                setNameInput(user?.name || 'Student');
                setEmailInput(user?.email || 'student@example.com');
                setGoalInput(user?.goal || 'Full-Stack Web Development');
                setPasswordInput('');
                setShowPassword(false);
                setIsEditOpen(true);
              }}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-900 border border-transparent hover:border-gray-800 transition-all text-left group"
              title="Click to edit student profile"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-teal-400 p-[1px] relative">
                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center text-xs font-bold text-indigo-300">
                  {user?.name?.charAt(0) || 'S'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 border border-gray-900" />
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-gray-200 leading-none group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                  <span>{user?.name || 'Student'}</span>
                  <Edit3 className="w-2.5 h-2.5 opacity-60" />
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[110px]">
                  {isSupabaseConfigured ? 'Supabase Synced' : 'Active Student'}
                </div>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── Edit Student Profile Modal ── */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-indigo-500/30 p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Update Student Profile</h3>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 font-medium mb-1">Full Student Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 focus:border-indigo-500 text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. student@university.edu"
                  className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 focus:border-indigo-500 text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Primary Learning Goal</label>
                <input
                  type="text"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="e.g. AI / Machine Learning Engineer"
                  className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 focus:border-indigo-500 text-white focus:outline-none"
                  required
                />
              </div>

              {/* Password field */}
              <div>
                <label className="block text-gray-400 font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-gray-950 border border-gray-800 focus:border-indigo-500 text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* ── Admin Login link (like "Forgot Password") ── */}
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={openAdminModal}
                    className="flex items-center gap-1 text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors font-medium group"
                  >
                    <ShieldCheck className="w-3 h-3 group-hover:scale-110 transition-transform" />
                    Admin Login
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-600/30"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin Login Modal ── */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className="w-full max-w-sm rounded-2xl shadow-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #0f1629 0%, #0a0e1a 100%)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              boxShadow: '0 0 40px rgba(251, 191, 36, 0.08), 0 25px 50px rgba(0,0,0,0.6)',
            }}
          >
            {/* Glow accent top */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent)' }}
            />

            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.05))',
                      border: '1px solid rgba(251,191,36,0.25)',
                    }}
                  >
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Admin Login</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Restricted access — admins only</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdminModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

              {/* Success state */}
              {adminSuccess ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-green-400">Admin access granted!</p>
                  <p className="text-xs text-gray-500">Redirecting…</p>
                </div>
              ) : (
                <form onSubmit={handleAdminLogin} className="space-y-4 text-xs">
                  {/* Error message */}
                  {adminError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{adminError}</span>
                    </div>
                  )}

                  {/* Username */}
                  <div>
                    <label className="block text-gray-400 font-medium mb-1.5">Admin Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(e) => { setAdminUsername(e.target.value); setAdminError(''); }}
                        placeholder="Enter admin username"
                        autoComplete="off"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: adminError ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                        onFocus={(e) => { if (!adminError) e.target.style.border = '1px solid rgba(251,191,36,0.35)'; }}
                        onBlur={(e) => { if (!adminError) e.target.style.border = '1px solid rgba(255,255,255,0.08)'; }}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-gray-400 font-medium mb-1.5">Admin Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
                        placeholder="Enter admin password"
                        autoComplete="current-password"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: adminError ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                        onFocus={(e) => { if (!adminError) e.target.style.border = '1px solid rgba(251,191,36,0.35)'; }}
                        onBlur={(e) => { if (!adminError) e.target.style.border = '1px solid rgba(255,255,255,0.08)'; }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                        tabIndex={-1}
                      >
                        {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #d97706, #b45309)',
                      boxShadow: '0 4px 20px rgba(217, 119, 6, 0.3)',
                      color: '#fff',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 28px rgba(217, 119, 6, 0.45)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 20px rgba(217, 119, 6, 0.3)'}
                  >
                    <LogIn className="w-4 h-4" />
                    Login as Admin
                  </button>

                  <p className="text-center text-[10px] text-gray-600">
                    Admin credentials are configured by the system owner.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
