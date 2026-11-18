import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await check(file);
    else if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { stdio: 'inherit' });
      if (result.status !== 0) process.exitCode = 1;
    }
  }
}
await check(new URL('../', import.meta.url));
if (!process.exitCode) console.log('Sintaks semua file JavaScript valid.');
