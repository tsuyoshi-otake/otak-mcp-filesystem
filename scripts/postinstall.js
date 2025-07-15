#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ensure dist directory exists for GitHub installs
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.log('📦 Building dist files...');
  require('./build.js');
}

console.log('✅ MCP Filesystem Server installed successfully');
console.log('📝 Run "otak-mcp-filesystem" to start the server');