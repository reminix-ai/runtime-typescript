#!/usr/bin/env tsx
/**
 * Bump version numbers across all packages in the monorepo.
 *
 * Usage:
 *   # Dry run to see what would change
 *   pnpm bump-version patch --dry-run
 *
 *   # Bump patch version (0.0.0 -> 0.0.1)
 *   pnpm bump-version patch
 *
 *   # Bump minor version (0.0.0 -> 0.1.0)
 *   pnpm bump-version minor
 *
 *   # Bump major version (0.0.0 -> 1.0.0)
 *   pnpm bump-version major
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

type BumpType = 'major' | 'minor' | 'patch';

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.');
  return [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
}

function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(version: string, bumpType: BumpType): string {
  const [major, minor, patch] = parseVersion(version);

  switch (bumpType) {
    case 'major':
      return formatVersion(major + 1, 0, 0);
    case 'minor':
      return formatVersion(major, minor + 1, 0);
    case 'patch':
      return formatVersion(major, minor, patch + 1);
  }
}

function isManagedPackage(filePath: string, root: string): boolean {
  const relPath = relative(root, filePath);
  const parts = relPath.split('/');
  return parts.includes('packages') && !parts.includes('examples');
}

function updatePackageJson(
  filePath: string,
  oldVersion: string,
  newVersion: string,
  root: string,
  dryRun: boolean
): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const data: PackageJson = JSON.parse(content);
  let changed = false;

  // For managed packages, always update version to new_version to keep them in sync
  if (data.version && isManagedPackage(filePath, root)) {
    if (data.version !== newVersion) {
      data.version = newVersion;
      changed = true;
    }
  }

  // Update dependencies that reference packages in packages/ directory
  // Look for packages that start with @reminix/ (our monorepo scope)
  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    if (data[depType]) {
      for (const pkg in data[depType]!) {
        // Only update @reminix/* packages
        if (pkg.startsWith('@reminix/')) {
          const current = data[depType]![pkg];
          const updated = updateDependencyVersion(current, oldVersion, newVersion);
          if (updated !== current) {
            data[depType]![pkg] = updated;
            changed = true;
          }
        }
      }
    }
  }

  if (changed) {
    if (!dryRun) {
      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    }
    return true;
  }
  return false;
}

function updateDependencyVersion(current: string, oldVersion: string, newVersion: string): string {
  if (current.startsWith('workspace:')) {
    return current;
  }

  const match = current.match(/^(>=|\^|~)?(\d+\.\d+\.\d+)$/);
  if (!match) {
    return current;
  }

  const prefix = match[1] ?? '';
  const version = match[2];
  if (version !== oldVersion) {
    return current;
  }

  return `${prefix}${newVersion}`;
}

function updateRuntimeVersionFiles(root: string, newVersion: string, dryRun: boolean): string[] {
  const updated: string[] = [];
  const runtimeVersion = join(root, 'packages', 'runtime', 'src', 'version.ts');
  const runtimeReadme = join(root, 'packages', 'runtime', 'README.md');

  try {
    const content = readFileSync(runtimeVersion, 'utf-8');
    const next = content.replace(
      /export const VERSION = '\d+\.\d+\.\d+';/,
      `export const VERSION = '${newVersion}';`
    );
    if (next !== content) {
      if (!dryRun) {
        writeFileSync(runtimeVersion, next, 'utf-8');
      }
      updated.push(runtimeVersion);
    }
  } catch {
    // ignore missing file
  }

  try {
    const content = readFileSync(runtimeReadme, 'utf-8');
    const next = content.replace(/"version":\s*"\d+\.\d+\.\d+"/g, `"version": "${newVersion}"`);
    if (next !== content) {
      if (!dryRun) {
        writeFileSync(runtimeReadme, next, 'utf-8');
      }
      updated.push(runtimeReadme);
    }
  } catch {
    // ignore missing file
  }

  return updated;
}

function findPackageJsonFiles(root: string, dir: string = root, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) {
      continue;
    }
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findPackageJsonFiles(root, fullPath, files);
    } else if (entry === 'package.json') {
      files.push(fullPath);
    }
  }
  return files;
}

function getCurrentVersion(root: string): string | null {
  // Look specifically in packages/ directory
  const packagesDir = join(root, 'packages');
  if (!statSync(packagesDir).isDirectory()) {
    return null;
  }

  const packageFiles = findPackageJsonFiles(root, packagesDir);

  for (const filePath of packageFiles) {
    const content = readFileSync(filePath, 'utf-8');
    const data: PackageJson = JSON.parse(content);
    if (data.version && isManagedPackage(filePath, root)) {
      return data.version;
    }
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const bumpType = args[0] as BumpType;
  const dryRun = args.includes('--dry-run');

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('Usage: bump-version <major|minor|patch> [--dry-run]');
    process.exit(1);
  }

  const root = process.cwd();
  const currentVersion = getCurrentVersion(root);

  if (!currentVersion) {
    console.error('Error: Could not determine current version');
    process.exit(1);
  }

  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`Bumping version from ${currentVersion} to ${newVersion} (${bumpType})`);
  if (dryRun) {
    console.log('\n[DRY RUN] Would update the following files:');
  } else {
    console.log('\nUpdating files...');
  }

  let updatedCount = 0;

  // Update TypeScript packages (only in packages/, not root or examples/)
  const packageFiles = findPackageJsonFiles(root);

  for (const filePath of packageFiles) {
    const relPath = relative(root, filePath);
    const parts = relPath.split('/');

    // Skip root and examples
    if (parts.length === 1 || parts.includes('examples')) {
      continue;
    }

    if (updatePackageJson(filePath, currentVersion, newVersion, root, dryRun)) {
      console.log(`  ✓ ${relPath}`);
      updatedCount++;
    }
  }

  for (const updatedFile of updateRuntimeVersionFiles(root, newVersion, dryRun)) {
    console.log(`  ✓ ${relative(root, updatedFile)}`);
    updatedCount++;
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Would update ${updatedCount} files`);
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log(`\n✓ Updated ${updatedCount} files`);
    console.log(`\nNew version: ${newVersion}`);
    console.log('\nNext steps:');
    console.log('  1. Review the changes');
    console.log('  2. Commit the version bump');
    console.log(`  3. Tag the release: git tag v${newVersion}`);
  }
}

main();
