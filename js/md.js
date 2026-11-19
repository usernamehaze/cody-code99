/* A small, safe markdown renderer for chat answers and study guides. Everything is escaped first; only
   these come back: # headings, **bold**, *italics*, `code`, code blocks, bulleted and numbered lists,
   tables (| a | b |), > quotes and --- dividers. */
import { esc } from './ui.js';

const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[\s(“"])\*([^*\s][^*]*?)\*(?=[\s).,!?:;”"]|$)/g, '$1<i>$2</i>');
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function md(src, { headings = 'h4' } = {}) {
  const out = [], lines = String(src || '').replace(/\r/g, '').split('\n');
  let list = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flush = () => { flushPara(); flushList(); };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) {
      flush();
      const code = []; while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue;
    }
    // a table: a | row, then a |---| row
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      flush();
      const head = cells(l); i++;
      const rows = []; while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(cells(lines[++i]));
      out.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    const ul = l.match(/^\s*[-*•]\s+(.*)/), ol = l.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { flush(); out.push('<hr>'); }
    else if (h) {
      flush();
      const tag = headings === 'doc' ? ['h2', 'h3', 'h4', 'h4'][h[1].length - 1] : 'h4';
      out.push(`<${tag}>${inline(h[2])}</${tag}>`);
    } else if (/^\s*>\s?/.test(l)) {
      flush();
      const q = [l.replace(/^\s*>\s?/, '')]; while (i + 1 < lines.length && /^\s*>\s?/.test(lines[i + 1])) q.push(lines[++i].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${q.map(inline).join('<br>')}</blockquote>`);
    } else if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(ul ? ul[1] : ol[2]);
    } else if (!l.trim()) flush();
    else { flushList(); para.push(l); }
  }
  flush();
  return out.join('');
}
