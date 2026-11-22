/* Keeping what classmates post safe for a general audience (Code 99's rules): explicit words and insults,
   in English and Filipino, are refused in class room messages, names and class names. Whole words only,
   so schoolwork such as "sexual reproduction", "class" or "Dickens" is never blocked. */
const WORDS = [
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'asshole', 'cunt', 'dick', 'dickhead', 'pussy',
  'porn', 'porno', 'nudes', 'slut', 'whore', 'retard', 'kys',
  'putangina', 'putang ina', 'tangina', 'tang ina', 'puta', 'gago', 'gaga', 'tarantado', 'ulol', 'kantot', 'kantutan',
  'pakyu', 'pakshet', 'hindot', 'puke', 'titi', 'burat', 'bobo', 'tanga',
];
const fold = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[@4]/g, 'a').replace(/[3]/g, 'e').replace(/[1!|]/g, 'i').replace(/[0]/g, 'o').replace(/[$5]/g, 's').replace(/(.)\1{2,}/g, '$1$1')
  .replace(/(?:^|(?<=[^a-z]))(?:[a-z][\s._*-]){2,}[a-z](?=$|[^a-z])/g, (m) => m.replace(/[\s._*-]/g, '')); // (f.u.c.k, g a g o)
const RE = new RegExp(`(^|[^a-z])(${WORDS.map((w) => w.replace(/ /g, '[\\s._-]*')).join('|')})(?=$|[^a-z])`, 'i');
export const unsafe = (...texts) => texts.some((t) => RE.test(fold(t)));
export const SAFE_MSG = 'Let’s keep the class room friendly for everyone. Try saying that another way.';
