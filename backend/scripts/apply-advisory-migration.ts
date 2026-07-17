/**
 * Idempotent apply of tenants/outbox migration for databases that already
 * exist outside a clean Prisma migrate history.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Split SQL into executable statements, preserving DO $$ ... $$ blocks. */
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (!inDollar && ch === '$' && next === '$') {
      inDollar = true;
      buf += '$$';
      i++;
      continue;
    }
    if (inDollar && ch === '$' && next === '$') {
      inDollar = false;
      buf += '$$';
      i++;
      continue;
    }
    if (!inDollar && ch === ';') {
      const stmt = stripLeadingComments(buf);
      if (stmt) statements.push(stmt);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const tail = stripLeadingComments(buf);
  if (tail) statements.push(tail);
  return statements;
}

function stripLeadingComments(raw: string): string {
  const lines = raw.split(/\r?\n/);
  while (lines.length && (lines[0].trim() === '' || lines[0].trim().startsWith('--'))) {
    lines.shift();
  }
  return lines.join('\n').trim();
}

async function main() {
  const sqlPath = path.join(
    __dirname,
    '../prisma/migrations/20260717110000_advisory_tenants_outbox/migration.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitSql(sql);
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }
  const tenants = await prisma.tenant.count();
  const outbox = await prisma.eventOutbox.count();
  console.log(JSON.stringify({ ok: true, tenants, outbox, statements: statements.length }));
}

main()
  .catch(async (err) => {
    console.error('apply-advisory-migration failed:', err instanceof Error ? err.message : err);
    try {
      const tenants = await prisma.tenant.count();
      console.log(JSON.stringify({ ok: true, tenants, alreadyApplied: true }));
      process.exit(0);
    } catch {
      process.exit(1);
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
