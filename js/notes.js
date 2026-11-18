/* Reading the student's notes: a PDF (its text, read in the browser with pdf.js), a photo, or pasted text.
   A scanned PDF with no text, or a photo, is sent as a file for Gemini or Claude to read. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjs = null;
function loadPdfJs() {
  if (pdfjs) return pdfjs;
  pdfjs = new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { pdfjs = null; fail(new Error('Could not load the PDF reader. Check your connection.')); };
    document.head.appendChild(s);
  });
  return pdfjs;
}
const toBase64 = (file) => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => fail(r.error); r.readAsDataURL(file); });

// a photo from a phone is big: shrink it to 1600px on its long side before sending
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

// -> { name, pages, notes } (text) or { name, pages, file: { type, data } } (for the AI to read)
export async function readNotes(file) {
  const name = file.name || 'notes';
  if (/^image\//.test(file.type)) return { name, pages: 1, file: { type: 'image/jpeg', data: await shrinkImage(file) } };
  if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) {
    const lib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: buf.slice(0) }).promise;
    let text = '';
    for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
      const page = await doc.getPage(i);
      const c = await page.getTextContent();
      text += c.items.map((it) => it.str).join(' ') + '\n\n';
    }
    if (text.replace(/\s/g, '').length > 200) return { name, pages: doc.numPages, notes: text };
    if (file.size > 3.4 * 1024 * 1024) throw new Error('This PDF is a scan and too big to send. Try a photo of each page instead.');
    return { name, pages: doc.numPages, file: { type: 'application/pdf', data: await toBase64(file) } };
  }
  if (/^text\//.test(file.type) || /\.(txt|md)$/i.test(name)) return { name, pages: 1, notes: await file.text() };
  throw new Error('Cody reads PDFs, photos and text files.');
}
