import { readFileSync } from 'node:fs';

function readSql(path, exportName) {
  const source = readFileSync(path, 'utf8');
  const marker = `export const ${exportName} = \``;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find ${exportName} in ${path}`);
  const bodyStart = start + marker.length;
  const end = source.indexOf('\`;', bodyStart);
  if (end === -1) throw new Error(`Could not find the end of ${exportName} in ${path}`);
  return source.slice(bodyStart, end);
}

const initial = readSql('src/db/migrations/001_initial.ts', 'initialSchemaSql');
const reliability = readSql('src/db/migrations/002_reliability.ts', 'reliabilitySchemaSql');
const dueAt = new Date(2026, 7, 11).getTime();
const deletedAt = dueAt + 1;

process.stdout.write(`${initial}
  INSERT INTO categories VALUES ('cat', 'Work', NULL, NULL, 0, 0, 1, 1, NULL);
  INSERT INTO tasks VALUES ('task', 'Example', NULL, 'cat', ${dueAt}, 540, 'pending', 0, NULL, 0, 1, 1, ${deletedAt});
  INSERT INTO subtasks VALUES ('sub', 'task', 'Child', 'pending', 0, 1, 1, NULL);
  INSERT INTO task_repeat_rules VALUES ('rule', 'task', 'monthly', 2, NULL, 11, NULL, NULL, 1, 1, NULL);
${reliability}
`);
