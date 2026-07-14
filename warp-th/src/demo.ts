import { explainAssignment, getAssignmentsAsOf, IDatabase, resolveAllForEmployee } from './resolver';
import { onEmployeeUpdated, onGroupMembershipChanged } from './events';

class CompleteMockDatabaseClient implements IDatabase {
  public assignments: any[] = [];
  public auditLogs: any[] = [];

  public employees = [
    { id: 'e0000000-0000-0000-0000-000000000001', company_id: 'c0000000-0000-0000-0000-000000000000', first_name: 'Eng', last_name: 'Lead', email: 'eng.lead@warp.inc', employment_type: 'w2_employee', pay_type: 'salary', department: 'Engineering', title: 'Engineering Lead', work_state: 'CA', work_country: 'US', hire_date: '2021-07-12', status: 'active' },
    { id: 'e0000000-0000-0000-0000-000000000002', company_id: 'c0000000-0000-0000-0000-000000000000', first_name: 'Alice', last_name: 'Smith', email: 'alice@warp.inc', employment_type: 'w2_employee', pay_type: 'salary', department: 'Engineering', title: 'Software Engineer', work_state: 'CA', work_country: 'US', hire_date: '2023-07-12', status: 'active' },
    { id: 'e0000000-0000-0000-0000-000000000003', company_id: 'c0000000-0000-0000-0000-000000000000', first_name: 'Bob', last_name: 'Jones', email: 'bob@warp.inc', employment_type: 'w2_employee', pay_type: 'salary', department: 'Engineering', title: 'Software Engineer', work_state: 'NY', work_country: 'US', hire_date: '2026-01-12', status: 'active' },
    { id: 'e0000000-0000-0000-0000-000000000004', company_id: 'c0000000-0000-0000-0000-000000000000', first_name: 'Carol', last_name: 'Davis', email: 'carol@warp.inc', employment_type: 'w2_employee', pay_type: 'hourly', department: 'Sales', title: 'Account Executive', work_state: 'NY', work_country: 'US', hire_date: '2025-07-12', status: 'active' },
    { id: 'e0000000-0000-0000-0000-000000000005', company_id: 'c0000000-0000-0000-0000-000000000000', first_name: 'Dave', last_name: 'Miller', email: 'dave@warp.inc', employment_type: 'w2_employee', pay_type: 'hourly', department: 'Sales', title: 'Account Executive', work_state: 'CA', work_country: 'US', hire_date: '2023-07-12', status: 'active' },
    { id: 'e0000000-0000-0000-0000-000000000006', company_id: 'c0000000-0000-0000-0000-000000000000', first_name: 'Eve', last_name: 'Wilson', email: 'eve@warp.inc', employment_type: 'contractor', pay_type: 'hourly', department: 'Engineering', title: 'Contractor Engineer', work_state: 'CA', work_country: 'US', hire_date: '2024-07-12', status: 'active' }
  ];

  private assignableTypes = [
    { id: 'a0000000-0000-0000-0000-000000000001', company_id: 'c0000000-0000-0000-0000-000000000000', key: 'manager', cardinality: 'single' },
    { id: 'a0000000-0000-0000-0000-000000000002', company_id: 'c0000000-0000-0000-0000-000000000000', key: 'time_off_vacation', cardinality: 'single' },
    { id: 'a0000000-0000-0000-0000-000000000003', company_id: 'c0000000-0000-0000-0000-000000000000', key: 'app_access', cardinality: 'multi' },
    { id: 'a0000000-0000-0000-0000-000000000004', company_id: 'c0000000-0000-0000-0000-000000000000', key: 'compliance_doc', cardinality: 'multi' }
  ];

  public groupMemberships = [
    { group_name: 'Engineering', employee_id: 'e0000000-0000-0000-0000-000000000002' },
    { group_name: 'Engineering', employee_id: 'e0000000-0000-0000-0000-000000000003' },
    { group_name: 'Engineering', employee_id: 'e0000000-0000-0000-0000-000000000006' }
  ];

