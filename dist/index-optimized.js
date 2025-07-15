#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = require("fs");
// キャッシュ
const statCache = new Map();
const CACHE_TTL = 5000; // 5秒
// デフォルトディレクトリ
const DEFAULT_DIR = path_1.default.join(os_1.default.homedir(), 'Desktop', 'Otak');
// 許可されたディレクトリ
let allowedDirectory = DEFAULT_DIR;
let resolvedAllowedDirectory;
// パスが許可されたディレクトリ内にあるかチェック（最適化版）
function isPathAllowed(targetPath) {
    const resolvedPath = path_1.default.resolve(targetPath);
    return resolvedPath.startsWith(resolvedAllowedDirectory);
}
// 安全なパスに変換（最適化版）
function getSafePath(requestedPath) {
    if (!requestedPath || requestedPath === '.') {
        return allowedDirectory;
    }
    const fullPath = path_1.default.isAbsolute(requestedPath)
        ? requestedPath
        : path_1.default.join(allowedDirectory, requestedPath);
    const resolved = path_1.default.resolve(fullPath);
    if (!resolved.startsWith(resolvedAllowedDirectory)) {
        throw new Error(`Access denied: Path outside allowed directory (${allowedDirectory})`);
    }
    return resolved;
}
// キャッシュ付きstat
async function getCachedStat(filePath) {
    const cached = statCache.get(filePath);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.stats;
    }
    const stats = await promises_1.default.stat(filePath);
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
            const config = JSON.parse(args[0]);
            if (config.allowedDirectory) {
                allowedDirectory = path_1.default.resolve(config.allowedDirectory);
            }
        }
        catch (error) {
            console.error('Invalid configuration:', error);
        }
    }
    // 許可ディレクトリを事前に解決
    resolvedAllowedDirectory = path_1.default.resolve(allowedDirectory);
    // デフォルトディレクトリが存在しない場合は作成
    try {
        await promises_1.default.mkdir(allowedDirectory, { recursive: true });
        console.error(`Allowed directory: ${allowedDirectory}`);
    }
    catch (error) {
        console.error('Failed to create directory:', error);
    }
}
// 大きなファイルの読み取り用ストリーム
async function readLargeFile(filePath, maxSize = 10 * 1024 * 1024) {
    const stats = await getCachedStat(filePath);
    if (stats.size > maxSize) {
        // ストリーミング読み取り
        const chunks = [];
        let totalSize = 0;
        const stream = (0, fs_1.createReadStream)(filePath, {
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
    }
    else {
        // 小さいファイルは通常の読み取り
        return await promises_1.default.readFile(filePath, 'utf-8');
    }
}
const server = new index_js_1.Server({
    name: 'filesystem-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
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
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'list_directory': {
                const dirPath = getSafePath(args.path || '.');
                const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
                // バッチ処理でstat呼び出しを最適化
                const batchSize = 10;
                const result = [];
                for (let i = 0; i < entries.length; i += batchSize) {
                    const batch = entries.slice(i, i + batchSize);
                    const batchResults = await Promise.all(batch.map(async (entry) => {
                        const fullPath = path_1.default.join(dirPath, entry.name);
                        try {
                            const stats = await getCachedStat(fullPath);
                            return {
                                name: entry.name,
                                type: entry.isDirectory() ? 'directory' : 'file',
                                size: stats.size,
                                modified: stats.mtime.toISOString(),
                            };
                        }
                        catch (error) {
                            // アクセスできないファイルをスキップ
                            return {
                                name: entry.name,
                                type: entry.isDirectory() ? 'directory' : 'file',
                                size: 0,
                                modified: new Date().toISOString(),
                                error: 'Permission denied',
                            };
                        }
                    }));
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
                const filePath = getSafePath(args.path);
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
                const filePath = getSafePath(args.path);
                const content = args.content;
                // 親ディレクトリが存在しない場合は作成
                const dir = path_1.default.dirname(filePath);
                await promises_1.default.mkdir(dir, { recursive: true });
                // アトミックな書き込み
                const tempPath = `${filePath}.tmp`;
                await promises_1.default.writeFile(tempPath, content, 'utf-8');
                await promises_1.default.rename(tempPath, filePath);
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
                const dirPath = getSafePath(args.path);
                await promises_1.default.mkdir(dirPath, { recursive: true });
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
                const targetPath = getSafePath(args.path);
                const stats = await getCachedStat(targetPath);
                if (stats.isDirectory()) {
                    await promises_1.default.rm(targetPath, { recursive: true, force: true });
                }
                else {
                    await promises_1.default.unlink(targetPath);
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
    }
    catch (error) {
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
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('Filesystem MCP server (optimized) running on stdio');
}
main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
//# sourceMappingURL=index-optimized.js.map