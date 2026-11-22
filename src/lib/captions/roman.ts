/**
 * Offline Roman Urdu transliteration.
 *
 * The AI romaniser (`/api/romanize`) is the main path. This module is the
 * safety net used when no language model answers: it turns Urdu (Nastaliq) or
 * Devanagari tokens into the Roman Urdu spelling Pakistani creators type, using
 * a dictionary of everyday words first and letter rules after that.
 * Shared by the server route and the browser.
 */

const URDU_RANGE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

export function hasUrduScript(text: string): boolean {
  return URDU_RANGE.test(text);
}

export function hasDevanagari(text: string): boolean {
  return DEVANAGARI_RANGE.test(text);
}

export function needsRomanizing(text: string): boolean {
  return hasUrduScript(text) || hasDevanagari(text);
}

// Everyday words → the spelling people actually type.
const URDU_WORDS: Record<string, string> = {
  "ہے": "hai", "ہیں": "hain", "ہوں": "hoon", "ہو": "ho", "تھا": "tha", "تھی": "thi", "تھے": "thay",
  "گا": "ga", "گی": "gi", "گے": "ge", "کیا": "kya", "کیوں": "kyun", "کیسے": "kaise", "کیسا": "kaisa",
  "کیسی": "kaisi", "کون": "kaun", "کب": "kab", "کہاں": "kahan", "کتنا": "kitna", "کتنی": "kitni",
  "کتنے": "kitne", "نہیں": "nahi", "نا": "na", "نہ": "na", "ہاں": "haan", "جی": "ji", "میں": "mein",
  "آپ": "aap", "ہم": "hum", "تم": "tum", "تو": "to", "وہ": "woh", "یہ": "yeh", "اس": "is", "اُس": "us",
  "ان": "in", "اُن": "un", "جو": "jo", "جس": "jis", "جب": "jab", "تب": "tab", "اب": "ab", "پھر": "phir",
  "بھی": "bhi", "ہی": "hi", "صرف": "sirf", "بہت": "bohat", "بہُت": "bohat", "زیادہ": "zyada", "کم": "kam",
  "اور": "aur", "یا": "ya", "لیکن": "lekin", "مگر": "magar", "کہ": "ke", "کے": "ke", "کی": "ki", "کا": "ka",
  "کو": "ko", "سے": "se", "پر": "par", "تک": "tak", "لیے": "liye", "لئے": "liye", "ساتھ": "saath",
  "بعد": "baad", "پہلے": "pehle", "اندر": "andar", "باہر": "bahar", "اوپر": "upar", "نیچے": "neeche",
  "اچھا": "acha", "اچھی": "achi", "اچھے": "ache", "ٹھیک": "theek", "بالکل": "bilkul", "ضرور": "zaroor",
  "شکریہ": "shukriya", "السلام": "Assalam", "علیکم": "Alaikum", "اللہ": "Allah", "انشاءاللہ": "InshaAllah",
  "ماشاءاللہ": "MashaAllah", "بھائی": "bhai", "یار": "yaar", "دوستو": "dosto", "دوست": "dost",
  "کر": "kar", "کرنا": "karna", "کرتا": "karta", "کرتی": "karti", "کرتے": "karte", "کریں": "karein",
  "کرو": "karo", "کرے": "kare", "گیا": "gaya", "گئی": "gayi", "گئے": "gaye", "ہوا": "hua", "ہوئی": "hui",
  "ہوئے": "hue", "دیا": "diya", "دی": "di", "دے": "de", "دیں": "dein", "لیا": "liya", "لے": "le", "لو": "lo",
  "جا": "ja", "جاتا": "jata", "جاتی": "jati", "جاتے": "jate", "جائے": "jaye", "جائیں": "jayen", "آ": "aa",
  "آتا": "aata", "آتی": "aati", "آئے": "aaye", "آیا": "aaya", "دیکھو": "dekho", "دیکھیں": "dekhein",
  "دیکھا": "dekha", "دیکھ": "dekh", "بتا": "bata", "بتاؤں": "bataun", "بتاتا": "batata", "بتاتی": "batati",
  "بول": "bol", "بولا": "bola", "سکتا": "sakta", "سکتی": "sakti", "سکتے": "sakte", "چاہیے": "chahiye",
  "رہا": "raha", "رہی": "rahi", "رہے": "rahe", "ہوتا": "hota", "ہوتی": "hoti", "ہوتے": "hote", "ہوگا": "hoga",
  "ہوگی": "hogi", "ہونا": "hona", "آج": "aaj", "کل": "kal", "دن": "din", "رات": "raat", "وقت": "waqt",
  "سال": "saal", "لوگ": "log", "لوگوں": "logon", "بات": "baat", "باتیں": "baatein", "کام": "kaam",
  "پیسے": "paise", "پیسہ": "paisa", "گھر": "ghar", "دنیا": "duniya", "زندگی": "zindagi", "پاکستان": "Pakistan",
  "کراچی": "Karachi", "لاہور": "Lahore", "اسلام آباد": "Islamabad", "ویڈیو": "video", "ویڈیوز": "videos",
  "چینل": "channel", "سبسکرائب": "subscribe", "لائک": "like", "شیئر": "share", "کمنٹ": "comment",
  "فون": "phone", "بزنس": "business", "مارکیٹنگ": "marketing", "سوشل": "social", "میڈیا": "media",
  "انسٹاگرام": "Instagram", "یوٹیوب": "YouTube", "ٹک": "Tik", "ٹاک": "Tok", "فیس": "face", "بک": "book",
  "پروڈکٹ": "product", "آفر": "offer", "ڈسکاؤنٹ": "discount", "ایک": "ek", "دو": "do", "تین": "teen",
  "چار": "chaar", "پانچ": "paanch", "چھ": "chhe", "سات": "saat", "آٹھ": "aath", "نو": "nau", "دس": "das",
  "سو": "sau", "ہزار": "hazaar", "لاکھ": "lakh", "میرا": "mera", "میری": "meri", "میرے": "mere",
  "تیرا": "tera", "تیری": "teri", "ہمارا": "hamara", "ہماری": "hamari", "ہمارے": "hamare", "آپکا": "aapka",
  "آپکی": "aapki", "آپکے": "aapke", "اپنا": "apna", "اپنی": "apni", "اپنے": "apne", "سب": "sab",
  "کچھ": "kuch", "کوئی": "koi", "ہر": "har", "بس": "bas", "ابھی": "abhi", "یہاں": "yahan", "وہاں": "wahan",
  "ایسا": "aisa", "ایسے": "aise", "ایسی": "aisi", "ویسے": "waise", "جیسے": "jaise", "کیونکہ": "kyunke",
  "اگر": "agar", "تاکہ": "taake", "پتا": "pata", "پتہ": "pata", "مجھے": "mujhe", "تمہیں": "tumhein",
  "انہیں": "unhein", "انہوں": "unhon", "اسے": "isay", "اسکو": "isko", "اسکا": "iska", "اسکی": "iski",
  "سمجھ": "samajh", "سمجھو": "samjho", "چلو": "chalo", "چل": "chal", "اٹھو": "utho", "سنو": "suno",
  "سن": "sun", "دل": "dil", "پیار": "pyaar", "خوش": "khush", "خوشی": "khushi", "مسئلہ": "masla",
  "مسئلے": "masle", "حل": "hal", "طریقہ": "tareeqa", "بہترین": "behtareen", "زبردست": "zabardast",
  "شروع": "shuru", "ختم": "khatam", "پورا": "poora", "پوری": "poori", "نیا": "naya", "نئی": "nayi",
  "نئے": "naye", "پرانا": "purana", "بڑا": "bara", "بڑی": "bari", "چھوٹا": "chota", "چھوٹی": "choti",
  "اصل": "asal", "میں نے": "maine", "ہمیں": "humein", "آپ کو": "aapko", "واقعی": "waqai", "ٹائم": "time",
  "آئیڈیا": "idea", "ٹپ": "tip", "ٹپس": "tips", "سٹیپ": "step", "فری": "free", "پرو": "pro",
};

