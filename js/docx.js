/* Save a study guide as a real Word file (.docx), made on the device with no library.
   A .docx is a zip of a few XML files: the text (word/document.xml), the styles (headings, quotes),
   and a footer with page numbers. Word, Google Docs, Pages and WPS open it, and the student can edit it.
   Unlike the PDF, Word shows every alphabet, so Chinese, Japanese or Korean reviewers keep their letters. */
import { blocks, runs } from './mdblocks.js';

// ---- a tiny zip maker ("stored", no compression; Word reads it fine) ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) { // files: [[name, text]]
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  const head = (size) => { const b = new Uint8Array(size); return [b, new DataView(b.buffer)]; };
  for (const [name, text] of files) {
    const n = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const [lh, l] = head(30); l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(12, 0x21, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, n.length, true);
    const [ch, c] = head(46); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
    parts.push(lh, n, data); central.push(ch, n); offset += 30 + n.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const [eh, e] = head(22); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, eh], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---- Word's XML ----
const x = (t) => String(t).replace(/[^\x09\x0a\x0d\x20-퟿-�]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (r, extra = '') => `<w:r><w:rPr>${r.s === 'bold' ? '<w:b/>' : r.s === 'italic' ? '<w:i/>' : ''}${extra}</w:rPr><w:t xml:space="preserve">${x(r.t)}</w:t></w:r>`;
const para = (rs, { style, pPr = '', rPr = '' } = {}) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${pPr}</w:pPr>${rs.map((r) => run(r, rPr)).join('')}</w:p>`;
const plainRuns = (t) => runs(t);

function table(b) {
  const border = '<w:top w:val="single" w:sz="4" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:color="D1D5DB"/><w:insideH w:val="single" w:sz="4" w:color="D1D5DB"/><w:insideV w:val="single" w:sz="4" w:color="D1D5DB"/>';
  const cell = (t, i, headRow) => `<w:tc><w:tcPr>${headRow ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : ''}</w:tcPr>${para(plainRuns(t), { pPr: '<w:spacing w:before="40" w:after="40"/>', rPr: headRow || i === 0 ? '<w:b/>' : '' })}</w:tc>`;
  const row = (cells, headRow) => `<w:tr>${headRow ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map((t, i) => cell(t, i, headRow)).join('')}</w:tr>`;
  const cols = b.head.length;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${border}</w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${Math.round(9000 / cols)}"/>`).join('')}</w:tblGrid>
    ${row(b.head, true)}${b.rows.map((r) => row(Array.from({ length: cols }, (_, i) => r[i] || ''), false)).join('')}</w:tbl><w:p/>`;
}

function body(markdown) {
  return blocks(markdown).map((b) => {
    if (b.k === 'h1') return para(plainRuns(b.t), { style: 'Title' });
    if (b.k === 'h2') return para(plainRuns(b.t), { style: 'Heading1' });
    if (b.k === 'h3') return para(plainRuns(b.t), { style: 'Heading2' });
    if (b.k === 'p') return para(plainRuns(b.t));
    if (b.k === 'li') return para([{ t: b.mark + '\t', s: 'normal' }, ...plainRuns(b.t)], { pPr: '<w:tabs><w:tab w:val="left" w:pos="420"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="420" w:hanging="300"/>' });
    if (b.k === 'quote') return para(plainRuns(b.t), { style: 'Quote' });
    if (b.k === 'hr') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D1D5DB"/></w:pBdr></w:pPr></w:p>';
    if (b.k === 'code') return b.t.split('\n').map((l) => para([{ t: l, s: 'normal' }], { pPr: '<w:spacing w:after="0"/>', rPr: '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/>' })).join('');
    if (b.k === 'table') return table(b);
    return '';
  }).join('\n');
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:color w:val="111827"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="0F766E"/><w:sz w:val="25"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="0F766E"/></w:pBdr><w:ind w:left="240"/></w:pPr><w:rPr><w:color w:val="1F2937"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="4B5563"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;

export function guideDocx(markdown, label = 'Cody reviewer') {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>
${body(markdown)}
<w:sectPr><w:footerReference w:type="default" r:id="rFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="600" w:footer="500" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">${x(label)} · page </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> of </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`],
    ['word/document.xml', doc],
    ['word/styles.xml', STYLES],
    ['word/footer1.xml', footer],
  ]);
}

// hand the file to the student (a download on computers and Android, the Files / share sheet on iPhones)
export function download(blob, fileName) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const saveGuideDocx = (markdown, fileName) => download(guideDocx(markdown), fileName);
