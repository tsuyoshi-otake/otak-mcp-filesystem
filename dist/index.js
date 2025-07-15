#!/usr/bin/env node
// Built version of MCP Filesystem Server
// This file is transpiled at runtime using tsx

require('tsx/cjs');
module.exports = require('../src/index.ts');

// If running as a script
if (require.main === module) {
  require('../src/index.ts');
}
