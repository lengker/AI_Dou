import { existsSync, symlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const linkPath = join(publicDir, 'DOU');
const targetPath = join(root, 'DOU');

mkdirSync(publicDir, { recursive: true });

if (existsSync(linkPath)) {
  console.log('public/DOU already exists, skip.');
  process.exit(0);
}

try {
  symlinkSync(targetPath, linkPath, 'junction');
  console.log('Created public/DOU -> DOU');
} catch (err) {
  console.error('Failed to create symlink. On Windows run as admin, or manually:');
  console.error(`  mklink /J "${linkPath}" "${targetPath}"`);
  console.error(err);
  process.exit(1);
}
