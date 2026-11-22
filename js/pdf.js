/* Save a study guide as a real PDF file (no print window, so it also works on iPhones, which block
   websites from opening the print dialog). Uses jsPDF and its table plugin, shipped in js/vendor/.
   Draws the same Markdown the guide shows: headings, paragraphs with bold and italics, lists,
   tables, quotes and dividers, on A4 paper with page numbers. */
import { blocks, runs as R } from './mdblocks.js';
let libs = null;
function load(src) { return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load the PDF maker.')); document.head.appendChild(s); }); }
const ready = () => libs || (libs = load('/js/vendor/jspdf.umd.min.js').then(() => load('/js/vendor/jspdf.plugin.autotable.min.js')).catch((e) => { libs = null; throw e; }));

// the PDF's built-in fonts only know Western characters: swap the rest for close equivalents
const SWAP = { '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '≠': '!=', '≈': '~', '≤': '<=', '≥': '>=', '‑': '-', '‐': '-', '−': '-', '×': 'x', '…': '...', '✓': 'v', '★': '*', '₂': '2', '₁': '1', '₃': '3', '²': '2', '³': '3', ' ': ' ', ' ': ' ' };
const tidy = (t) => String(t).replace(/[‐-‑−←-⇿≠≈≤≥×…✓★₀-₉²³  ]/g, (c) => SWAP[c] || '').replace(/[^\x00-\xff–—‘’“”•€]/g, '');
const runs = (text) => R(text, tidy);

export async function saveGuidePdf(markdown, fileName) {
  await ready();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 54, TEAL = [15, 118, 110], INK = [17, 24, 39], GREY = [75, 85, 99];
  let y = M;
  const room = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  // write runs of text that wrap inside [x, x + width]
  const write = (rs, { x = M, width = W - 2 * M, size = 11, lh = 1.5, color = INK, style } = {}) => {
    doc.setFontSize(size); doc.setTextColor(...color);
    const words = []; rs.forEach((r) => r.t.split(/(\s+)/).forEach((w) => { if (w) words.push({ t: w, s: style || r.s }); }));
    let line = [], lw = 0; const lines = [];
    const wOf = (w) => { doc.setFont('helvetica', w.s); return doc.getTextWidth(w.t); };
    words.forEach((w) => { const ww = wOf(w); if (lw + ww > width && line.length && w.t.trim()) { lines.push(line); line = []; lw = 0; if (!w.t.trim()) return; } if (!line.length && !w.t.trim()) return; line.push(w); lw += ww; });
    if (line.length) lines.push(line);
    const step = size * lh;
    lines.forEach((ln) => { room(step); let cx = x; ln.forEach((w) => { doc.setFont('helvetica', w.s); doc.text(w.t, cx, y + size); cx += doc.getTextWidth(w.t); }); y += step; });
  };
  for (const b of blocks(markdown)) {
    if (b.k === 'h1') { room(40); write(runs(b.t), { size: 21, lh: 1.25, style: 'bold' }); y += 6; }
    else if (b.k === 'h2') { y += 10; room(34); write(runs(b.t), { size: 15, lh: 1.3, style: 'bold' }); y += 4; }
    else if (b.k === 'h3') { y += 6; room(26); write(runs(b.t), { size: 12.5, lh: 1.3, style: 'bold', color: TEAL }); y += 2; }
    else if (b.k === 'p') { write(runs(b.t), { color: /^\*\(.*\)\*$|^\*[^*].*\*$/.test(b.t.trim()) ? GREY : INK }); y += 6; }
    else if (b.k === 'li') { room(16); doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(b.mark, M + 6, y + 11); write(runs(b.t), { x: M + 24, width: W - 2 * M - 24 }); y += 2; }
    else if (b.k === 'quote') { room(22); const top = y; write(runs(b.t), { x: M + 16, width: W - 2 * M - 22, color: [31, 41, 55] }); doc.setFillColor(...TEAL); doc.rect(M + 2, top + 2, 3, Math.max(14, y - top - 2), 'F'); y += 8; }
    else if (b.k === 'hr') { y += 8; room(10); doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 14; }
    else if (b.k === 'code') { doc.setFont('courier', 'normal'); doc.setFontSize(9.5); tidy(b.t).split('\n').forEach((ln) => { room(13); doc.text(ln, M + 8, y + 10); y += 13; }); y += 6; }
    else if (b.k === 'table') {
      const plain = (c) => tidy(c).replace(/\*\*|`/g, '').replace(/\*([^*]+)\*/g, '$1');
      doc.autoTable({ startY: y + 2, margin: { left: M, right: M }, head: [b.head.map(plain)], body: b.rows.map((r) => r.map(plain)), theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, textColor: INK, lineColor: [209, 213, 219], lineWidth: 0.6, valign: 'top' },
        headStyles: { fillColor: [243, 244, 246], textColor: INK, fontStyle: 'bold' }, columnStyles: { 0: { fontStyle: 'bold' } } });
      y = doc.lastAutoTable.finalY + 12;
    }
  }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(`Cody reviewer · page ${i} of ${n}`, W / 2, H - 26, { align: 'center' }); }
  doc.save(fileName);
}
