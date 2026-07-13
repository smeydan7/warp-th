export type RuleType = 'attribute' | 'location' | 'tenure' | 'group' | 'manual';
export type Cardinality = 'single' | 'multi';

export interface Employee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  employment_type: string;
  pay_type: string;
  department: string | null;
  title: string | null;
  work_state: string | null;
  work_country: string;
  hire_date: string; // ISO Date String (YYYY-MM-DD)
  status: string;
  created_at: Date;
  updated_at: Date;
}

// Polymorphic Type Definitions for Assignment Rule Conditions
export interface AttributeCondition {
  [key: string]: string | number | boolean;
}

export interface LocationCondition {
  work_state?: string;
  work_country?: string;
}

export interface TenureCondition {
  tenure_years_gte: number;
}

export interface GroupCondition {
  group: string;
}

export interface ManualCondition {
  employee_id: string;
}

export type RuleCondition = 
  | AttributeCondition 
  | LocationCondition 
  | TenureCondition 
  | GroupCondition 
  | ManualCondition;

export interface AssignmentRule {
  id: string;
  assignable_type_id: string;
  rule_type: RuleType;
  condition: RuleCondition;
  target_id: string;
  priority: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AssignableType {
  id: string;
  company_id: string;
  key: string;
  cardinality: Cardinality;
  created_at: Date;
  updated_at: Date;
}

export interface Target {
  id: string;
  assignable_type_id: string;
  name: string;
  metadata: Record<string, any>;
  target_employee_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Assignment {
  id: string;
  employee_id: string;
  assignable_type_id: string;
  target_id: string;
  source: 'rule' | 'manual';
  rule_id: string | null;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null; // YYYY-MM-DD or null if active
  created_at: Date;
  updated_at: Date;
}