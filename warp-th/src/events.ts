import { IDatabase, resolveAssignment } from './resolver';
import { AssignmentRule } from './types';

/**
 * Handles processing when specific employee core attributes are modified.
 * NOTE: Since tenure calculations depend on the passage of physical time, shifts in tenure
 * are handled here as a change event, but ongoing chronological drift requires a cron-like sweep.
 */
export async function onEmployeeUpdated(
  db: IDatabase,
  employeeId: string,
  changedFields: string[]
): Promise<void> {
  // Map changed data fields to target rule configurations
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

  // Retrieve rules affected by these field modifications
  const rules = await db.query<AssignmentRule>(
    `SELECT DISTINCT assignable_type_id 
     FROM assignment_rules 
     WHERE active = true AND rule_type ANY($1)`,
    [Array.from(targetRuleTypes)]
  );

  // Re-evaluate affected configurations for the employee
  const typeIds = rules.map(r => r.assignable_type_id);
  for (const typeId of typeIds) {
    await resolveAssignment(db, employeeId, typeId);
  }
}

/**
 * Handles group membership updates by checking for corresponding group rules.
 */
export async function onGroupMembershipChanged(
  db: IDatabase,
  employeeId: string,
  groupName: string
): Promise<void> {
  // Retrieve target rules triggered by this specific group
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
    await resolveAssignment(db, employeeId, typeId);
  }
}