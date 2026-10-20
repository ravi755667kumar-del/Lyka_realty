import React, { useState } from 'react';
import { 
  GraduationCap, 
  User, 
  X, 
  Save, 
  Edit3 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isSupabaseConfigured, updateProfile } = useAuth();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || 'Student');
  const [emailInput, setEmailInput] = useState(user?.email || 'student@example.com');
  const [goalInput, setGoalInput] = useState(user?.goal || 'Full-Stack Web Development');

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

          {/* Student Profile Button (Click to edit) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setNameInput(user?.name || 'Student');
                setEmailInput(user?.email || 'student@example.com');
                setGoalInput(user?.goal || 'Full-Stack Web Development');
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

      {/* Edit Student Profile Modal */}
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
    </>
  );
}
