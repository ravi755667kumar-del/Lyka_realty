import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: 'student-demo-1',
    name: 'Student',
    email: 'student@example.com',
    goal: 'Choose Your Learning Path',
    studyStreak: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            email: session.user.email,
            goal: session.user.user_metadata?.goal || 'Choose Your Learning Path',
            studyStreak: 0,
          });
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            email: session.user.email,
            goal: session.user.user_metadata?.goal || 'Choose Your Learning Path',
            studyStreak: 0,
          });
        } else {
          setUser({
            id: 'student-demo-1',
            name: 'Student',
            email: 'student@example.com',
            goal: 'Choose Your Learning Path',
            studyStreak: 0,
          });
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const updateProfile = async ({ name, email, goal }) => {
    setUser((prev) => ({
      ...prev,
      name: name || prev.name,
      email: email || prev.email,
      goal: goal || prev.goal,
    }));

    try {
      await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user?.id || 'student-demo-1',
          name,
          email,
          goal,
        }),
      });
    } catch (err) {
      console.warn('Profile sync error:', err.message);
    }
  };

  const loginDemoStudent = (demoId = 'student-demo-1') => {
    setUser({
      id: demoId,
      name: 'Student',
      email: `${demoId}@example.com`,
      goal: 'AI / Machine Learning Engineer',
      studyStreak: 0,
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSupabaseConfigured, updateProfile, loginDemoStudent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
