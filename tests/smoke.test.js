const test = require('node:test');
const assert = require('node:assert');

test('config exposes expected defaults', () => {
  const config = require('../src/config');

  assert.ok(config);
  assert.strictEqual(typeof config.port, 'number');
  assert.strictEqual(typeof config.env, 'string');
});
