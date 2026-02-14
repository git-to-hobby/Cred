import { motion } from "framer-motion";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext";
import { assistantT } from "@/lib/i18n/assistant";

interface LanguagePickerProps {
  onSelect?: (lang: AppLanguage) => void;
  compact?: boolean;
}

export function LanguagePicker({ onSelect, compact = false }: LanguagePickerProps) {
  const { setLanguage, language } = useLanguage();
  const t = assistantT(language ?? "en");

  const pick = (lang: AppLanguage) => {
    if (lang === language) return;
    setLanguage(lang);
    onSelect?.(lang);
  };

  if (compact) {
    return (
      <div className="inline-flex rounded-lg border border-teal-200/70 bg-white/90 p-0.5 text-xs shadow-sm">
        {(["en", "hi"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => pick(lang)}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              language === lang
                ? "bg-teal-600 text-white"
                : "text-teal-800 hover:bg-teal-50"
            }`}
          >
            {lang === "en" ? "EN" : "HI"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-teal-200/60 bg-white p-8 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
          <Languages className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          Choose your language
          <span className="block text-lg font-semibold text-teal-800 mt-1">अपनी भाषा चुनें</span>
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Select a language before we start. All responses will appear in your chosen language.
          <span className="block mt-1 text-slate-500">
            शुरू करने से पहले भाषा चुनें। सभी उत्तर आपकी चुनी हुई भाषा में दिखेंगे।
          </span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-auto py-4 flex-col gap-1 border-teal-200 hover:border-teal-500 hover:bg-teal-50"
            onClick={() => pick("en")}
          >
            <span className="text-lg font-bold">🇬🇧</span>
            <span className="font-semibold">English</span>
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-auto py-4 flex-col gap-1 border-teal-200 hover:border-teal-500 hover:bg-teal-50"
            onClick={() => pick("hi")}
          >
            <span className="text-lg font-bold">🇮🇳</span>
            <span className="font-semibold">हिंदी</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
