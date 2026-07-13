import crypto from 'crypto';
import { 
  Employee, 
  AssignmentRule, 
  AssignableType, 
  Assignment,
  RuleCondition,
  AttributeCondition,
  LocationCondition,
  TenureCondition,
  GroupCondition,
  ManualCondition
} from './types';

// Generic database interface definition matching standard pooling library wrappers
export interface IDatabase {
  query: <T = any>(text: string, params?: any[]) => Promise<T[]>;
}

/**
 * Derives fractional years of service relative to the target temporal execution context
 */
export function getTenureYears(hireDate: string): number {
  const hire = new Date(hireDate);
  const now = new Date();
  const diffInMs = now.getTime() - hire.getTime();
  return diffInMs / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Asserts engine execution viability across rule-variants against employee records
 */
export async function matchesRule(
  db: IDatabase, 
  employee: Employee, 
  rule: AssignmentRule
): Promise<boolean> {
  const cond = rule.condition;

  switch (rule.rule_type) {
    case 'attribute': {
      const attributeCond = cond as AttributeCondition;
      return Object.entries(attributeCond).every(([key, value]) => {
        const empValue = (employee as any)[key];
        return empValue === value;
      });
    }

    case 'location': {
      const locCond = cond as LocationCondition;
      if (locCond.work_state && locCond.work_state !== employee.work_state) return false;
      if (locCond.work_country && locCond.work_country !== employee.work_country) return false;
      return true;
    }

    case 'tenure': {
      const tenureCond = cond as TenureCondition;
      const actualTenure = getTenureYears(employee.hire_date);
      return actualTenure >= tenureCond.tenure_years_gte;
    }

    case 'group': {
      const groupCond = cond as GroupCondition;
      const rows = await db.query<{ count: string }>(
        `SELECT COUNT(*)::int as count 
         FROM group_memberships gm
         JOIN groups g ON gm.group_id = g.id
         WHERE gm.employee_id = $1 AND g.name = $2`,
        [employee.id, groupCond.group]
      );
      return Number(rows[0]?.count || 0) > 0;
    }

    case 'manual': {
      const manualCond = cond as ManualCondition;
      return manualCond.employee_id === employee.id;
    }

    default:
      return false;
  }
}

/**
 * Pulls, evaluates, and prioritizes rule variations applicable to target configurations
 */
export async function getCandidateRules(
  db: IDatabase, 
  employeeId: string, 
  assignableTypeId: string
): Promise<AssignmentRule[]> {
  const empRows = await db.query<Employee>('SELECT * FROM employees WHERE id = $1', [employeeId]);
  if (empRows.length === 0) throw new Error(`Employee ${employeeId} not found.`);
  const employee = empRows[0];

  const ruleRows = await db.query<AssignmentRule>(
    'SELECT * FROM assignment_rules WHERE assignable_type_id = $1 AND active = true',
    [assignableTypeId]
  );

  const matchedRules: AssignmentRule[] = [];
  for (const rule of ruleRows) {
    if (await matchesRule(db, employee, rule)) {
      matchedRules.push(rule);
    }
  }

  // Deterministic prioritization sorting: Higher priority wins. Tie-break via oldest creation timestamp.
  return matchedRules.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Reconciles engine assignments with backing system storage states
 */
export async function resolveAssignment(
  db: IDatabase, 
  employeeId: string, 
  assignableTypeId: string
): Promise<void> {
  const typeRows = await db.query<AssignableType>('SELECT * FROM assignable_types WHERE id = $1', [assignableTypeId]);
  if (typeRows.length === 0) throw new Error(`Assignable type ${assignableTypeId} not found.`);
  const { cardinality } = typeRows[0];

  const candidates = await getCandidateRules(db, employeeId, assignableTypeId);
  const todayStr = new Date().toISOString().split('T')[0];

  // Pull existing active assignments
  const currentActive = await db.query<Assignment>(
    'SELECT * FROM assignments WHERE employee_id = $1 AND assignable_type_id = $2 AND effective_to IS NULL',
    [employeeId, assignableTypeId]
  );

  if (cardinality === 'single') {
    const winningRule = candidates[0] || null;
    const targetAssignment = currentActive[0] || null;

    if (!winningRule) {
      // No active matches: close out pre-existing slots if active
      if (targetAssignment) {
        await db.query('UPDATE assignments SET effective_to = $1, updated_at = now() WHERE id = $2', [todayStr, targetAssignment.id]);
        await logAudit(db, targetAssignment.id, 'REMOVE', 'No matching rules remain.', null, candidates);
      }
      return;
    }

    // If target has drifted, invalidate the outdated match and provision the new entry
    if (!targetAssignment || targetAssignment.target_id !== winningRule.target_id) {
      if (targetAssignment) {
        await db.query('UPDATE assignments SET effective_to = $1, updated_at = now() WHERE id = $2', [todayStr, targetAssignment.id]);
        await logAudit(db, targetAssignment.id, 'SUPERSEDE', `Superseded by rule ${winningRule.id}`, winningRule.id, candidates);
      }

      const newAssignmentId = crypto.randomUUID();
      await db.query(
        `INSERT INTO assignments (id, employee_id, assignable_type_id, target_id, source, rule_id, effective_from, effective_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
        [newAssignmentId, employeeId, assignableTypeId, winningRule.target_id, winningRule.rule_type === 'manual' ? 'manual' : 'rule', winningRule.id, todayStr]
      );
      await logAudit(db, newAssignmentId, 'ADD', `Assigned via rule ${winningRule.id}`, winningRule.id, candidates);
    }
  } else {
    // Multi-cardinality resolution: compute target set and execute state diffing
    const targetToRuleMap = new Map<string, AssignmentRule>();
    candidates.forEach(rule => {
      if (!targetToRuleMap.has(rule.target_id)) {
        targetToRuleMap.set(rule.target_id, rule);
      }
    });

    const targetSet = new Set(targetToRuleMap.keys());
    const currentTargetMap = new Map<string, Assignment>(currentActive.map(a => [a.target_id, a]));

    // 1. Terminate dropped entries
    for (const [targetId, assignment] of currentTargetMap.entries()) {
      if (!targetSet.has(targetId)) {
        await db.query('UPDATE assignments SET effective_to = $1, updated_at = now() WHERE id = $2', [todayStr, assignment.id]);
        await logAudit(db, assignment.id, 'REMOVE', 'Condition requirements no longer satisfied.', null, candidates);
      }
    }

    // 2. Introduce untracked entries
    for (const targetId of targetSet.keys()) {
      if (!currentTargetMap.has(targetId)) {
        const winningRule = targetToRuleMap.get(targetId)!;
        const newAssignmentId = crypto.randomUUID();
        await db.query(
          `INSERT INTO assignments (id, employee_id, assignable_type_id, target_id, source, rule_id, effective_from, effective_to)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
          [newAssignmentId, employeeId, assignableTypeId, targetId, winningRule.rule_type === 'manual' ? 'manual' : 'rule', winningRule.id, todayStr]
        );
        await logAudit(db, newAssignmentId, 'ADD', `Multi-assignment addition via rule ${winningRule.id}`, winningRule.id, candidates);
      }
    }
  }
}

/**
 * Batches calculations across the entire company assignable registry for an individual employee
 */
export async function resolveAllForEmployee(db: IDatabase, employeeId: string): Promise<void> {
  const empRows = await db.query<Employee>('SELECT company_id FROM employees WHERE id = $1', [employeeId]);
  if (empRows.length === 0) return;
  const { company_id } = empRows[0];

  const types = await db.query<AssignableType>('SELECT id FROM assignable_types WHERE company_id = $1', [company_id]);
  for (const type of types) {
    await resolveAssignment(db, employeeId, type.id);
  }
}

/**
 * Writes records to the audit log tracking structural pipeline adjustments
 */
async function logAudit(
  db: IDatabase, 
  assignmentId: string, 
  action: 'ADD' | 'REMOVE' | 'SUPERSEDE', 
  reason: string,
  winningRuleId: string | null,
  allCandidates: AssignmentRule[]
): Promise<void> {
  const snapshot = {
    winning_rule_id: winningRuleId,
    losing_candidate_rule_ids: allCandidates.filter(c => c.id !== winningRuleId).map(c => c.id)
  };

  await db.query(
    `INSERT INTO assignment_audit_log (id, assignment_id, action, reason, rule_id, snapshot)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [crypto.randomUUID(), assignmentId, action, reason, winningRuleId, JSON.stringify(snapshot)]
  );
}