#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

console.log('🚀 Installing otak-mcp-filesystem...\n');

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/tsuyoshi-otake/otak-mcp-filesystem/releases/latest',
      headers: {
        'User-Agent': 'otak-mcp-installer'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const asset = release.assets?.find(a => a.name === 'otak-mcp-filesystem.tgz');
          if (!asset) {
            reject(new Error('Release asset not found. The first release may not be ready yet.'));
          } else {
            resolve(asset.browser_download_url);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, { headers: { 'User-Agent': 'otak-mcp-installer' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        file.close();
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function install() {
  try {
    // Get latest release URL
    console.log('📦 Fetching latest release...');
    const downloadUrl = await getLatestRelease();
    console.log(`✓ Found latest release\n`);

    // Download to temp
    const tempFile = path.join(os.tmpdir(), 'otak-mcp-filesystem.tgz');
    console.log('📥 Downloading package...');
    await downloadFile(downloadUrl, tempFile);
    console.log(`✓ Downloaded successfully\n`);

    // Install globally
    console.log('📦 Installing package globally...');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const install = spawn(npm, ['install', '-g', tempFile], { stdio: 'inherit' });

    install.on('close', (code) => {
      // Clean up
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
      
      if (code === 0) {
        console.log('\n✅ Installation complete!');
        console.log('🎯 Run "otak-mcp-filesystem" to start the server');
        console.log('\n📝 Claude Desktop configuration:');
        console.log(JSON.stringify({
          mcpServers: {
            filesystem: {
              command: "otak-mcp-filesystem",
              args: []
            }
          }
        }, null, 2));
      } else {
        console.error('\n❌ Installation failed');
        process.exit(code);
      }
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Fallback instructions
    console.log('\n📝 Manual installation:');
    console.log('1. Visit: https://github.com/tsuyoshi-otake/otak-mcp-filesystem/releases/latest');
    console.log('2. Download: otak-mcp-filesystem.tgz');
    console.log('3. Run: npm install -g otak-mcp-filesystem.tgz');
    
    process.exit(1);
  }
}

// Check if npm is available
const npmCheck = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version']);
npmCheck.on('error', () => {
  console.error('❌ npm is not installed or not in PATH');
  console.error('Please install Node.js from https://nodejs.org/');
  process.exit(1);
});

npmCheck.on('close', () => {
  install();
});