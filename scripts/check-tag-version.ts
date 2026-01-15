import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const tag = process.env.GITHUB_REF_NAME?.replace(/^v/, '');

if (!tag) {
  console.error('GITHUB_REF_NAME is not set.');
  process.exit(1);
}

const packagesDir = join(process.cwd(), 'packages');
const entries = readdirSync(packagesDir, { withFileTypes: true }).filter((entry) =>
  entry.isDirectory()
);

const mismatches: string[] = [];

for (const entry of entries) {
  const pkgPath = join(packagesDir, entry.name, 'package.json');
  const data = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  if (data.version !== tag) {
    mismatches.push(`${entry.name}: ${data.version}`);
  }
}

if (mismatches.length) {
  console.error(`Tag v${tag} does not match package versions:`);
  for (const item of mismatches) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}
