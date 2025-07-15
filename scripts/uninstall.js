#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('🧹 Cleaning up MCP Filesystem Server...');

// Windows自動起動の削除
if (process.platform === 'win32') {
  const startupPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
    'MCP-Filesystem-Server.lnk'
  );

  try {
    if (fs.existsSync(startupPath)) {
      fs.unlinkSync(startupPath);
      console.log('✅ Removed from Windows startup');
    }
  } catch (error) {
    console.error('⚠️  Could not remove from startup:', error.message);
  }

  // タスクスケジューラからも削除を試みる
  try {
    execSync('schtasks /delete /tn "MCPFilesystemServer" /f', { stdio: 'pipe' });
    console.log('✅ Removed from Task Scheduler');
  } catch (error) {
    // タスクが存在しない場合はエラーになるが、それは正常
  }
}

console.log('👋 MCP Filesystem Server uninstalled successfully');