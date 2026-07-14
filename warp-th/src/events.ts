import { IDatabase, resolveAssignment } from './resolver';
import { AssignmentRule } from './types';

/**
 * Handles processing when specific employee core attributes are modified.
 */
export async function onEmployeeUpdated(
  db: IDatabase,
  employeeId: string,
  changedFields: string[],
  asOfDate: string = new Date().toISOString().split('T')[0]
): Promise<void> {
  const fieldToRuleTypeMap: Record<string, string> = {
    department: 'attribute',
    work_state: 'location',
    work_country: 'location',
    hire_date: 'tenure'
  };

  const targetRuleTypes = new Set<string>();
  changedFields.forEach(field => {
    if (fieldToRuleTypeMap[field]) {
      targetRuleTypes.add(fieldToRuleTypeMap[field]);
    }
  });

  if (targetRuleTypes.size === 0) return;

  const rules = await db.query<AssignmentRule>(
    `SELECT DISTINCT assignable_type_id 
     FROM assignment_rules 
     WHERE active = true AND rule_type ANY($1)`,
    [Array.from(targetRuleTypes)]
  );

  const typeIds = rules.map(r => r.assignable_type_id);
  for (const typeId of typeIds) {
    await resolveAssignment(db, employeeId, typeId, asOfDate);
  }
}

/**
 * Handles group membership updates by checking for corresponding group rules.
 */
export async function onGroupMembershipChanged(
  db: IDatabase,
  employeeId: string,
  groupName: string,
  asOfDate: string = new Date().toISOString().split('T')[0]
): Promise<void> {
  const rules = await db.query<AssignmentRule>(
    `SELECT DISTINCT assignable_type_id 
     FROM assignment_rules 
     WHERE active = true 
       AND rule_type = 'group' 
       AND (condition->>'group') = $1`,
    [groupName]
  );

  const typeIds = rules.map(r => r.assignable_type_id);
  for (const typeId of typeIds) {
    await resolveAssignment(db, employeeId, typeId, asOfDate);
  }
}