#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// 設定
interface Config {
  allowedDirectory?: string;
}

// Windows自動起動設定
async function setupWindowsAutoStart(action: string, allowedDirectory: string) {
  if (process.platform !== 'win32') {
    console.error('This feature is only available on Windows');
    process.exit(1);
  }

  const startupPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const shortcutPath = path.join(startupPath, 'MCP-Filesystem-Server.lnk');

  switch (action) {
    case '--install-startup':
      // PowerShellでショートカット作成
      const script = `
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
        $Shortcut.TargetPath = "node"
        $Shortcut.Arguments = "${__filename} '{\\"allowedDirectory\\":\\"${allowedDirectory.replace(/\\/g, '\\\\')}\\"}'"
        $Shortcut.WorkingDirectory = "${path.dirname(__filename)}"
        $Shortcut.IconLocation = "shell32.dll,3"
        $Shortcut.Description = "MCP Filesystem Server"
        $Shortcut.Save()
      `;
      
      try {
        execSync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
        console.log(`✓ Installed to Windows startup folder`);
        console.log(`  Location: ${shortcutPath}`);
        console.log(`  Allowed directory: ${allowedDirectory}`);
      } catch (error) {
        console.error('Failed to create startup shortcut:', error);
        process.exit(1);
      }
      break;

    case '--uninstall-startup':
      try {
        await fs.unlink(shortcutPath);
        console.log('✓ Removed from Windows startup');
      } catch (error) {
        console.error('Not found in startup folder');
      }
      break;

    case '--install-task':
      // タスクスケジューラに登録
      const taskName = 'MCPFilesystemServer';
      const taskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${os.userInfo().username}</UserId>
    </LogonTrigger>
  </Triggers>
  <Settings>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <StartWhenAvailable>true</StartWhenAvailable>
  </Settings>
  <Actions>
    <Exec>
      <Command>node</Command>
      <Arguments>"${__filename}" "{\\"allowedDirectory\\":\\"${allowedDirectory.replace(/\\/g, '\\\\')}\\"}"</Arguments>
      <WorkingDirectory>${path.dirname(__filename)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;
      
      try {
        const tempFile = path.join(os.tmpdir(), 'mcp-task.xml');
        await fs.writeFile(tempFile, taskXml, 'utf16le');
        execSync(`schtasks /create /tn "${taskName}" /xml "${tempFile}" /f`, { stdio: 'inherit' });
        await fs.unlink(tempFile);
        console.log(`✓ Installed to Task Scheduler`);
        console.log(`  Task name: ${taskName}`);
        console.log(`  Allowed directory: ${allowedDirectory}`);
      } catch (error) {
        console.error('Failed to create scheduled task:', error);
        process.exit(1);
      }
      break;

    case '--uninstall-task':
      try {
        execSync('schtasks /delete /tn "MCPFilesystemServer" /f', { stdio: 'inherit' });
        console.log('✓ Removed from Task Scheduler');
      } catch (error) {
        console.error('Task not found');
      }
      break;

    default:
      console.error('Unknown action:', action);
      process.exit(1);
  }
}

// コマンドライン引数をチェック
const args = process.argv.slice(2);
if (args.length > 0 && args[0].startsWith('--')) {
  const action = args[0];
  const configArg = args[1];
  let allowedDirectory = path.join(os.homedir(), 'Desktop', 'Otak');
  
  if (configArg) {
    try {
      const config: Config = JSON.parse(configArg);
      if (config.allowedDirectory) {
        allowedDirectory = path.resolve(config.allowedDirectory);
      }
    } catch (error) {
      console.error('Invalid configuration:', error);
    }
  }
  
  setupWindowsAutoStart(action, allowedDirectory).then(() => process.exit(0));
  return;
}

// デフォルトディレクトリ
const DEFAULT_DIR = path.join(os.homedir(), 'Desktop', 'Otak');

// 許可されたディレクトリ
let allowedDirectory: string = DEFAULT_DIR;

// パスが許可されたディレクトリ内にあるかチェック
function isPathAllowed(targetPath: string): boolean {
  const resolvedPath = path.resolve(targetPath);
  const resolvedAllowed = path.resolve(allowedDirectory);
  return resolvedPath.startsWith(resolvedAllowed);
}

// 安全なパスに変換
function getSafePath(requestedPath: string): string {
  // 絶対パスの場合
  if (path.isAbsolute(requestedPath)) {
    if (!isPathAllowed(requestedPath)) {
      throw new Error(`Access denied: Path outside allowed directory (${allowedDirectory})`);
    }
    return requestedPath;
  }
  
  // 相対パスの場合は許可されたディレクトリからの相対パスとして解釈
  const fullPath = path.join(allowedDirectory, requestedPath);
  if (!isPathAllowed(fullPath)) {
    throw new Error(`Access denied: Path outside allowed directory (${allowedDirectory})`);
  }
  return fullPath;
}

// Windows自動起動のチェックと登録
async function checkAndSetupAutoStart() {
  if (process.platform !== 'win32') return;
  
  const startupPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const shortcutPath = path.join(startupPath, 'MCP-Filesystem-Server.lnk');
  
  try {
    // ショートカットが存在するかチェック
    await fs.access(shortcutPath);
    // 既に登録済み
  } catch {
    // 未登録なので自動登録
    console.error('🔧 Windows自動起動に登録しています...');
    
    const script = `
      $WshShell = New-Object -ComObject WScript.Shell
      $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
      $Shortcut.TargetPath = "node"
      $Shortcut.Arguments = "${__filename} '{\\"allowedDirectory\\":\\"${allowedDirectory.replace(/\\/g, '\\\\')}\\"}'"
      $Shortcut.WorkingDirectory = "${path.dirname(__filename)}"
      $Shortcut.IconLocation = "shell32.dll,3"
      $Shortcut.Description = "MCP Filesystem Server"
      $Shortcut.Save()
    `;
    
    try {
      execSync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
      console.error('✅ Windows起動時に自動的に開始されるよう設定しました');
      console.error(`📁 許可ディレクトリ: ${allowedDirectory}`);
      console.error('');
      console.error('🔓 自動起動を解除するには:');
      console.error('   npx @tsuyoshi-otake/mcp-filesystem --uninstall-startup');
      console.error('');
    } catch (error) {
      // 登録失敗（権限不足など）- エラーは表示しない
    }
  }
}

// 初期化処理
async function initialize() {
  // コマンドライン引数から設定を取得
  const args = process.argv.slice(2);
  if (args.length > 0) {
    try {
      const config: Config = JSON.parse(args[0]);
      if (config.allowedDirectory) {
        allowedDirectory = path.resolve(config.allowedDirectory);
      }
    } catch (error) {
      console.error('Invalid configuration:', error);
    }
  }
  
  // デフォルトディレクトリが存在しない場合は作成
  try {
    await fs.mkdir(allowedDirectory, { recursive: true });
    console.error(`Allowed directory: ${allowedDirectory}`);
  } catch (error) {
    console.error('Failed to create directory:', error);
  }
  
  // Windows自動起動のチェックと登録
  await checkAndSetupAutoStart();
}

const server = new Server(
  {
    name: 'filesystem-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_directory',
        description: 'List files and directories in a given path',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The directory path to list',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to read',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to write to',
            },
            content: {
              type: 'string',
              description: 'The content to write',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'create_directory',
        description: 'Create a new directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The directory path to create',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'delete_file',
        description: 'Delete a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file or directory path to delete',
            },
          },
          required: ['path'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_directory': {
        const dirPath = getSafePath(args.path as string || '.');
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const result = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(dirPath, entry.name);
            const stats = await fs.stat(fullPath);
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString(),
            };
          })
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'read_file': {
        const filePath = getSafePath(args.path as string);
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      }

      case 'write_file': {
        const filePath = getSafePath(args.path as string);
        const content = args.content as string;
        await fs.writeFile(filePath, content, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `File written successfully to ${filePath}`,
            },
          ],
        };
      }

      case 'create_directory': {
        const dirPath = getSafePath(args.path as string);
        await fs.mkdir(dirPath, { recursive: true });
        return {
          content: [
            {
              type: 'text',
              text: `Directory created successfully at ${dirPath}`,
            },
          ],
        };
      }

      case 'delete_file': {
        const targetPath = getSafePath(args.path as string);
        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
          await fs.rm(targetPath, { recursive: true, force: true });
        } else {
          await fs.unlink(targetPath);
        }
        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted ${targetPath}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  await initialize();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Filesystem MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});