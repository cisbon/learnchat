import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Profile, LearningLanguage } from '@/utils/api';
import { getProfile, getActiveLanguage, setActiveLanguage as storeActiveLanguage } from '@/utils/storage';

interface AppContextValue {
  profile: Profile | null;
  activeLanguage: LearningLanguage | null;
  setActiveLanguage: (lang: LearningLanguage) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue>({
  profile: null,
  activeLanguage: null,
  setActiveLanguage: async () => {},
  refreshProfile: async () => {},
  isLoading: true,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeLanguage, setActiveLanguageState] = useState<LearningLanguage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const [p, lang] = await Promise.all([getProfile(), getActiveLanguage()]);
    setProfile(p);
    setActiveLanguageState(lang);
  }, []);

  useEffect(() => {
    refreshProfile().finally(() => setIsLoading(false));
  }, [refreshProfile]);

  const handleSetActiveLanguage = useCallback(async (lang: LearningLanguage) => {
    await storeActiveLanguage(lang);
    setActiveLanguageState(lang);
  }, []);

  return (
    <AppContext.Provider
      value={{
        profile,
        activeLanguage,
        setActiveLanguage: handleSetActiveLanguage,
        refreshProfile,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
