import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, PatientProfile, ProfessionalProfile, UserRole } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  patientProfile: PatientProfile | null;
  professionalProfile: ProfessionalProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [professionalProfile, setProfessionalProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // IMPORTANT: this function is independent of React's `user` state.
  // The previous implementation captured `user` in useCallback. Every
  // setUser() changed the callback identity, which re-ran the auth effect,
  // registered another auth listener and repeatedly queried Supabase.
  const loadProfiles = useCallback(async (uid: string, metadataRole?: unknown) => {
    const { data: prof, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to load profile:', profileError);
    }

    const dbProfile = prof as Profile | null;
    setProfile(dbProfile);

    const role: UserRole =
      dbProfile?.role ||
      (metadataRole === 'professional' || metadataRole === 'admin' ? metadataRole : 'patient');

    if (role === 'patient') {
      const { data: pp, error: patientError } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (patientError) {
        console.error('Failed to load patient profile:', patientError);
      }

      setPatientProfile(pp as PatientProfile | null);
      setProfessionalProfile(null);
    } else {
      const { data: propp, error: professionalError } = await supabase
        .from('professional_profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (professionalError) {
        console.error('Failed to load professional profile:', professionalError);
      }

      setProfessionalProfile(propp as ProfessionalProfile | null);
      setPatientProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySession = async (s: Session | null) => {
      if (!mounted) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setProfile(null);
        setPatientProfile(null);
        setProfessionalProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const metadata = s.user.user_metadata as Record<string, unknown> | undefined;
      await loadProfiles(s.user.id, metadata?.role);

      if (mounted) setLoading(false);
    };

    // Resolve the initial session once.
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      void applySession(s);
    });

    // Keep this listener lightweight. Do not await Supabase queries directly
    // inside onAuthStateChange; auth events can be emitted while the auth
    // client is still updating its internal state.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setProfile(null);
        setPatientProfile(null);
        setProfessionalProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const metadata = s.user.user_metadata as Record<string, unknown> | undefined;

      // Defer the database queries until the auth callback has returned.
      setTimeout(() => {
        if (!mounted) return;
        void loadProfiles(s.user.id, metadata?.role).finally(() => {
          if (mounted) setLoading(false);
        });
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfiles]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPatientProfile(null);
    setProfessionalProfile(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    await loadProfiles(user.id, metadata?.role);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        patientProfile,
        professionalProfile,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
