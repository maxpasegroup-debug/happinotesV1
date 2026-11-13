// The 22 languages in India's Eighth Schedule. English is available separately.
export const INDIAN_LANGUAGE_NAMES = {
  assamese: 'অসমীয়া', bengali: 'বাংলা', bodo: 'बड़ो', dogri: 'डोगरी',
  gujarati: 'ગુજરાતી', hindi: 'हिन्दी', kannada: 'ಕನ್ನಡ', kashmiri: 'کٲشُر',
  konkani: 'कोंकणी', maithili: 'मैथिली', malayalam: 'മലയാളം', manipuri: 'ꯃꯤꯇꯩꯂꯣꯟ',
  marathi: 'मराठी', nepali: 'नेपाली', odia: 'ଓଡ଼ିଆ', punjabi: 'ਪੰਜਾਬੀ',
  sanskrit: 'संस्कृतम्', santali: 'ᱥᱟᱱᱛᱟᱲᱤ', sindhi: 'سنڌي', tamil: 'தமிழ்',
  telugu: 'తెలుగు', urdu: 'اردو',
} as const;

export const LANGUAGE_SEARCH_ALIASES: Record<string, string> = {
  bengali: 'Bangla', bodo: 'Boro', kashmiri: 'Koshur', manipuri: 'Meitei Meiteilon',
  odia: 'Oriya', punjabi: 'Panjabi', santali: 'Santhali',
};

export const RTL_APP_LANGUAGES = new Set(['urdu', 'kashmiri', 'sindhi']);
