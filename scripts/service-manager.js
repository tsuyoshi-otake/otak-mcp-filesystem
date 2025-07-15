#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function showHelp() {
  console.log(`
Otak MCP Filesystem Service Manager

Usage:
  otak-mcp-filesystem-service <command> [options]

Commands:
  install             Install Windows service
  uninstall           Uninstall Windows service
  help                Show this help message

Options:
  --type, -t          Server type: stdio, http, mcp (default: stdio)
  --dir, -d           Allowed directory path (default: ~/Desktop/Otak)
  --name, -n          Service name (default: OtakMCPFilesystem)
  --display           Display name (default: Otak MCP Filesystem Server)

Install Examples:
  otak-mcp-filesystem-service install
  otak-mcp-filesystem-service install --type mcp
  otak-mcp-filesystem-service install -t http
  otak-mcp-filesystem-service install --dir C:\\Users\\username\\Documents\\MyProject
  otak-mcp-filesystem-service install -d ~/Desktop/SmileCHAT
  otak-mcp-filesystem-service install --type mcp --dir C:\\Projects\\MyApp

Uninstall Examples:
  otak-mcp-filesystem-service uninstall
  otak-mcp-filesystem-service uninstall --name OtakMCPFilesystemHTTP
`);
}

function runScript(scriptName, args) {
  const scriptPath = path.join(__dirname, scriptName);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Script not found: ${scriptPath}`);
    process.exit(1);
  }

  const child = spawn('node', [scriptPath, ...args], {
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    process.exit(code);
  });

  child.on('error', (error) => {
    console.error(`❌ Failed to run script: ${error.message}`);
    process.exit(1);
  });
}


function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    process.exit(1);
  }

  const command = args[0].toLowerCase();
  const options = args.slice(1);

  switch (command) {
    case 'install':
      console.log('📦 Installing Otak MCP Filesystem Windows Service...');
      runScript('install-service.js', options);
      break;
    
    case 'uninstall':
      console.log('🗑️  Uninstalling Otak MCP Filesystem Windows Service...');
      runScript('uninstall-service.js', options);
      break;
    
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    
    default:
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { showHelp, runScript, main };