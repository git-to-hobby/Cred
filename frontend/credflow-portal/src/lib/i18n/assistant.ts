import type { AppLanguage } from "@/contexts/LanguageContext";

const copy = {
  en: {
    pageTitle: "AI Loan Assistant",
    pageSubtitle: "Get instant answers about loans, eligibility, and more",
    chooseLanguage: "Choose your language",
    chooseLanguageSub: "Select a language before we start. All responses will appear in your chosen language.",
    english: "English",
    hindi: "Hindi",
    continue: "Continue",
    changeLanguage: "Change language",
    welcome: `Hello! 👋 I'm your CredFlow Finance AI Assistant.

I can help you with:
• Checking loan eligibility
• Understanding EMI calculations
• Document requirements
• Finding the right loan product
• Government schemes and subsidies

How can I assist you today?`,
    connectedAs: "Connected as",
    loginPrompt: "Please",
    loginLink: "login to use the AI Assistant",
    backendOffline: "Backend is offline. Run in terminal:",
    quickActions: "Quick actions:",
    qaEligibility: "Check loan eligibility",
    qaEligibilityMsg: "Check my eligibility for a personal loan",
    qaDocs: "Required documents",
    qaDocsMsg: "What documents do I need for a home loan?",
    qaEmi: "EMI query",
    qaEmiMsg: "How is EMI calculated?",
    qaBest: "Best loan for me",
    qaBestMsg: "Which loan product is best for my needs?",
    inputPlaceholder: "Type your question here...",
    inputLogin: "Please login to chat",
    authRequired: "Authentication Required",
    authRequiredDesc: "Please login to use the AI Assistant",
    loading1: "Processing your question...",
    loading2: "Checking loan details and eligibility...",
    loading3: "Taking a bit longer — server may be starting...",
    loading4: "Almost done, please wait...",
    noReply: "Sorry, no response received. Please try again.",
    timeout: "Request timed out. Backend may be starting — try again in 30 seconds.",
    errorPrefix: "Sorry, I can't respond right now:",
    docVerified: "Document verified",
    docVerifiedDesc: "Sending to AI — your application will continue.",
    openVerification: "Open document upload / verification",
    resetDone: "Conversation Reset",
    resetDoneDesc: "Your conversation has been reset",
    resetFail: "Failed to reset conversation",
    disclaimer:
      "This AI assistant provides general information only. Final loan decisions are subject to verification and approval.",
    applyLoan: (type: string) =>
      `I want to apply for a ${type}. Please guide me through eligibility check and the full application process.`,
    applyNoc: (type: string) =>
      `I need an NOC certificate for ${type}. Please help me with the process.`,
    verification: {
      title: "Document Verification",
      badge: "Required for loan",
      hint: "AI has requested verification — upload documents here. After verification, your application will continue.",
      salary: "Salary Slip",
      salaryDesc: "PDF / JPG — verify income",
      bank: "Bank Statement",
      bankDesc: "PDF — 6 month statement",
      kyc: "KYC Verify",
      kycDesc: "Profile check + Aadhaar/PAN",
      uploadKyc: "Upload Aadhaar / PAN",
      useSampleSalary: "Upload sample salary slip",
      downloadSampleSalary: "Download sample PDF",
      sampleLoadFail: "Could not load sample salary slip.",
      salaryVerified: (amount: string, source?: string) =>
        `Salary slip verified. Monthly salary: ${amount}${source ? ` from ${source}` : ""}. Please continue my loan application.`,
      salaryReview: "Salary document uploaded for review. Please continue my loan application.",
      salaryFail: "Could not verify salary slip. Please try again.",
      bankUploaded: (score?: number) =>
        `Bank statement uploaded.${score ? ` Financial health score: ${score}/100.` : ""} Please analyze and continue my loan application.`,
      bankFail: "Bank statement upload failed",
      kycDone: "KYC verification complete. Status: verified. Please proceed with my loan application and run underwriting.",
      kycPending: "KYC pending — please upload Aadhaar or PAN document.",
      kycFail: "KYC verification failed",
      kycDoc: (status: string) =>
        `KYC document uploaded. Status: ${status}. Please verify KYC and continue my loan application.`,
      kycDocFail: "KYC document upload failed",
    },
  },
  hi: {
    pageTitle: "एआई ऋण सहायक",
    pageSubtitle: "ऋण, पात्रता और दस्तावेज़ों के बारे में तुरंत जानकारी पाएँ",
    chooseLanguage: "अपनी भाषा चुनें",
    chooseLanguageSub: "शुरू करने से पहले भाषा चुनें। सभी उत्तर आपकी चुनी हुई भाषा में दिखेंगे।",
    english: "English",
    hindi: "हिंदी",
    continue: "आगे बढ़ें",
    changeLanguage: "भाषा बदलें",
    welcome: `नमस्ते! 👋 मैं CredFlow Finance का एआई सहायक हूँ।

मैं आपकी इन विषयों में सहायता कर सकता हूँ:
• ऋण पात्रता जाँच
• EMI गणना समझाना
• आवश्यक दस्तावेज़
• उपयुक्त ऋण उत्पाद खोजना
• सरकारी योजनाएँ और सब्सिडी

आज मैं आपकी कैसे सहायता कर सकता हूँ?`,
    connectedAs: "जुड़े हुए",
    loginPrompt: "एआई सहायक के लिए कृपया",
    loginLink: "लॉगिन करें",
    backendOffline: "सर्वर ऑफ़लाइन है। टर्मिनल में चलाएँ:",
    quickActions: "त्वरित विकल्प:",
    qaEligibility: "पात्रता जाँचें",
    qaEligibilityMsg: "मेरी व्यक्तिगत ऋण पात्रता जाँच करें",
    qaDocs: "आवश्यक दस्तावेज़",
    qaDocsMsg: "गृह ऋण के लिए कौन-से दस्तावेज़ चाहिए?",
    qaEmi: "EMI संबंधी प्रश्न",
    qaEmiMsg: "EMI की गणना कैसे होती है?",
    qaBest: "मेरे लिए सर्वोत्तम ऋण",
    qaBestMsg: "मेरी ज़रूरत के अनुसार कौन-सा ऋण उत्पाद सबसे अच्छा है?",
    inputPlaceholder: "अपना प्रश्न यहाँ लिखें...",
    inputLogin: "चैट के लिए कृपया लॉगिन करें",
    authRequired: "लॉगिन आवश्यक",
    authRequiredDesc: "एआई सहायक उपयोग करने के लिए कृपया लॉगिन करें",
    loading1: "आपका प्रश्न संसाधित हो रहा है...",
    loading2: "ऋण विवरण और पात्रता की जाँच हो रही है...",
    loading3: "थोड़ा समय लग रहा है — सर्वर शुरू हो रहा हो सकता है...",
    loading4: "लगभग पूरा हो गया, कृपया प्रतीक्षा करें...",
    noReply: "क्षमा करें, कोई उत्तर नहीं मिला। कृपया पुनः प्रयास करें।",
    timeout: "अनुरोध समय समाप्त हो गया। 30 सेकंड बाद पुनः प्रयास करें।",
    errorPrefix: "क्षमा करें, अभी उत्तर नहीं दे पा रहा हूँ:",
    docVerified: "दस्तावेज़ सत्यापित",
    docVerifiedDesc: "एआई को भेजा जा रहा है — आपका आवेदन आगे बढ़ेगा।",
    openVerification: "दस्तावेज़ अपलोड / सत्यापन खोलें",
    resetDone: "वार्तालाप रीसेट",
    resetDoneDesc: "आपकी वार्तालाप रीसेट हो गई है",
    resetFail: "रीसेट नहीं हो सका",
    disclaimer:
      "यह एआई सहायक केवल सामान्य जानकारी देता है। अंतिम ऋण निर्णय सत्यापन और अनुमोदन के अधीन है।",
    applyLoan: (type: string) =>
      `मुझे ${type} के लिए आवेदन करना है। कृपया पात्रता जाँच और पूरी आवेदन प्रक्रिया में मार्गदर्शन करें।`,
    applyNoc: (type: string) =>
      `मुझे ${type} के लिए NOC प्रमाणपत्र चाहिए। कृपया इस प्रक्रिया में सहायता करें।`,
    verification: {
      title: "दस्तावेज़ सत्यापन",
      badge: "ऋण के लिए आवश्यक",
      hint: "एआई ने सत्यापन माँगा है — यहाँ से दस्तावेज़ अपलोड करें। सत्यापन के बाद आवेदन आगे बढ़ेगा।",
      salary: "वेतन पर्ची",
      salaryDesc: "PDF / JPG — आय सत्यापन",
      bank: "बैंक विवरण",
      bankDesc: "PDF — 6 महीने का विवरण",
      kyc: "KYC सत्यापन",
      kycDesc: "प्रोफ़ाइल जाँच + आधार/पैन",
      uploadKyc: "आधार / पैन अपलोड करें",
      useSampleSalary: "नमूना वेतन पर्ची अपलोड करें",
      downloadSampleSalary: "नमूना PDF डाउनलोड करें",
      sampleLoadFail: "नमूना वेतन पर्ची लोड नहीं हो सकी।",
      salaryVerified: (amount: string, source?: string) =>
        `वेतन पर्ची सत्यापित हो गई। मासिक वेतन: ${amount}${source ? ` (${source})` : ""}। कृपया मेरा ऋण आवेदन आगे बढ़ाएँ।`,
      salaryReview: "वेतन दस्तावेज़ समीक्षा के लिए अपलोड हो गया। कृपया ऋण आवेदन जारी रखें।",
      salaryFail: "वेतन पर्ची सत्यापित नहीं हो सकी। कृपया पुनः प्रयास करें।",
      bankUploaded: (score?: number) =>
        `बैंक विवरण अपलोड हो गया।${score ? ` वित्तीय स्वास्थ्य स्कोर: ${score}/100.` : ""} कृपया विश्लेषण करके ऋण आवेदन जारी रखें।`,
      bankFail: "बैंक विवरण अपलोड विफल",
      kycDone: "KYC सत्यापन पूर्ण। स्थिति: सत्यापित। कृपया ऋण आवेदन और अंडरराइटिंग जारी रखें।",
      kycPending: "KYC लंबित — कृपया आधार या पैन दस्तावेज़ अपलोड करें।",
      kycFail: "KYC सत्यापन विफल",
      kycDoc: (status: string) =>
        `KYC दस्तावेज़ अपलोड हो गया। स्थिति: ${status}। कृपया KYC सत्यापित करके आवेदन जारी रखें।`,
      kycDocFail: "KYC दस्तावेज़ अपलोड विफल",
    },
  },
} as const;

export function assistantT(lang: AppLanguage) {
  return copy[lang];
}