const URDU_LETTERS: Record<string, string> = {
  "ا": "a", "آ": "aa", "أ": "a", "إ": "i", "ب": "b", "پ": "p", "ت": "t", "ٹ": "t", "ث": "s", "ج": "j",
  "چ": "ch", "ح": "h", "خ": "kh", "د": "d", "ڈ": "d", "ذ": "z", "ر": "r", "ڑ": "r", "ز": "z", "ژ": "zh",
  "س": "s", "ش": "sh", "ص": "s", "ض": "z", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q",
  "ک": "k", "ك": "k", "گ": "g", "ل": "l", "م": "m", "ن": "n", "ں": "n", "و": "o", "ؤ": "o", "ہ": "h",
  "ة": "a", "ھ": "h", "ء": "", "ئ": "i", "ی": "i", "ي": "i", "ى": "a", "ے": "e", "ۓ": "e",
  "َ": "a", "ِ": "i", "ُ": "u", "ً": "an", "ٍ": "in", "ٌ": "un", "ْ": "", "ٰ": "a",
  "۔": ".", "،": ",", "؟": "?", "؛": ";", "٪": "%",
};

const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function urduWord(token: string): string {
  const bare = token.replace(/[۔،؟!.,?!:"'()]/g, "");
  const lead = token.match(/^[("']+/)?.[0] ?? "";
  const tail = (token.slice(lead.length + bare.length) || "").replace(/۔/g, ".").replace(/،/g, ",").replace(/؟/g, "?");
  const known = URDU_WORDS[bare];
  if (known) return lead + known + tail;
  let out = "";
  const chars = Array.from(bare);
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = chars[index + 1];
    const first = index === 0;
    const last = index === chars.length - 1;
    const digit = URDU_DIGITS.indexOf(char) >= 0 ? URDU_DIGITS.indexOf(char) : ARABIC_DIGITS.indexOf(char);
    if (digit >= 0) {
      out += String(digit);
      continue;
    }
    if (char === "ّ") {
      const prev = out.slice(-1);
      if (prev && /[bcdfghjklmnpqrstvwxyz]/.test(prev)) out += prev;
      continue;
    }
    if (char === "و") {
      out += first ? "w" : next === "ا" ? "w" : "o";
      continue;
    }
    if (char === "ی" || char === "ي") {
      out += first ? "y" : last ? "i" : next === "ا" || next === "و" ? "y" : "ai";
      continue;
    }
    if (char === "ہ") {
      out += last && !first ? "a" : "h";
      continue;
    }
    if (char === "ھ") {
      out += "h";
      continue;
    }
    if (char === "ا") {
      out += first ? "a" : "aa";
      continue;
    }
    out += URDU_LETTERS[char] ?? (/[a-z0-9]/i.test(char) ? char : "");
  }
  out = out
    .replace(/aaa+/g, "aa")
    .replace(/aa$/, "a")
    .replace(/^([bcdfghjklmnpqrstvwxyz])([bcdfghjklmnpqrstvwxyz])([aeiou])/, "$1a$2$3");
  return lead + (out || bare) + tail;
}

// ---------- Devanagari ----------

const DEVA_WORDS: Record<string, string> = {
  "है": "hai", "हैं": "hain", "क्या": "kya", "नहीं": "nahi", "में": "mein", "मैं": "main", "आप": "aap",
  "हम": "hum", "तुम": "tum", "यह": "yeh", "ये": "ye", "वह": "woh", "वो": "woh", "और": "aur", "के": "ke",
  "की": "ki", "का": "ka", "को": "ko", "से": "se", "पर": "par", "भी": "bhi", "तो": "to", "ही": "hi",
  "था": "tha", "थी": "thi", "थे": "thay", "हो": "ho", "कर": "kar", "रहा": "raha", "रही": "rahi",
  "रहे": "rahe", "गया": "gaya", "गई": "gayi", "गए": "gaye", "बहुत": "bohat", "अच्छा": "acha",
  "ठीक": "theek", "यार": "yaar", "भाई": "bhai", "आज": "aaj", "कल": "kal", "सब": "sab", "कुछ": "kuch",
  "कोई": "koi", "जो": "jo", "जब": "jab", "अब": "ab", "फिर": "phir", "लेकिन": "lekin", "क्योंकि": "kyunke",
  "अगर": "agar", "वीडियो": "video", "चैनल": "channel", "सब्सक्राइब": "subscribe", "लाइक": "like",
  "शेयर": "share", "कमेंट": "comment", "फ़ोन": "phone", "फोन": "phone", "बिज़नेस": "business",
  "मुझे": "mujhe", "हमें": "humein", "आपको": "aapko", "मेरा": "mera", "मेरी": "meri", "मेरे": "mere",
  "अपना": "apna", "अपनी": "apni", "अपने": "apne", "करना": "karna", "करो": "karo", "करें": "karein",
  "देखो": "dekho", "देखें": "dekhein", "हाँ": "haan", "हां": "haan", "जी": "ji", "लोग": "log",
  "बात": "baat", "काम": "kaam", "पैसे": "paise", "ज़िंदगी": "zindagi", "जिंदगी": "zindagi", "दुनिया": "duniya",
  "शुक्रिया": "shukriya", "ज़रूर": "zaroor", "जरूर": "zaroor", "बिल्कुल": "bilkul", "एक": "ek", "दो": "do",
  "तीन": "teen", "चार": "chaar", "पांच": "paanch", "पाँच": "paanch", "सकता": "sakta", "सकते": "sakte",
  "सकती": "sakti", "चाहिए": "chahiye", "होता": "hota", "होती": "hoti", "होते": "hote", "होगा": "hoga",
  "ऐसा": "aisa", "ऐसे": "aise", "वैसे": "waise", "जैसे": "jaise", "यहाँ": "yahan", "यहां": "yahan",
  "वहाँ": "wahan", "वहां": "wahan", "अभी": "abhi", "बस": "bas", "सिर्फ": "sirf", "सिर्फ़": "sirf",
  "ज़्यादा": "zyada", "ज्यादा": "zyada", "कम": "kam", "पता": "pata", "दिल": "dil", "प्यार": "pyaar",
};

const DEVA_VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "ऋ": "ri", "ऍ": "e", "ऑ": "o",
};
const DEVA_MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ृ": "ri",
  "ॅ": "e", "ॉ": "o",
};
const DEVA_CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
};
const NUKTA: Record<string, string> = { "क": "q", "ख": "kh", "ग": "gh", "ज": "z", "ड": "r", "ढ": "rh", "फ": "f" };

type Syl = { c: string; v: string | null; schwa: boolean };

function devaWord(token: string): string {
  const bare = token.replace(/[।॥.,?!:"'()]/g, "");
  const tail = token.slice(bare.length).replace(/।/g, ".");
  const known = DEVA_WORDS[bare];
  if (known) return known + tail;
  const chars = Array.from(bare.normalize("NFC"));
  const syls: Syl[] = [];
  let out = "";
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = chars[index + 1];
    if (DEVA_CONSONANTS[char] !== undefined) {
      let c = DEVA_CONSONANTS[char];
      if (next === "़") {
        c = NUKTA[char] ?? c;
        index += 1;
      }
      syls.push({ c, v: null, schwa: true });
      continue;
    }
    const last = syls[syls.length - 1];
    if (DEVA_MATRAS[char] !== undefined && last) {
      last.v = DEVA_MATRAS[char];
      last.schwa = false;
      continue;
    }
    if (char === "्" && last) {
      last.schwa = false;
      last.v = "";
      continue;
    }
    if (DEVA_VOWELS[char] !== undefined) {
      syls.push({ c: "", v: DEVA_VOWELS[char], schwa: false });
      continue;
    }
    if ((char === "ं" || char === "ँ") && last) {
      last.v = `${last.schwa ? "a" : last.v ?? ""}n`;
      last.schwa = false;
      continue;
    }
    if (char === "ः" && last) {
      last.v = `${last.v ?? "a"}h`;
      last.schwa = false;
      continue;
    }
    const digit = "०१२३४५६७८९".indexOf(char);
    if (digit >= 0) syls.push({ c: String(digit), v: "", schwa: false });
  }
  // Schwa deletion: drop the final schwa, then VC(a)CV medial schwas.
  const final = syls[syls.length - 1];
  if (syls.length > 1 && final?.schwa) {
    final.schwa = false;
    final.v = "";
  }
  for (let index = syls.length - 2; index >= 1; index -= 1) {
    const here = syls[index];
    const prev = syls[index - 1];
    const next = syls[index + 1];
    if (here.schwa && here.c && next.c && (next.v || next.schwa) && (prev.v || prev.schwa)) {
      here.schwa = false;
      here.v = "";
    }
  }
  for (const syl of syls) out += syl.c + (syl.schwa ? "a" : syl.v ?? "");
  out = out.replace(/ee$/, "i").replace(/aa$/, "a").replace(/oo$/, "u").replace(/v/g, "w");
  return out + tail;
}

/** Long words read better with single vowels ("banaani" → "banani"). */
function casual(word: string): string {
  const match = word.match(/^([^a-z]*)([a-z]+)(.*)$/i);
  if (!match) return word;
  const [, lead, core, tail] = match;
  if (core.length <= 5 || /[A-Z]/.test(core)) return word;
  const head = core.slice(0, 2);
  const body = core
    .slice(2)
    .replace(/aa/g, "a")
    .replace(/oo(?=[a-z])/g, "u")
    .replace(/ee(?=[a-z])/g, "i")
    .replace(/ao/g, "a");
  return lead + head + body + tail;
}

/** Romanise one token. Latin text passes through untouched. */
export function romanizeToken(token: string): string {
  if (hasUrduScript(token)) {
    const bare = token.replace(/[۔،؟!.,?!:"'()]/g, "");
    return URDU_WORDS[bare] ? urduWord(token) : casual(urduWord(token));
  }
  if (hasDevanagari(token)) {
    const bare = token.replace(/[।॥.,?!:"'()]/g, "");
    return DEVA_WORDS[bare] ? devaWord(token) : casual(devaWord(token));
  }
  return token;
}

/** Romanise a list of tokens, keeping the count and order. */
export function romanizeTokens(tokens: string[]): string[] {
  return tokens.map((token) => {
    const out = romanizeToken(token.trim());
    return out || token;
  });
}
