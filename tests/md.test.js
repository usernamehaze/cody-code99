// node --test: tables the AI writes loosely still come out as one table (in the app, the PDF and the Word file)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tidyTables, blocks } from '../js/mdblocks.js';

test('a row that wrapped onto the next line, a blank line and a late |---| still make one table', () => {
  const src = '| Concept | Description |\n\n| OS | Manages hardware on one computer\nor device. |\n|---|---|\n| NOS | Manages computers on a network. |';
  const t = blocks(src).filter((b) => b.k === 'table');
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].head, ['Concept', 'Description']);
  assert.deepEqual(t[0].rows.map((r) => r[0]), ['OS', 'NOS']);
  assert.equal(t[0].rows[0][1], 'Manages hardware on one computer or device.');
});
test('a table with no |---| line gets one; text that only has a | stays text', () => {
  assert.equal(blocks('| A | B |\n| 1 | 2 |').filter((b) => b.k === 'table').length, 1);
  assert.equal(tidyTables('Price | 5 dollars'), 'Price | 5 dollars');
  assert.equal(blocks('| just one line |').filter((b) => b.k === 'table').length, 0);
});
