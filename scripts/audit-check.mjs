// npm audit (dépendances de production) avec une liste de risques acceptés, chacun avec une date d'expiration.
// Usage (CI) : npm audit --omit=dev --json | node scripts/audit-check.mjs
// Échoue sur toute faille « high » ou « critical » non acceptée, ou acceptée mais expirée. Liste : .trivyignore (mêmes identifiants).
import { readFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';

const accepted = new Map(readFileSync('.trivyignore', 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [id, exp] = l.split(/\s+/); return [id, exp?.replace(/^exp:/, '') ?? null]; }));
const today = new Date().toISOString().slice(0, 10);
let input = '';
for await (const chunk of process.stdin) input += chunk; // lecture asynchrone : readFileSync(0) échoue (EAGAIN) sur un tuyau
const report = JSON.parse(input || '{}');
const problems = [];
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via ?? []) {
    if (typeof via !== 'object' || !['high', 'critical'].includes(via.severity)) continue;
    const id = String(via.url ?? '').split('/').pop();
    const exp = accepted.get(id);
    if (exp && exp >= today) { console.log(`accepté jusqu'au ${exp} : ${name} ${id} (${via.title})`); continue; }
    problems.push(`${via.severity} ${name} ${id}${exp ? ` (acceptation expirée le ${exp})` : ''} : ${via.title}`);
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('npm audit : aucune faille high/critical non acceptée.');
