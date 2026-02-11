#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'package.json');
const distIndexPath = path.join(repoRoot, 'dist', 'index.html');

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function fail(message) {
  console.error(`[build-artifact] ${message}`);
  process.exit(2);
}

if (!fs.existsSync(packageJsonPath)) {
  fail(`missing package.json: ${packageJsonPath}`);
}
if (!fs.existsSync(distIndexPath)) {
  fail(`missing build output: ${distIndexPath}`);
}

let version = '';
try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  version = String(pkg.version || '').trim();
} catch (error) {
  fail(`cannot parse package.json: ${error.message}`);
}

if (!version) {
  fail('package.json version is empty');
}

const targetPath = path.join(repoRoot, 'dist', `Tapnow Studio-V${version}.html`);
const indexHash = sha256(distIndexPath);

if (fs.existsSync(targetPath)) {
  const targetHash = sha256(targetPath);
  if (targetHash === indexHash) {
    console.log(`[build-artifact] unchanged: ${path.relative(repoRoot, targetPath)}`);
    process.exit(0);
  }

  if (process.env.ALLOW_RC_OVERWRITE !== '1') {
    fail(
      [
        `target exists and differs: ${path.relative(repoRoot, targetPath)}`,
        `current index hash: ${indexHash}`,
        `existing target hash: ${targetHash}`,
        'bump package version before build, or set ALLOW_RC_OVERWRITE=1 for explicit overwrite'
      ].join('\n')
    );
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  const overwrittenDir = path.join(repoRoot, 'dist', '_overwritten');
  fs.mkdirSync(overwrittenDir, { recursive: true });
  const backupName = `Tapnow Studio-V${version}.${stamp}.html`;
  const backupPath = path.join(overwrittenDir, backupName);
  fs.copyFileSync(targetPath, backupPath);
  console.log(`[build-artifact] backup before overwrite: ${path.relative(repoRoot, backupPath)}`);
}

fs.copyFileSync(distIndexPath, targetPath);
console.log(`[build-artifact] wrote: ${path.relative(repoRoot, targetPath)}`);
