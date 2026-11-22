/* Reads the study guide's Markdown into blocks (headings, paragraphs, lists, tables, quotes, dividers, code)
   and runs of bold and italic text. Shared by the PDF and the Word file makers. */
// "a **b** *c*" -> [{t:'a ', s:'normal'}, {t:'b', s:'bold'}, {t:' ', s:'normal'}, {t:'c', s:'italic'}]
export function runs(text, clean = (x) => String(x)) {
  const out = []; const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*|`([^`]+)`/g; let last = 0, m;
  const t = clean(text);
  while ((m = re.exec(t))) { if (m.index > last) out.push({ t: t.slice(last, m.index), s: 'normal' }); out.push({ t: m[1] || m[2] || m[3], s: m[1] ? 'bold' : m[2] ? 'italic' : 'normal' }); last = re.lastIndex; }
  if (last < t.length) out.push({ t: t.slice(last), s: 'normal' });
  return out;
}
export function blocks(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n'), out = [];
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (/^```/.test(l)) { const c = []; while (++i < lines.length && !/^```/.test(lines[i])) c.push(lines[i]); out.push({ k: 'code', t: c.join('\n') }); continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) { const head = cells(l); i++; const rows = []; while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(cells(lines[++i])); out.push({ k: 'table', head, rows }); continue; }
    let m;
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) out.push({ k: 'hr' });
    else if ((m = l.match(/^(#{1,4})\s+(.*)/))) out.push({ k: 'h' + Math.min(3, m[1].length), t: m[2] });
    else if (/^\s*>\s?/.test(l)) { const q = [l.replace(/^\s*>\s?/, '')]; while (i + 1 < lines.length && /^\s*>\s?/.test(lines[i + 1])) q.push(lines[++i].replace(/^\s*>\s?/, '')); out.push({ k: 'quote', t: q.join(' ') }); }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) out.push({ k: 'li', mark: '•', t: m[1] });
    else if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)/))) out.push({ k: 'li', mark: m[1] + '.', t: m[2] });
    else { const p = [l]; while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|\s*[-*•]\s|\s*\d+[.)]\s|\s*>|\s*\||```|\s*-{3,})/.test(lines[i + 1])) p.push(lines[++i]); out.push({ k: 'p', t: p.join(' ') }); }
  }
  return out;
}

