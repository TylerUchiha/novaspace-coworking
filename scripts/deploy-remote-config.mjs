/**
 * Publish Remote Config template from remote-config.template.json
 *
 * Usage: node scripts/deploy-remote-config.mjs
 *
 * Requires: firebase login + project refined-legend-420223
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const templatePath = path.join(process.cwd(), 'remote-config.template.json');
if (!fs.existsSync(templatePath)) {
  console.error('remote-config.template.json not found');
  process.exit(1);
}

execSync('firebase deploy --only remoteconfig --project refined-legend-420223', {
  stdio: 'inherit',
});
console.log('Remote Config template published.');
