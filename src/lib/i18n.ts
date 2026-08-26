export type Lang = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'ml';

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    home: 'Home', profile: 'Patient Profile', meds: 'Medication Management',
    prescription: 'Prescription History', food: 'Food & Interactions',
    adr: 'Symptoms & Safety Reports', settings: 'Settings',
    monitor: 'Medication Monitoring', interactions: 'Food & Interaction Monitoring',
    insights: 'AI Clinical Insights', dashboard: 'Dashboard',
    dosing: 'Dosing Calendar', logout: 'Log out',
    guidance: 'Food & Administration Guidance',
  },
  hi: {
    home: 'होम', profile: 'मरीज़ प्रोफ़ाइल', meds: 'दवा प्रबंधन',
    prescription: 'प्रिस्क्रिप्शन इतिहास', food: 'भोजन और इंटरैक्शन',
    adr: 'लक्षण और सुरक्षा रिपोर्ट', settings: 'सेटिंग्स',
    monitor: 'दवा निगरानी', interactions: 'भोजन और इंटरैक्शन निगरानी',
    insights: 'AI क्लिनिकल अंतर्दृष्टि', dashboard: 'डैशबोर्ड',
    dosing: 'दवा कैलेंडर', logout: 'लॉग आउट',
    guidance: 'भोजन और प्रशासन मार्गदर्शन',
  },
  kn: {
    home: 'ಮುಖಪುಟ', profile: 'ರೋಗಿ ಪ್ರೊಫೈಲ್', meds: 'ಔಷಧಿ ನಿರ್ವಹಣೆ',
    prescription: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಇತಿಹಾಸ', food: 'ಆಹಾರ ಮತ್ತು ಇಂಟರಾಕ್ಷನ್',
    adr: 'ಲಕ್ಷಣಗಳು ಮತ್ತು ಸುರಕ್ಷತಾ ವರದಿಗಳು', settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    monitor: 'ಔಷಧಿ ಮೇಲ್ವಿಚಾರಣೆ', interactions: 'ಆಹಾರ ಮತ್ತು ಇಂಟರಾಕ್ಷನ್ ಮೇಲ್ವಿಚಾರಣೆ',
    insights: 'AI ಕ್ಲಿನಿಕಲ್ ಒಳನೋಟಗಳು', dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    dosing: 'ಡೋಸಿಂಗ್ ಕ್ಯಾಲೆಂಡರ್', logout: 'ಲಾಗ್ ಔಟ್',
    guidance: 'ಆಹಾರ ಮತ್ತು ಔಷಧಿ ಸೇವನೆ ಮಾರ್ಗದರ್ಶನ',
  },
  ta: {
    home: 'முகப்பு', profile: 'நோயாளர் சுயவிவரம்', meds: 'மருந்து மேலாண்மை',
    prescription: 'மருந்துச்சீட்டு வரலாறு', food: 'உணவு மற்றும் தொடர்புகள்',
    adr: 'அறிகுறிகள் மற்றும் பாதுகாப்பு அறிக்கைகள்', settings: 'அமைப்புகள்',
    monitor: 'மருந்து கண்காணிப்பு', interactions: 'உணவு மற்றும் தொடர்பு கண்காணிப்பு',
    insights: 'AI மருத்துவ தகவல்கள்', dashboard: 'டாஷ்போர்டு',
    dosing: 'மருந்து காலண்டர்', logout: 'வெளியேறு',
    guidance: 'உணவு மற்றும் மருந்து எடுத்துக்கொள்ளும் வழிகாட்டுதல்',
  },
  te: {
    home: 'హోమ్', profile: 'రోగి ప్రొఫైల్', meds: 'మందుల నిర్వహణ',
    prescription: 'ప్రిస్క్రిప్షన్ చరిత్ర', food: 'ఆహారం మరియు పరస్పర చర్యలు',
    adr: 'లక్షణాలు మరియు భద్రతా నివేదికలు', settings: 'సెట్టింగ్స్',
    monitor: 'మందుల పర్యవేక్షణ', interactions: 'ఆహారం & పరస్పర చర్యల పర్యవేక్షణ',
    insights: 'AI క్లినికల్ సమాచారం', dashboard: 'డ్యాష్‌బోర్డ్',
    dosing: 'డోసింగ్ క్యాలెండర్', logout: 'లాగ్ అవుట్',
    guidance: 'ఆహారం మరియు మందుల వినియోగ మార్గదర్శకం',
  },
  ml: {
    home: 'ഹോം', profile: 'രോഗി പ്രൊഫൈൽ', meds: 'മരുന്ന് മാനേജ്മെന്റ്',
    prescription: 'പ്രിസ്ക്രിപ്ഷൻ ചരിത്രം', food: 'ഭക്ഷണവും ഇടപെടലുകളും',
    adr: 'ലക്ഷണങ്ങളും സുരക്ഷാ റിപ്പോർട്ടുകളും', settings: 'ക്രമീകരണങ്ങൾ',
    monitor: 'മരുന്ന് നിരീക്ഷണം', interactions: 'ഭക്ഷണം & ഇടപെടൽ നിരീക്ഷണം',
    insights: 'AI ക്ലിനിക്കൽ വിവരങ്ങൾ', dashboard: 'ഡാഷ്ബോർഡ്',
    dosing: 'ഡോസിംഗ് കലണ്ടർ', logout: 'ലോഗ് ഔട്ട്',
    guidance: 'ഭക്ഷണവും മരുന്ന് ഉപയോഗ മാർഗ്ഗനിർദ്ദേശവും',
  },
};

export function t(lang: Lang, key: string): string {
  return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
}

export const languageOptions: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'kn', label: 'ಕನ್ನಡ' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'te', label: 'తెలుగు' },
  { value: 'ml', label: 'മലയാളം' },
];
