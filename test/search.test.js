import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog } from '../server/search/catalogSearch.js';

const ids = (q) => searchCatalog(q).map((p) => p.id);

test('קידומת חלקית בעברית', () => assert.equal(ids('אייפ')[0], 'iphone17pro-256'));
test('קידומת באנגלית, לא תלוי רישיות', () => assert.equal(ids('SONY WH')[0], 'sony-wh1000xm6'));
test('שגיאת כתיב קלה', () => assert.ok(ids('dysin').includes('dyson-v15')));
test('כמה מילים – כולן חייבות להתאים', () => assert.deepEqual(ids('אוזניות סוני'), ['sony-wh1000xm6']));
test('בלי גרש', () => assert.ok(ids('נינגה').includes('ninja-af500')));
test('שאילתה ריקה', () => assert.deepEqual(ids('   '), []));
