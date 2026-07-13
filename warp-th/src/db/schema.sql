CREATE TABLE companies (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
    id              UUID PRIMARY KEY,
    company_id      UUID NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    email           TEXT NOT NULL,

    -- attributes that rules commonly target
    employment_type TEXT NOT NULL,   -- 'w2_employee' | 'contractor' | ...
    pay_type        TEXT NOT NULL,   -- 'hourly' | 'salary'
    department      TEXT,            -- 'Engineering' | 'Sales' | ...
    title           TEXT,
    work_state      TEXT,            -- 'CA' | 'NY' | ...
    work_country    TEXT DEFAULT 'US',

    hire_date       DATE NOT NULL,   -- tenure is derived from this + now()
    status          TEXT NOT NULL,   -- 'active' | 'on_leave' | 'terminated'

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE groups (
    id          UUID PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, name)
);

CREATE TABLE group_memberships (
    id          UUID PRIMARY KEY,
    group_id    UUID NOT NULL REFERENCES groups(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, employee_id)
);

CREATE TABLE assignable_types (
    id          UUID PRIMARY KEY,
    company_id  UUID NOT NULL REFERENCES companies(id),
    key         TEXT NOT NULL,
    cardinality TEXT NOT NULL CHECK (cardinality IN ('single', 'multi')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, key)
);

CREATE TABLE targets (
    id                 UUID PRIMARY KEY,
    assignable_type_id UUID NOT NULL REFERENCES assignable_types(id),
    name               TEXT NOT NULL,
    metadata           JSONB NOT NULL DEFAULT '{}',
    target_employee_id UUID REFERENCES employees(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignment_rules (
    id                 UUID PRIMARY KEY,
    assignable_type_id UUID NOT NULL REFERENCES assignable_types(id),
    rule_type          TEXT NOT NULL,
    condition          JSONB NOT NULL,
    target_id          UUID NOT NULL REFERENCES targets(id),
    priority           INTEGER NOT NULL DEFAULT 0,
    active             BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignments (
    id                 UUID PRIMARY KEY,
    employee_id        UUID NOT NULL REFERENCES employees(id),
    assignable_type_id UUID NOT NULL REFERENCES assignable_types(id),
    target_id          UUID NOT NULL REFERENCES targets(id),
    source             TEXT NOT NULL,
    rule_id            UUID REFERENCES assignment_rules(id),
    effective_from     DATE NOT NULL,
    effective_to       DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX assignments_single_cardinality_idx
    ON assignments (employee_id, assignable_type_id)
    WHERE effective_to IS NULL;

CREATE TABLE assignment_audit_log (
    id            UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES assignments(id),
    action        TEXT NOT NULL,
    reason        TEXT,
    rule_id       UUID REFERENCES assignment_rules(id),
    snapshot      JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
