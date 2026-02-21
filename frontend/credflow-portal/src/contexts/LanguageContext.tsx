import { createContext, useContext, useState, ReactNode } from "react";

export type AppLanguage = "en" | "hi";

const STORAGE_KEY = "credflow_language";

interface LanguageContextType {
  language: AppLanguage | null;
  setLanguage: (lang: AppLanguage) => void;
  isSelected: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "hi" ? stored : null;
  });

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isSelected: language !== null,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
