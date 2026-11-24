// node --test: getting a shared file from a drive, with a fake drive (no network)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileUrl, getFile } from '../api/drive.js';

const reply = (status, body = '', headers = {}) => new Response(status >= 300 && status < 400 ? null : body, { status, headers });

test('share links turn into download links', () => {
  assert.match(fileUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing').url, /drive\.usercontent\.google\.com\/download\?id=1AbCdEfGhIjKlMn/);
  assert.match(fileUrl('https://drive.google.com/open?id=1AbCdEfGhIjKlMn').url, /id=1AbCdEfGhIjKlMn/);
  assert.equal(fileUrl('https://docs.google.com/document/d/1AbCdEfGhIjKlMn/edit').url, 'https://docs.google.com/document/d/1AbCdEfGhIjKlMn/export?format=txt');
  assert.match(fileUrl('https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn/edit').url, /export\/txt$/);
  assert.match(fileUrl('https://www.dropbox.com/scl/fi/abc/notes.pdf?rlkey=x&dl=0').url, /dl=1/);
  assert.match(fileUrl('https://1drv.ms/b/s!AbCd').url, /^https:\/\/api\.onedrive\.com\/v1\.0\/shares\/u!/);
});

test('only drive sites are opened', () => {
  for (const bad of ['http://drive.google.com/file/d/1AbCdEfGhIjKlMn', 'https://example.com/a.pdf', 'https://169.254.169.254/', 'https://drive.google.com.evil.com/file/d/1AbCdEfGhIjKlMn', 'not a link'])
    assert.throws(() => fileUrl(bad), (e) => e.status === 400, bad);
  assert.throws(() => fileUrl('https://drive.google.com/drive/folders/'), /folder/);
});

test('a shared PDF comes back with its name', async () => {
  const seen = [];
  const f = await getFile('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view', async (url) => {
    seen.push(url);
    if (seen.length === 1) return reply(303, '', { location: 'https://doc-0s-1c.googleusercontent.com/x' });
    return reply(200, '%PDF-1.4 hello', { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="Cell Biology.pdf"' });
  });
  assert.equal(f.name, 'Cell Biology.pdf'); assert.equal(f.type, 'application/pdf');
  assert.equal(Buffer.from(f.data, 'base64').toString(), '%PDF-1.4 hello');
  assert.equal(seen.length, 2);
});

test('a Google Doc comes back as text', async () => {
  const f = await getFile('https://docs.google.com/document/d/1AbCdEfGhIjKlMn/edit', async () => reply(200, 'The heart has four chambers.', { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': 'attachment; filename="The Heart.txt"' }));
  assert.equal(f.type, 'text/plain'); assert.equal(f.name, 'The Heart.txt');
});

test('private files, sign-in pages and odd redirects give a clear message', async () => {
  const toSignIn = async () => reply(302, '', { location: 'https://accounts.google.com/ServiceLogin?x' });
  await assert.rejects(getFile('https://docs.google.com/document/d/1AbCdEfGhIjKlMn/edit', toSignIn), /Anyone with the link/);
  const page = async () => reply(200, '<html>sign in</html>', { 'content-type': 'text/html' });
  await assert.rejects(getFile('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view', page), /Anyone with the link/);
  const away = async () => reply(302, '', { location: 'http://10.0.0.1/secret' });
  await assert.rejects(getFile('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view', away), /can’t open/);
  const word = async () => reply(200, 'PK', { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': 'attachment; filename="a.docx"' });
  await assert.rejects(getFile('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view', word), /Google Docs first/);
  const huge = async () => reply(200, 'x', { 'content-type': 'application/pdf', 'content-length': String(9e6) });
  await assert.rejects(getFile('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view', huge), /3 MB/);
});
