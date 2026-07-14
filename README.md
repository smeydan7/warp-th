# Policy Assignment System

A generic engine for assigning "things" to employees based on rules; time off policies, managers, app access, compliance documents, and anything else that follows the same pattern. Built for the Warp take-home.

## Running the Project

Clone the repo and install dependencies:

```bash
cd warp-th
npm install
```

Copy the env file and adjust if needed:

```bash
cp .env.example .env
```

If you don't have a Postgres database running yet, see the setup section below first.

Once your database is set up and seeded, run the resolver against a real employee:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/warp_th \
SAMPLE_EMPLOYEE_ID=e0000000-0000-0000-0000-000000000001 \
npx ts-node src/index.ts
```

If you leave `DATABASE_URL` unset, `index.ts` falls back to an in-memory demo simulation instead, so you can see the whole system working without touching Postgres at all:

```bash
npx ts-node src/demo.ts
```

This runs through four scenarios: an employee relocating, an employee crossing a tenure threshold, a group membership change, and a couple of point-in-time / audit queries. Everything prints to the console so you can follow along.

To run the unit tests:

```bash
node --test tests/
```

## Setting Up the Database

You need a local Postgres instance. If you don't have one:

```bash
brew install --cask postgres-app
```

Open the app once to initialize it, then create the database:

```bash
createdb warp_th
```

Load the schema:

```bash
psql postgresql://postgres:postgres@localhost:5432/warp_th -f src/db/schema.sql
```

Load the seed data (six sample employees, a couple of groups, and rules covering every rule type):

```bash
psql postgresql://postgres:postgres@localhost:5432/warp_th -f src/db/seed.sql
```

At this point you can run `src/index.ts` against real data, or just poke around with `psql` directly.

## Architecture

The core idea is that almost every assignment feature (manager, time off policy, app access, compliance docs, and so on) is the same shape underneath: an employee gets matched to a target based on rules, and either has exactly one active target (single cardinality) or several at once (multi cardinality). Rather than building a separate schema per feature, there's one generic model that covers all of them.

**Tables:**

- `employees`, `groups`, `group_memberships` are the inputs. In a real system these would come from the Employee Service and Directory Service; here they're modeled directly for the demo.
- `assignable_types` defines the categories of things that get assigned (manager, time_off_vacation, app_access, compliance_doc) and whether each one is single or multi cardinality.
- `targets` is the generic "thing being assigned." An app, a policy, a document, or even another employee (for manager assignments) are all just rows here.
- `assignment_rules` defines how targets get matched to employees. Each rule has a type (attribute, location, tenure, group, or manual), a JSON condition, a target, and a priority.
- `assignments` is the resolved output. Rows are never updated in place; when an assignment changes, the old row gets an `effective_to` date and a new row gets inserted with a fresh `effective_from`. This gives you a full history for free and lets you answer point-in-time questions.
- `assignment_audit_log` records which rule won and which candidates lost every time an assignment changes, so you can explain why an employee has a given assignment as of any date.

**Resolution:**

For a given employee and assignable type, the resolver pulls every active rule for that type, checks which ones match the employee (based on their attributes, location, tenure, group memberships, or a direct manual override), and sorts the matches by priority. Manual rules use priority 100 so they always win over everything else. Ties are broken by which rule was created first, so the outcome is always deterministic and repeatable.

For single cardinality types, the highest priority match wins and becomes the one active assignment. For multi cardinality types, every matching target becomes an active assignment, and the resolver diffs against what's currently active, closing anything that no longer matches and adding anything new.

**Re-resolution:**

The system reacts to three kinds of events: an employee's attributes changing, a group membership changing, and (as a documented but not yet implemented follow-up) a rule being edited. Rather than re-checking every employee against every rule, the event handlers map the changed field to the relevant rule types and only re-resolve the assignable types those rule types affect. Tenure is the one exception: since nothing "fires" when time simply passes, a real deployment would need a scheduled job to periodically re-check tenure-based rules.

**Known limitations:**

- Tenure-based rules need a scheduled re-check since there's no natural event tied to time passing on its own.
- Re-resolution on rule edits is not implemented, only sketched out in `events.ts`, since re-resolving every employee affected by a changed rule can get expensive at scale.
- The demo defaults to an in-memory mock database for reproducibility. The resolver has also been run and verified against a real Postgres instance (see the assignments table output above the architecture section, or run it yourself with `src/index.ts`).
- Rules currently don't exclude an employee from being their own target. In the seed data, the Engineering department lead ends up assigned as his own manager, since the attribute rule matches everyone in Engineering including him. A production system would probably want a guard against this or handle leadership roles through manual overrides.

**Bonus tradeoffs (discussion only, not implemented):**

- *Event-driven workflows*: this resolver answers "what applies to this employee right now." A separate workflow engine would sit on top and answer "what should happen when that changes," subscribing to assignment-change events rather than being baked into the resolver itself.
- *Simulation*: a dry-run flag on `resolveAssignment` could return the diff of a hypothetical rule change without writing anything, reusing the same resolution logic.
- *Scale*: at 100k+ employees, indexing rules by the attribute keys they reference and only re-resolving the employees whose changed field intersects those keys avoids a full employee times rules scan. Group membership changes affecting many employees at once would benefit from batching through a queue.
- *Exceptions and approvals*: these could be modeled as another `source` value on assignments (`exception`), with an `expires_at` and an approval status, layered on top of the normal rule resolution as an override.