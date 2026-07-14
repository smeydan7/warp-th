const test = require('node:test');
const assert = require('node:assert/strict');
const { onEmployeeUpdated } = require('../src/events');

test('onEmployeeUpdated uses the correct ANY syntax for rule_type matching', async () => {
  const calls = [];
  const db = {
    async query(text, params) {
      calls.push({ text, params });
      return [];
    }
  };

  await onEmployeeUpdated(db, 'employee-1', ['department']);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /rule_type = ANY\(\$1\)/);
});
