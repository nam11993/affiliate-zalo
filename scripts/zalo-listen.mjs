import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPersonalZaloListener } from '../src/zalo/personal-adapter.mjs';

function loadSimpleEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
loadSimpleEnv(path.join(root, '.env'));

process.on('SIGINT', () => {
  console.log('\n👋 Đang dừng listener...');
  process.exit(0);
});

try {
  await startPersonalZaloListener();
} catch (error) {
  console.error('\n❌ Không thể khởi động Zalo listener:');
  console.error(error?.stack || error);
  process.exitCode = 1;
}
