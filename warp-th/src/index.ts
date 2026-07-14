import { createDatabaseClient } from './db/client';
import { resolveAllForEmployee } from './resolver';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set; running the built-in demo simulation instead.');
    await import('./demo');
    return;
  }

  const db = createDatabaseClient();
  const employeeId = process.env.SAMPLE_EMPLOYEE_ID;

  if (!employeeId) {
    console.log('DATABASE_URL configured. The resolver is wired to the Postgres client in src/db/client.ts.');
    return;
  }

  await resolveAllForEmployee(db, employeeId, new Date().toISOString().split('T')[0]);
  console.log(`Resolved assignments for employee ${employeeId}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
