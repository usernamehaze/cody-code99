/* Make it yours (Premium): an accent colour and a background, previewed live and kept only when saved
   (like Cassie's Appearance). Every colour in Cody comes from these CSS variables. */
export const ACCENTS = {
  teal: ['Teal', '#2dd4bf', '#062a2a', '#1d6b6a'], pink: ['Pink', '#f472b6', '#3b0a25', '#8a2f63'], violet: ['Violet', '#a78bfa', '#1e1240', '#5b4a9e'],
  sky: ['Sky', '#60a5fa', '#0a1f3d', '#2f5b94'], amber: ['Sunny', '#fbbf24', '#2a1d00', '#8a6a12'], lime: ['Lime', '#a3e635', '#1a2a00', '#5b7d1f'],
};
export const BACKS = {
  navy: ['Navy', '#0e1626', '#152039', '#1c2a48', '#24324f', '#2c3c5e'], midnight: ['Midnight', '#0b0b0f', '#15151b', '#1e1e26', '#27272f', '#32323c'],
  forest: ['Forest', '#0b1a16', '#122520', '#1a3129', '#223b33', '#2c473e'], plum: ['Plum', '#140e1e', '#1e162e', '#2a1f40', '#33284d', '#3e3159'],
};
export function apply(theme) {
  const t = theme || {}, a = ACCENTS[t.accent] || ACCENTS.teal, b = BACKS[t.back] || BACKS.navy, st = document.documentElement.style;
  st.setProperty('--teal', a[1]); st.setProperty('--teal-ink', a[2]); st.setProperty('--teal-dim', a[3]);
  st.setProperty('--bg', b[1]); st.setProperty('--side', b[2]); st.setProperty('--card', b[2]); st.setProperty('--raised', b[3]); st.setProperty('--line', b[4]); st.setProperty('--line-2', b[5]);
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = b[1];
}
