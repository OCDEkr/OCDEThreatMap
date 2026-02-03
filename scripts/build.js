#!/usr/bin/env node

/**
 * Build Script for OCDE Threat Map
 * Creates standalone executables for Linux, macOS, and Windows
 *
 * Usage: npm run build [platform]
 * Platforms: linux, macos, windows, all (default)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Build targets (pkg supports up to node18)
const TARGETS = {
  linux: { target: 'node18-linux-x64', output: 'ocde-threat-map-linux', ext: '' },
  macos: { target: 'node18-macos-x64', output: 'ocde-threat-map-macos', ext: '' },
  windows: { target: 'node18-win-x64', output: 'ocde-threat-map-win', ext: '.exe' }
};

// Files to include in distribution
const DIST_FILES = [
  { src: '.env.example', dest: '.env.example' },
  { src: 'README.md', dest: 'README.md' },
  { src: 'LICENSE', dest: 'LICENSE', optional: true }
];

// Directories to copy
const DIST_DIRS = [
  { src: 'public', dest: 'public' },
  { src: 'data', dest: 'data', createEmpty: true }
];

function log(msg) {
  console.log(`[BUILD] ${msg}`);
}

function error(msg) {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function clean() {
  log('Cleaning dist directory...');
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  ensureDir(DIST_DIR);
}

function checkPkg() {
  try {
    execSync('npx pkg --version', { stdio: 'pipe' });
  } catch {
    log('Installing pkg...');
    execSync('npm install --save-dev pkg', { cwd: ROOT_DIR, stdio: 'inherit' });
  }
}

function buildBinary(platform) {
  const config = TARGETS[platform];
  if (!config) {
    error(`Unknown platform: ${platform}`);
  }

  const outputPath = path.join(DIST_DIR, platform);
  ensureDir(outputPath);

  const outputFile = path.join(outputPath, config.output + config.ext);

  log(`Building for ${platform}...`);

  try {
    execSync(
      `npx pkg . --target ${config.target} --output "${outputFile}"`,
      { cwd: ROOT_DIR, stdio: 'inherit' }
    );
    log(`Created: ${outputFile}`);
  } catch (err) {
    error(`Build failed for ${platform}: ${err.message}`);
  }

  return outputPath;
}

function copyDistFiles(destDir) {
  log('Copying distribution files...');

  // Copy individual files
  for (const file of DIST_FILES) {
    const srcPath = path.join(ROOT_DIR, file.src);
    const destPath = path.join(destDir, file.dest);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log(`  Copied: ${file.dest}`);
    } else if (!file.optional) {
      log(`  Warning: ${file.src} not found`);
    }
  }

  // Copy directories
  for (const dir of DIST_DIRS) {
    const srcPath = path.join(ROOT_DIR, dir.src);
    const destPath = path.join(destDir, dir.dest);

    if (fs.existsSync(srcPath)) {
      copyDir(srcPath, destPath);
      log(`  Copied: ${dir.dest}/`);
    } else if (dir.createEmpty) {
      ensureDir(destPath);
      log(`  Created: ${dir.dest}/`);
    }
  }
}

function createStartScript(destDir, platform) {
  const config = TARGETS[platform];
  const binary = config.output + config.ext;

  if (platform === 'windows') {
    // Windows batch file
    const batContent = `@echo off
echo Starting OCDE Threat Map...
echo.
echo Make sure to:
echo   1. Place GeoLite2-City.mmdb in the data folder
echo   2. Copy .env.example to .env and configure it
echo.
${binary} %*
pause
`;
    fs.writeFileSync(path.join(destDir, 'start.bat'), batContent);
    log('  Created: start.bat');
  } else {
    // Unix shell script
    const shContent = `#!/bin/bash
echo "Starting OCDE Threat Map..."
echo ""
echo "Make sure to:"
echo "  1. Place GeoLite2-City.mmdb in the data folder"
echo "  2. Copy .env.example to .env and configure it"
echo ""

# Check for root (needed for port 514)
if [ "$SYSLOG_PORT" != "" ] && [ "$SYSLOG_PORT" -lt 1024 ] && [ "$EUID" -ne 0 ]; then
  echo "Warning: Port $SYSLOG_PORT requires root privileges"
  echo "Run with sudo or set SYSLOG_PORT to a higher port (e.g., 5514)"
fi

./${binary} "$@"
`;
    const scriptPath = path.join(destDir, 'start.sh');
    fs.writeFileSync(scriptPath, shContent);
    fs.chmodSync(scriptPath, '755');
    log('  Created: start.sh');
  }
}

function createReadmeAddendum(destDir) {
  const content = `# OCDE Threat Map - Standalone Distribution

## Quick Start

1. **Download MaxMind Database**
   - Get GeoLite2-City.mmdb from https://www.maxmind.com/en/geolite2/signup
   - Place it in the \`data/\` folder

2. **Configure Environment**
   - Copy \`.env.example\` to \`.env\`
   - Edit \`.env\` with your settings

3. **Run the Application**
   - Linux/macOS: \`./start.sh\` or \`./ocde-threat-map-*\`
   - Windows: \`start.bat\` or \`ocde-threat-map-win.exe\`

4. **Access Dashboard**
   - Open http://localhost:3000 in your browser

## Notes

- Port 514 requires root/admin privileges
- Use \`SYSLOG_PORT=5514\` for development without root
- The \`public/\` folder must remain alongside the executable
- The \`data/\` folder stores the MaxMind database and uploaded logos

## Troubleshooting

If the application won't start:
- Ensure the \`public/\` folder is in the same directory as the executable
- Verify the MaxMind database is in the \`data/\` folder
- Check that \`.env\` file exists and is configured
`;
  fs.writeFileSync(path.join(destDir, 'QUICKSTART.md'), content);
  log('  Created: QUICKSTART.md');
}

async function main() {
  const args = process.argv.slice(2);
  const platform = args[0] || 'all';

  console.log('========================================');
  console.log('OCDE Threat Map - Build Script');
  console.log('========================================\n');

  // Check for pkg
  checkPkg();

  // Clean dist directory
  clean();

  // Determine which platforms to build
  const platforms = platform === 'all'
    ? Object.keys(TARGETS)
    : [platform];

  // Build each platform
  for (const p of platforms) {
    const outputDir = buildBinary(p);
    copyDistFiles(outputDir);
    createStartScript(outputDir, p);
    createReadmeAddendum(outputDir);
    console.log('');
  }

  console.log('========================================');
  console.log('Build complete!');
  console.log('========================================');
  console.log(`\nOutput directory: ${DIST_DIR}`);
  console.log('\nBuilt packages:');
  for (const p of platforms) {
    console.log(`  - dist/${p}/`);
  }
  console.log('\nRemember to include the MaxMind GeoLite2-City.mmdb database');
  console.log('in the data/ folder when distributing.\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
