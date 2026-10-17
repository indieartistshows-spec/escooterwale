/* node automation/test-extract.js  : quick checks of the extractor */
const fs = require('fs'), assert = require('assert');
const X = require('./lib/extract');
const text = fs.readFileSync(__dirname + '/fixtures/sample-ola.txt', 'utf8');
const a = X.extractModel({ text }, { match: ['S1 X'], kwh: 3 });
assert.strictEqual(a.fields.price, 104999, 'S1 X 3 kWh price'); assert.strictEqual(a.fields.range, 176);
const b = X.extractModel({ text }, { match: ['S1 X+'], kwh: 4 });
assert.strictEqual(b.fields.price, 124999); assert.strictEqual(b.fields.boot, 34); assert.strictEqual(b.fields.weight, 112);
const c = X.extractModel({ text }, { match: ['S1 X'], kwh: 2 });
assert.strictEqual(c.fields.price, 89999); assert.strictEqual(c.fields.speed, 90);
const ld = X.extractModel({ text: '', jsonLd: [JSON.stringify({ '@type': 'Product', name: 'Ather 450X 3.7 kWh', offers: { price: '157999' } })] }, { match: ['450X'], kwh: 3.7 });
assert.strictEqual(ld.fields.price, 157999);
const cand = X.candidateModels(text, ['S1 X', 'S1 X+']);
assert(cand.some(m => m.name.includes('S1 Z')), 'new model S1 Z detected');
console.log('extract tests passed', JSON.stringify({ a: a.fields, b: b.fields, cand }));
