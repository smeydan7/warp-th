-- ============================================================================
-- 1. COMPANIES
-- ============================================================================
INSERT INTO companies (id, name)
VALUES ('c0000000-0000-0000-0000-000000000000', 'Warp Inc');

-- ============================================================================
-- 2. EMPLOYEES
-- ============================================================================
-- Dates relative to July 2026 context:
-- 5 yrs ago -> 2021-07-12 | 3 yrs ago -> 2023-07-12 | 2 yrs ago -> 2024-07-12
-- 1 yr ago  -> 2025-07-12 | 6 months ago -> 2026-01-12
INSERT INTO employees (
    id, company_id, first_name, last_name, email, 
    employment_type, pay_type, department, title, 
    work_state, work_country, hire_date, status
) VALUES 
-- Eng Lead (5 yrs ago, CA, salary, target for manager rule)
('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000', 'Eng', 'Lead', 'eng.lead@warp.inc', 'w2_employee', 'salary', 'Engineering', 'Engineering Lead', 'CA', 'US', '2021-07-12', 'active'),

-- Alice (3 yrs ago, CA, salary, tenure >= 2, in Eng group)
('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000', 'Alice', 'Smith', 'alice@warp.inc', 'w2_employee', 'salary', 'Engineering', 'Software Engineer', 'CA', 'US', '2023-07-12', 'active'),

-- Bob (6 months ago, NY, salary, tenure < 2, in Eng group)
('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000000', 'Bob', 'Jones', 'bob@warp.inc', 'w2_employee', 'salary', 'Engineering', 'Software Engineer', 'NY', 'US', '2026-01-12', 'active'),

-- Carol (1 yr ago, NY, hourly, non-Eng, tests default rules)
('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000000', 'Carol', 'Davis', 'carol@warp.inc', 'w2_employee', 'hourly', 'Sales', 'Account Executive', 'NY', 'US', '2025-07-12', 'active'),

-- Dave (3 yrs ago, CA, hourly, CA location rule + manual override target)
('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000000', 'Dave', 'Miller', 'dave@warp.inc', 'w2_employee', 'hourly', 'Sales', 'Account Executive', 'CA', 'US', '2023-07-12', 'active'),

-- Eve (2 yrs ago, CA, hourly, contractor, manual override case)
('e0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000000', 'Eve', 'Wilson', 'eve@warp.inc', 'contractor', 'hourly', 'Engineering', 'Contractor Engineer', 'CA', 'US', '2024-07-12', 'active');

-- ============================================================================
-- 3. GROUPS & MEMBERSHIPS
-- ============================================================================
INSERT INTO groups (id, company_id, name) VALUES 
('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000', 'Engineering'),
('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000', 'Executives');

-- Membership: Alice, Bob, Eve -> Engineering
INSERT INTO group_memberships (id, group_id, employee_id) VALUES 
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006');

-- ============================================================================
-- 4. ASSIGNABLE TYPES
-- ============================================================================
INSERT INTO assignable_types (id, company_id, key, cardinality) VALUES 
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000', 'manager', 'single'),
('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000', 'time_off_vacation', 'single'),
('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000000', 'app_access', 'multi'),
('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000000', 'compliance_doc', 'multi');

-- ============================================================================
-- 5. TARGETS
-- ============================================================================
INSERT INTO targets (id, assignable_type_id, name, metadata, target_employee_id) VALUES 
-- Manager Target (Points to Eng Lead Employee Row)
('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Eng Lead', '{}', 'e0000000-0000-0000-0000-000000000001'),

-- Vacation Policies
('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Standard Vacation Policy', '{}', NULL),
('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Senior Vacation Policy (2yr+)', '{}', NULL),

-- App Access Targets
('30000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'GitHub', '{}', NULL),
('30000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'Linear', '{}', NULL),

-- Compliance Targets
('30000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', 'CA Meal Break Doc', '{}', NULL);

-- ============================================================================
-- 6. ASSIGNMENT RULES
-- ============================================================================
INSERT INTO assignment_rules (id, assignable_type_id, rule_type, condition, target_id, priority, active) VALUES 
-- 1. Attribute: {department: "Engineering"} -> target=Eng Lead, type=manager, priority=1
('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'attribute', '{"department": "Engineering"}', '30000000-0000-0000-0000-000000000001', 1, true),

-- 2. Manual: employee=Eve -> target=Eng Lead, priority=100 (Override condition captures her specific employee ID)
('40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'manual', '{"employee_id": "e0000000-0000-0000-0000-000000000006"}', '30000000-0000-0000-0000-000000000001', 100, true),

-- 3. Tenure: {tenure_years_gte: 0} -> Standard Vacation, priority=1 (Fallback)
('40000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'tenure', '{"tenure_years_gte": 0}', '30000000-0000-0000-0000-000000000002', 1, true),

-- 4. Tenure: {tenure_years_gte: 2} -> Senior Vacation, priority=2 (Supersedes priority 1 fallback)
('40000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'tenure', '{"tenure_years_gte": 2}', '30000000-0000-0000-0000-000000000003', 2, true),

-- 5. Location: {work_state: "CA"} -> CA Meal Break Doc, type=compliance_doc, priority=1
('40000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'location', '{"work_state": "CA"}', '30000000-0000-0000-0000-000000000006', 1, true),

-- 6. Group: {group: "Engineering"} -> GitHub, type=app_access, priority=1
('40000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'group', '{"group": "Engineering"}', '30000000-0000-0000-0000-000000000004', 1, true),

-- 7. Group: {group: "Engineering"} -> Linear, type=app_access, priority=1
('40000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'group', '{"group": "Engineering"}', '30000000-0000-0000-0000-000000000005', 1, true);