  private rules = [
    { id: '40000000-0000-0000-0000-000000000001', assignable_type_id: 'a0000000-0000-0000-0000-000000000001', rule_type: 'attribute', condition: { department: 'Engineering' }, target_id: '30000000-0000-0000-0000-000000000001', priority: 1, active: true, created_at: new Date('2026-01-01') },
    { id: '40000000-0000-0000-0000-000000000002', assignable_type_id: 'a0000000-0000-0000-0000-000000000001', rule_type: 'manual', condition: { employee_id: 'e0000000-0000-0000-0000-000000000006' }, target_id: '30000000-0000-0000-0000-000000000001', priority: 100, active: true, created_at: new Date('2026-01-01') },
    { id: '40000000-0000-0000-0000-000000000003', assignable_type_id: 'a0000000-0000-0000-0000-000000000002', rule_type: 'tenure', condition: { tenure_years_gte: 0 }, target_id: '30000000-0000-0000-0000-000000000002', priority: 1, active: true, created_at: new Date('2026-01-01') },
    { id: '40000000-0000-0000-0000-000000000004', assignable_type_id: 'a0000000-0000-0000-0000-000000000002', rule_type: 'tenure', condition: { tenure_years_gte: 2 }, target_id: '30000000-0000-0000-0000-000000000003', priority: 2, active: true, created_at: new Date('2026-01-02') },
    { id: '40000000-0000-0000-0000-000000000005', assignable_type_id: 'a0000000-0000-0000-0000-000000000004', rule_type: 'location', condition: { work_state: 'CA' }, target_id: '30000000-0000-0000-0000-000000000006', priority: 1, active: true, created_at: new Date('2026-01-01') },
    { id: '40000000-0000-0000-0000-000000000006', assignable_type_id: 'a0000000-0000-0000-0000-000000000003', rule_type: 'group', condition: { group: 'Engineering' }, target_id: '30000000-0000-0000-0000-000000000004', priority: 1, active: true, created_at: new Date('2026-01-01') },
    { id: '40000000-0000-0000-0000-000000000007', assignable_type_id: 'a0000000-0000-0000-0000-000000000003', rule_type: 'group', condition: { group: 'Engineering' }, target_id: '30000000-0000-0000-0000-000000000005', priority: 1, active: true, created_at: new Date('2026-01-01') }
  ];

  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.startsWith('SELECT * FROM employees WHERE id =')) {
      return this.employees.filter(e => e.id === params[0]) as any;
    }
    if (cleaned.startsWith('SELECT company_id FROM employees WHERE id =')) {
      return this.employees.filter(e => e.id === params[0]).map(e => ({ company_id: e.company_id })) as any;
    }
    if (cleaned.startsWith('SELECT DISTINCT assignable_type_id FROM assignment_rules WHERE active = true AND rule_type = \'group\'')) {
      const types = this.rules.filter(r => r.rule_type === 'group' && (r.condition as any).group === params[0]).map(r => r.assignable_type_id);
      return Array.from(new Set(types)).map(id => ({ assignable_type_id: id })) as any;
    }
    if (cleaned.startsWith('SELECT DISTINCT assignable_type_id FROM assignment_rules')) {
      const targetRuleTypes = params[0] as string[];
      const types = this.rules.filter(r => targetRuleTypes.includes(r.rule_type)).map(r => r.assignable_type_id);
      return Array.from(new Set(types)).map(id => ({ assignable_type_id: id })) as any;
    }
    if (cleaned.startsWith('SELECT * FROM assignment_rules WHERE assignable_type_id =')) {
      return this.rules.filter(r => r.assignable_type_id === params[0] && r.active) as any;
    }
    if (cleaned.startsWith('SELECT COUNT(*)::int as count FROM group_memberships')) {
      const match = this.groupMemberships.filter(m => m.employee_id === params[0] && m.group_name === params[1]);
      return [{ count: match.length }] as any;
    }
    if (cleaned.startsWith('SELECT * FROM assignable_types WHERE id =')) {
      return this.assignableTypes.filter(t => t.id === params[0]) as any;
    }
    if (cleaned.startsWith('SELECT id FROM assignable_types WHERE company_id =')) {
      return this.assignableTypes.filter(t => t.company_id === params[0]).map(t => ({ id: t.id })) as any;
    }
    if (cleaned.includes('effective_from <= $2') || cleaned.includes('effective_from <= $3')) {
      const checkDate = params[1];
      return this.assignments.filter(a =>
        a.employee_id === params[0] &&
        a.effective_from <= checkDate &&
        (a.effective_to === null || a.effective_to > checkDate)
      ) as any;
    }
    if (cleaned.startsWith('SELECT * FROM assignments WHERE employee_id =')) {
      return this.assignments.filter(a => a.employee_id === params[0] && a.assignable_type_id === params[1] && a.effective_to === null) as any;
    }
    if (cleaned.startsWith('UPDATE assignments SET effective_to =')) {
      const target = this.assignments.find(a => a.id === params[1]);
      if (target) target.effective_to = params[0];
      return [];
    }
    if (cleaned.startsWith('INSERT INTO assignments')) {
      this.assignments.push({ id: params[0], employee_id: params[1], assignable_type_id: params[2], target_id: params[3], source: params[4], rule_id: params[5], effective_from: params[6], effective_to: null });
      return [];
    }
    if (cleaned.startsWith('INSERT INTO assignment_audit_log')) {
      this.auditLogs.push({ id: params[0], assignment_id: params[1], action: params[2], reason: params[3], rule_id: params[4], snapshot: JSON.parse(params[5]) });
      return [];
    }
    if (cleaned.startsWith('SELECT * FROM assignment_rules WHERE id =')) {
      return this.rules.filter(r => r.id === params[0]) as any;
    }
    if (cleaned.startsWith('SELECT * FROM assignment_audit_log WHERE assignment_id =')) {
      return this.auditLogs.filter(a => a.assignment_id === params[0]) as any;
    }
    throw new Error(`Unsupported Query: ${cleaned}`);
  }

  public updateEmployee(id: string, patch: any) {
    const emp = this.employees.find(e => e.id === id);
    if (emp) Object.assign(emp, patch);
  }

  public removeGroupMembership(employeeId: string, groupName: string) {
    this.groupMemberships = this.groupMemberships.filter(m => !(m.employee_id === employeeId && m.group_name === groupName));
  }
}

