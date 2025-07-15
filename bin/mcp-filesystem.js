#!/usr/bin/env node

// Check if tsx is available, if not, use the bundled version
try {
  require.resolve('tsx');
  require('tsx');
  require('../src/index.ts');
} catch (error) {
  // Fall back to compiled version
  require('../dist/index.js');
}