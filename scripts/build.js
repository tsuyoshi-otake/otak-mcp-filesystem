#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Create dist directory
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy index.js
const indexContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
const jsContent = `#!/usr/bin/env node
// Built version of MCP Filesystem Server
// This file is transpiled at runtime using tsx

require('tsx/cjs');
module.exports = require('../src/index.ts');

// If running as a script
if (require.main === module) {
  require('../src/index.ts');
}
`;

fs.writeFileSync(path.join(distDir, 'index.js'), jsContent);
fs.chmodSync(path.join(distDir, 'index.js'), '755');

console.log('Build completed successfully');