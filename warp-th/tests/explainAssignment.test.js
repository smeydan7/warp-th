const test = require('node:test');
const assert = require('node:assert/strict');
const { explainAssignment } = require('../src/resolver');

class MockDatabase {
  constructor() {
    this.assignments = [
      {
        id: 'a1',
        employee_id: 'e1',
        assignable_type_id: 't1',
        target_id: 'target-1',
        rule_id: 'rule-manual',
        effective_from: '2026-07-10',
        effective_to: null,
      },
    ];
    this.assignmentRules = [
      {
        id: 'rule-manual',
        assignable_type_id: 't1',
        rule_type: 'manual',
        condition: { employee_id: 'e1' },
        target_id: 'target-1',
        priority: 100,
        active: true,
        created_at: '2026-01-01',
      },
    ];
    this.assignmentAuditLog = [];
  }

  async query(text, params = []) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.startsWith('SELECT * FROM assignments')) {
      return this.assignments.filter((a) => a.employee_id === params[0] && a.assignable_type_id === params[1]);
    }
    if (cleaned.startsWith('SELECT * FROM assignment_rules WHERE id =')) {
      return this.assignmentRules.filter((rule) => rule.id === params[0]);
    }
    if (cleaned.startsWith('SELECT * FROM assignment_audit_log')) {
      return this.assignmentAuditLog.filter((entry) => entry.assignment_id === params[0]);
    }
    return [];
  }
}

test('explainAssignment returns the manual rule for the override case', async () => {
  const db = new MockDatabase();
  const result = await explainAssignment(db, 'e1', 't1', '2026-07-10');

  assert.ok(result);
  assert.equal(result.rule?.rule_type, 'manual');
  assert.equal(result.assignment.target_id, 'target-1');
});