async function runTimelineSimulation() {
  const db = new CompleteMockDatabaseClient();
  const bobId = 'e0000000-0000-0000-0000-000000000003';
  const eveId = 'e0000000-0000-0000-0000-000000000006';

  console.log("🚀 Establishing Baseline Positions (Baseline: 2026-06-01)...");
  for (const emp of db.employees) {
    await resolveAllForEmployee(db, emp.id, '2026-06-01');
  }

  console.log("\n=========================================================================");
  console.log("SCENARIO 1: Bob Relocates from NY to CA (Effective 2026-06-10)");
  console.log("=========================================================================");
  db.updateEmployee(bobId, { work_state: 'CA' });
  await onEmployeeUpdated(db, bobId, ['work_state'], '2026-06-10');

  const bobDocs = db.assignments.filter(a => a.employee_id === bobId && a.assignable_type_id === 'a0000000-0000-0000-0000-000000000004' && a.effective_to === null);
  console.log(`Verified: Bob now holds active CA compliance targets: ${bobDocs.some(d => d.target_id === '30000000-0000-0000-0000-000000000006')}`);

  console.log("\n=========================================================================");
  console.log("SCENARIO 2: Bob Reaches 2-Year Milestone (Effective 2026-07-01)");
  console.log("=========================================================================");
  const originalVacation = db.assignments.find(a => a.employee_id === bobId && a.assignable_type_id === 'a0000000-0000-0000-0000-000000000002' && a.effective_to === null);
  console.log(`Baseline Active Vacation Target ID: ${originalVacation?.target_id}`);

  db.updateEmployee(bobId, { hire_date: '2023-01-01' });
  await onEmployeeUpdated(db, bobId, ['hire_date'], '2026-07-01');

  const updatedVacations = db.assignments.filter(a => a.employee_id === bobId && a.assignable_type_id === 'a0000000-0000-0000-0000-000000000002');
  const closedVacation = updatedVacations.find(a => a.effective_to !== null);
  const activeVacation = updatedVacations.find(a => a.effective_to === null);

  console.log(`Verified: Standard Vacation period closed successfully: ${closedVacation?.target_id === '30000000-0000-0000-0000-000000000002'}`);
  console.log(`Verified: Senior Vacation period opened successfully: ${activeVacation?.target_id === '30000000-0000-0000-0000-000000000003'}`);

  console.log("\n=========================================================================");
  console.log("SCENARIO 3: Removing Eve from Engineering (Effective 2026-07-10)");
  console.log("=========================================================================");
  const eveAppsBefore = db.assignments.filter(a => a.employee_id === eveId && a.assignable_type_id === 'a0000000-0000-0000-0000-000000000003' && a.effective_to === null);
  console.log(`Active tool accounts prior to group modification: ${eveAppsBefore.length}`);

  db.removeGroupMembership(eveId, 'Engineering');
  await onGroupMembershipChanged(db, eveId, 'Engineering', '2026-07-10');

  const eveAppsAfter = db.assignments.filter(a => a.employee_id === eveId && a.assignable_type_id === 'a0000000-0000-0000-0000-000000000003' && a.effective_to === null);
  console.log(`Active tool accounts after group modification: ${eveAppsAfter.length}`);

  console.log("\n=========================================================================");
  console.log("SCENARIO 4: Point-in-Time Queries");
  console.log("=========================================================================");
  
  const before = await getAssignmentsAsOf(db, bobId, '2026-06-15');
  const standardVacActive = before.find(a => a.assignable_type_id === 'a0000000-0000-0000-0000-000000000002');
  console.log("Bob's vacation target as of 2026-06-15:", standardVacActive?.target_id === '30000000-0000-0000-0000-000000000002' ? 'Standard Vacation Policy' : 'None');

  const after = await getAssignmentsAsOf(db, bobId, '2026-07-05');
  const seniorVacActive = after.find(a => a.assignable_type_id === 'a0000000-0000-0000-0000-000000000002');
  console.log("Bob's vacation target as of 2026-07-05:", seniorVacActive?.target_id === '30000000-0000-0000-0000-000000000003' ? 'Senior Vacation Policy' : 'None');

  const eveManagerExplanation = await explainAssignment(
    db,
    eveId,
    'a0000000-0000-0000-0000-000000000001',
    '2026-07-10'
  );
  console.log(
    "Eve's manager assignment as of 2026-07-10:",
    eveManagerExplanation?.rule?.rule_type === 'manual' ? 'Manual override applied' : 'No manual override found'
  );

  console.log("=========================================================================\n");
}

runTimelineSimulation().catch(console.error);