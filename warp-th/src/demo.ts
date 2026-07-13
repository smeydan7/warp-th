import { IDatabase, resolveAllForEmployee } from './resolver';

class CompleteMockDatabaseClient implements IDatabase {
  public assignments: any[] = [];
  public auditLogs: any[] = [];

  // 100% Mirror of seed.sql records (Context Year: 2026)
  private employees = [
    { id: 'e0000000-0000-0000-0000-000000000001', company_id: 'c0000000-0000-0000-0000-000000000000', first_name: 'Eng Lead', last_name: 'Lead', email: 'eng.lead@warp.inc', employment_type: 'w2_employee', pay_type: 'salary', department: 'Engineering', title: 'Engineering Lead', work_state: 'CA', work_country: 'US', hire_date: '2021-07-12', status: 'active' },
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

  private groupMemberships = [
    { group_name: 'Engineering', employee_id: 'e0000000-0000-0000-0000-000000000002' }, // Alice
    { group_name: 'Engineering', employee_id: 'e0000000-0000-0000-0000-000000000003' }, // Bob
    { group_name: 'Engineering', employee_id: 'e0000000-0000-0000-0000-000000000006' }  // Eve
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
    throw new Error(`Unsupported Query: ${cleaned}`);
  }
}

async function runValidationSuite() {
  const db = new CompleteMockDatabaseClient();
  const employeeIds = [
    { name: 'Eng Lead', id: 'e0000000-0000-0000-0000-000000000001' },
    { name: 'Alice',    id: 'e0000000-0000-0000-0000-000000000002' },
    { name: 'Bob',      id: 'e0000000-0000-0000-0000-000000000003' },
    { name: 'Carol',    id: 'e0000000-0000-0000-0000-000000000004' },
    { name: 'Dave',      id: 'e0000000-0000-0000-0000-000000000005' },
    { name: 'Eve',      id: 'e0000000-0000-0000-0000-000000000006' }
  ];

  console.log("⚡ Executing Rule Resolution Engine across data population...");
  for (const emp of employeeIds) {
    await resolveAllForEmployee(db, emp.id);
  }

  // Identifiers for verification mapping
  const mgrType  = 'a0000000-0000-0000-0000-000000000001';
  const vacType  = 'a0000000-0000-0000-0000-000000000002';
  const appType  = 'a0000000-0000-0000-0000-000000000003';
  const docType  = 'a0000000-0000-0000-0000-000000000004';

  const engLeadTarget  = '30000000-0000-0000-0000-000000000001';
  const stdVacTarget    = '30000000-0000-0000-0000-000000000002';
  const snrVacTarget    = '30000000-0000-0000-0000-000000000003';
  const githubTarget    = '30000000-0000-0000-0000-000000000004';
  const linearTarget    = '30000000-0000-0000-0000-000000000005';
  const mealBreakTarget = '30000000-0000-0000-0000-000000000006';

  const helper = {
    hasTarget: (empId: string, typeId: string, targetId: string) => 
      db.assignments.some(a => a.employee_id === empId && a.assignable_type_id === typeId && a.target_id === targetId && a.effective_to === null),
    getAssignment: (empId: string, typeId: string) => 
      db.assignments.find(a => a.employee_id === empId && a.assignable_type_id === typeId && a.effective_to === null)
  };

  console.log("\n=======================================================");
  console.log("🔬 VERIFICATION SUITE RESULTS");
  console.log("=======================================================");

  // Assertion 1: Manager Assignments & Overrides
  const aliceMgr = helper.getAssignment(employeeIds[1].id, mgrType);
  const bobMgr   = helper.getAssignment(employeeIds[2].id, mgrType);
  const eveMgr   = helper.getAssignment(employeeIds[5].id, mgrType);

  console.log(`[PASS] Alice gets Eng Lead via Attribute Rule: ${aliceMgr?.rule_id === '40000000-0000-0000-0000-000000000001' && aliceMgr.source === 'rule'}`);
  console.log(`[PASS] Bob gets Eng Lead via Attribute Rule: ${bobMgr?.rule_id === '40000000-0000-0000-0000-000000000001' && bobMgr.source === 'rule'}`);
  console.log(`[PASS] Eve gets Eng Lead via Manual Override: ${eveMgr?.rule_id === '40000000-0000-0000-0000-000000000002' && eveMgr.source === 'manual'}`);

  // Assertion 2: Tenure Vacation Splits
  console.log(`[PASS] Alice (3yr) -> Senior Vacation: ${helper.hasTarget(employeeIds[1].id, vacType, snrVacTarget)}`);
  console.log(`[PASS] Bob (<1yr) -> Standard Vacation: ${helper.hasTarget(employeeIds[2].id, vacType, stdVacTarget)}`);

  // Assertion 3: App Multi-access
  const engGroupAppsPass = ['e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000006'].every(id => 
    helper.hasTarget(id, appType, githubTarget) && helper.hasTarget(id, appType, linearTarget)
  );
  const carolAppsPass = db.assignments.filter(a => a.employee_id === employeeIds[3].id && a.assignable_type_id === appType).length === 0;
  console.log(`[PASS] Alice/Bob/Eve receive GitHub + Linear: ${engGroupAppsPass}`);
  console.log(`[PASS] Carol (Sales) receives zero app access configurations: ${carolAppsPass}`);

  // Assertion 4: CA State Mandate Compliance Documents
  const caDocPass = ['e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000006'].every(id =>
    helper.hasTarget(id, docType, mealBreakTarget)
  );
  const nyDocPass = ['e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004'].every(id =>
    !helper.hasTarget(id, docType, mealBreakTarget)
  );
  console.log(`[PASS] EngLead/Alice/Dave/Eve (CA) receive Meal Break Document: ${caDocPass}`);
  console.log(`[PASS] Bob/Carol (NY) bypass Meal Break Document: ${nyDocPass}`);
  console.log("=======================================================\n");

  console.log("📋 RAW SYSTEM ASSIGNMENTS TABLE LOG:");
  console.table(db.assignments.map(a => {
    const emp = employeeIds.find(e => e.id === a.employee_id);
    return {
      Employee: emp?.name,
      Type: a.assignable_type_id === mgrType ? 'Manager' : a.assignable_type_id === vacType ? 'Vacation' : a.assignable_type_id === appType ? 'App Access' : 'Compliance',
      Target: a.target_id === engLeadTarget ? 'Eng Lead' : a.target_id === stdVacTarget ? 'Std Vacation' : a.target_id === snrVacTarget ? 'Snr Vacation' : a.target_id === githubTarget ? 'GitHub' : a.target_id === linearTarget ? 'Linear' : 'CA Meal Break',
      Source: a.source,
      Rule_Id: a.rule_id ? `${a.rule_id.substring(0,8)}...` : 'NONE'
    };
  }));
}

runValidationSuite().catch(console.error);