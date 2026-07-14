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

export interface IDatabase {
  query: <T = any>(text: string, params?: any[]) => Promise<T[]>;
}

export function getTenureYears(hireDate: string, asOfDate: string = new Date().toISOString().split('T')[0]): number {
  const hire = new Date(hireDate);
  const ref = new Date(asOfDate);
  const diffInMs = ref.getTime() - hire.getTime();
  return diffInMs / (1000 * 60 * 60 * 24 * 365.25);
}

export async function matchesRule(
  db: IDatabase, 
  employee: Employee, 
  rule: AssignmentRule,
  asOfDate: string = new Date().toISOString().split('T')[0]
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
      const actualTenure = getTenureYears(employee.hire_date, asOfDate);
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

export async function getCandidateRules(
  db: IDatabase, 
  employeeId: string, 
  assignableTypeId: string,
  asOfDate: string = new Date().toISOString().split('T')[0]
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
    if (await matchesRule(db, employee, rule, asOfDate)) {
      matchedRules.push(rule);
    }
  }

  return matchedRules.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export async function resolveAssignment(
  db: IDatabase, 
  employeeId: string, 
  assignableTypeId: string,
  asOfDate: string = new Date().toISOString().split('T')[0]
): Promise<void> {
  const typeRows = await db.query<AssignableType>('SELECT * FROM assignable_types WHERE id = $1', [assignableTypeId]);
  if (typeRows.length === 0) throw new Error(`Assignable type ${assignableTypeId} not found.`);
  const { cardinality } = typeRows[0];

  const candidates = await getCandidateRules(db, employeeId, assignableTypeId, asOfDate);
  const todayStr = asOfDate;

  const currentActive = await db.query<Assignment>(
    'SELECT * FROM assignments WHERE employee_id = $1 AND assignable_type_id = $2 AND effective_to IS NULL',
    [employeeId, assignableTypeId]
  );

  if (cardinality === 'single') {
    const winningRule = candidates[0] || null;
    const targetAssignment = currentActive[0] || null;

    if (!winningRule) {
      if (targetAssignment) {
        await db.query('UPDATE assignments SET effective_to = $1, updated_at = now() WHERE id = $2', [todayStr, targetAssignment.id]);
        await logAudit(db, targetAssignment.id, 'REMOVE', 'No matching rules remain.', null, candidates);
      }
      return;
    }

    if (targetAssignment && targetAssignment.target_id === winningRule.target_id) {
      return;
    }

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

  } else {
    const targetToRuleMap = new Map<string, AssignmentRule>();
    candidates.forEach(rule => {
      if (!targetToRuleMap.has(rule.target_id)) {
        targetToRuleMap.set(rule.target_id, rule);
      }
    });

    const targetSet = new Set(targetToRuleMap.keys());
    const currentTargetMap = new Map<string, Assignment>(currentActive.map(a => [a.target_id, a]));

    for (const [targetId, assignment] of currentTargetMap.entries()) {
      if (!targetSet.has(targetId)) {
        await db.query('UPDATE assignments SET effective_to = $1, updated_at = now() WHERE id = $2', [todayStr, assignment.id]);
        await logAudit(db, assignment.id, 'REMOVE', 'Condition requirements no longer satisfied.', null, candidates);
      }
    }

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

export async function resolveAllForEmployee(
  db: IDatabase, 
  employeeId: string,
  asOfDate: string = new Date().toISOString().split('T')[0]
): Promise<void> {
  const empRows = await db.query<Employee>('SELECT company_id FROM employees WHERE id = $1', [employeeId]);
  if (empRows.length === 0) return;
  const { company_id } = empRows[0];

  const types = await db.query<AssignableType>('SELECT id FROM assignable_types WHERE company_id = $1', [company_id]);
  for (const type of types) {
    await resolveAssignment(db, employeeId, type.id, asOfDate);
  }
}

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

export async function getAssignmentsAsOf(
  db: IDatabase,
  employeeId: string,
  asOfDate: string
): Promise<Assignment[]> {
  return db.query<Assignment>(
    `SELECT * FROM assignments
     WHERE employee_id = $1
       AND effective_from <= $2
       AND (effective_to IS NULL OR effective_to > $2)`,
    [employeeId, asOfDate]
  );
}

export async function explainAssignment(
  db: IDatabase,
  employeeId: string,
  assignableTypeId: string,
  asOfDate: string
): Promise<{ assignment: Assignment; rule: AssignmentRule | null; audit: any } | null> {
  const rows = await db.query<Assignment>(
    `SELECT * FROM assignments
     WHERE employee_id = $1 AND assignable_type_id = $2
       AND effective_from <= $3
       AND (effective_to IS NULL OR effective_to > $3)`,
    [employeeId, assignableTypeId, asOfDate]
  );
  if (rows.length === 0) return null;
  const assignment = rows[0];

  const ruleRows = assignment.rule_id
    ? await db.query<AssignmentRule>('SELECT * FROM assignment_rules WHERE id = $1', [assignment.rule_id])
    : [];

  const auditRows = await db.query<any>(
    'SELECT * FROM assignment_audit_log WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1',
    [assignment.id]
  );

  return {
    assignment,
    rule: ruleRows[0] || null,
    audit: auditRows[0] || null,
  };
}