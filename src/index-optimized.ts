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
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

// 設定
interface Config {
  allowedDirectory?: string;
}

// キャッシュ
const statCache = new Map<string, { stats: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5秒

// デフォルトディレクトリ
const DEFAULT_DIR = path.join(os.homedir(), 'Desktop', 'Otak');

// 許可されたディレクトリ
let allowedDirectory: string = DEFAULT_DIR;
let resolvedAllowedDirectory: string;

// パスが許可されたディレクトリ内にあるかチェック（最適化版）
function isPathAllowed(targetPath: string): boolean {
  const resolvedPath = path.resolve(targetPath);
  return resolvedPath.startsWith(resolvedAllowedDirectory);
}

// 安全なパスに変換（最適化版）
function getSafePath(requestedPath: string): string {
  if (!requestedPath || requestedPath === '.') {
    return allowedDirectory;
  }
  
  const fullPath = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.join(allowedDirectory, requestedPath);
    
  const resolved = path.resolve(fullPath);
  
  if (!resolved.startsWith(resolvedAllowedDirectory)) {
    throw new Error(`Access denied: Path outside allowed directory (${allowedDirectory})`);
  }
  
  return resolved;
}

// キャッシュ付きstat
async function getCachedStat(filePath: string) {
  const cached = statCache.get(filePath);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.stats;
  }
  
  const stats = await fs.stat(filePath);
  statCache.set(filePath, { stats, timestamp: now });
  
  // キャッシュサイズ制限
  if (statCache.size > 1000) {
    const firstKey = statCache.keys().next().value;
    statCache.delete(firstKey);
  }
  
  return stats;
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
  
  // 許可ディレクトリを事前に解決
  resolvedAllowedDirectory = path.resolve(allowedDirectory);
  
  // デフォルトディレクトリが存在しない場合は作成
  try {
    await fs.mkdir(allowedDirectory, { recursive: true });
    console.error(`Allowed directory: ${allowedDirectory}`);
  } catch (error) {
    console.error('Failed to create directory:', error);
  }
}

// 大きなファイルの読み取り用ストリーム
async function readLargeFile(filePath: string, maxSize: number = 10 * 1024 * 1024) { // 10MB
  const stats = await getCachedStat(filePath);
  
  if (stats.size > maxSize) {
    // ストリーミング読み取り
    const chunks: Buffer[] = [];
    let totalSize = 0;
    
    const stream = createReadStream(filePath, { 
      encoding: 'utf8',
      highWaterMark: 64 * 1024 // 64KB chunks
    });
    
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
      totalSize += chunk.length;
      
      if (totalSize > maxSize) {
        stream.destroy();
        return `[File truncated. Showing first ${maxSize} bytes of ${stats.size} bytes]\n` + 
               Buffer.concat(chunks).toString('utf8').substring(0, maxSize);
      }
    }
    
    return Buffer.concat(chunks).toString('utf8');
  } else {
    // 小さいファイルは通常の読み取り
    return await fs.readFile(filePath, 'utf-8');
  }
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

// ツール定義（静的に定義して再生成を避ける）
const TOOLS = [
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
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_directory': {
        const dirPath = getSafePath(args.path as string || '.');
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        // バッチ処理でstat呼び出しを最適化
        const batchSize = 10;
        const result = [];
        
        for (let i = 0; i < entries.length; i += batchSize) {
          const batch = entries.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (entry) => {
              const fullPath = path.join(dirPath, entry.name);
              try {
                const stats = await getCachedStat(fullPath);
                return {
                  name: entry.name,
                  type: entry.isDirectory() ? 'directory' : 'file',
                  size: stats.size,
                  modified: stats.mtime.toISOString(),
                };
              } catch (error) {
                // アクセスできないファイルをスキップ
                return {
                  name: entry.name,
                  type: entry.isDirectory() ? 'directory' : 'file',
                  size: 0,
                  modified: new Date().toISOString(),
                  error: 'Permission denied',
                };
              }
            })
          );
          result.push(...batchResults);
        }
        
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
        const content = await readLargeFile(filePath);
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
        
        // 親ディレクトリが存在しない場合は作成
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // アトミックな書き込み
        const tempPath = `${filePath}.tmp`;
        await fs.writeFile(tempPath, content, 'utf-8');
        await fs.rename(tempPath, filePath);
        
        // キャッシュをクリア
        statCache.delete(filePath);
        
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
        const stats = await getCachedStat(targetPath);
        
        if (stats.isDirectory()) {
          await fs.rm(targetPath, { recursive: true, force: true });
        } else {
          await fs.unlink(targetPath);
        }
        
        // キャッシュをクリア
        statCache.delete(targetPath);
        
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
  console.error('Filesystem MCP server (optimized) running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});