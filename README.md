# Policy Assignment System

A generic engine for resolving employee assignments (managers, time-off policies, app access, compliance documents, etc.) based on rules. Instead of building a separate schema for each assignment type, this system models them all through one shape: assignable types, targets, rules, and assignments.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or accessible via connection string)

### Setup

1. Clone the repo and install dependencies:
```bash
cd warp-th
npm install
```

2. Create the database:
```bash
createdb warp_th
```

3. Load the schema and seed data:
```bash
psql postgresql://postgres:postgres@localhost:5432/warp_th -f src/db/schema.sql
psql postgresql://postgres:postgres@localhost:5432/warp_th -f src/db/seed.sql
```

4. Copy the environment example and adjust if your local Postgres uses different credentials:
```bash
cp .env.example .env
```

### Running

**Demo simulation (no database needed):**
```bash
npx ts-node src/index.ts
```
If `DATABASE_URL` isn't set, this runs a full in-memory simulation covering rule resolution, event-driven re-resolution, and point-in-time queries, and prints the results to the console.

**Resolve a real employee against Postgres:**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/warp_th SAMPLE_EMPLOYEE_ID=e0000000-0000-0000-0000-000000000001 npx ts-node src/index.ts
```
This connects to your seeded database and runs the resolver for the given employee, writing real rows into the `assignments` table.

## Architecture

### The core idea

Almost every feature in this domain reduces to the same pattern: an employee gets assigned to something based on rules. Rather than building a `manager_assignments` table, a `time_off_assignments` table, an `app_access` table, and so on, this system uses one generic model that can express all of them.

### Tables

- **employees** - the population rules are evaluated against (department, location, tenure, employment type, etc.)
- **groups / group_memberships** - IAM-style group membership, used by group-based rules
- **assignable_types** - defines a category of assignment (manager, time_off_vacation, app_access, compliance_doc) and its cardinality, either `single` (one active assignment per employee) or `multi` (many allowed at once)
- **targets** - the actual "thing" being assigned (a specific manager, a vacation policy, an app, a document)
- **assignment_rules** - the logic that decides who gets what. Each rule has a `rule_type` (attribute, location, tenure, group, or manual), a JSON condition, a target, and a priority
- **assignments** - the resolved output. One row per active employee-to-target assignment, with `effective_from` and `effective_to` dates so history is preserved rather than overwritten
- **assignment_audit_log** - records which rule won and which rules lost for every assignment change, so you can answer "why does this employee have this assignment"

### How resolution works

For a given employee and assignable type, the resolver:
1. Loads the employee's attributes
2. Fetches all active rules for that assignable type
3. Checks which rules match (attribute equality, location match, tenure threshold, group membership, or a manual override tied to a specific employee)
4. Sorts matches by priority (manual overrides use priority 100 so they naturally win ties against automated rules), then by rule creation time as a tiebreaker
5. For `single` cardinality types, the top match wins and becomes the one active assignment
6. For `multi` cardinality types, all matches are applied and the current set is diffed against what is already active

Assignment rows are never updated in place. When a winning target changes, the old row gets an `effective_to` date and a new row is inserted. This means you can ask "what did this employee have as of a given date" just by querying with a date range, and the audit log tells you which rule was responsible.

### Re-resolution

The system reacts to three kinds of changes:
- An employee's attributes change (location, department, hire date) - only assignable types with rules referencing the changed field get re-resolved, not every rule for every employee
- A group's membership changes - only assignable types with rules for that specific group are re-resolved
- A rule is edited - not implemented here, left as a documented tradeoff since re-resolving every employee affected by a changed rule gets expensive at scale, and is worth discussing separately

### Known limitations

- Tenure-based rules depend on the passage of time, not an external event, so there is no natural trigger to re-check them. In a real system this would need a scheduled job.
- The seed rule that assigns a manager by department does not exclude the target employee from matching their own rule, so a manager can end up assigned to themselves. This is a minor seed data quirk rather than a resolver bug, but worth guarding against with a real rule set.
- Rule edits do not currently trigger re-resolution (see above).