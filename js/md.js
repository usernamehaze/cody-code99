/* A small, safe markdown renderer for Cody's chat answers: everything is escaped first, then only
   these come back: headings, **bold**, *italics*, `code`, code blocks, and bulleted or numbered lists. */
import { esc } from './ui.js';

const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>');

export function md(src) {
  const out = [], lines = String(src || '').replace(/\r/g, '').split('\n');
  let list = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) {
      flushPara(); flushList();
      const code = []; while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue;
    }
    const h = l.match(/^#{1,4}\s+(.*)/);
    const ul = l.match(/^\s*[-*•]\s+(.*)/), ol = l.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (h) { flushPara(); flushList(); out.push(`<h4>${inline(h[1])}</h4>`); }
    else if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(ul ? ul[1] : ol[2]);
    } else if (!l.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(l); }
  }
  flushPara(); flushList();
  return out.join('');
}
