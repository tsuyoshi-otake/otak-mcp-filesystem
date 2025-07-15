"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// CORS設定
app.use((req, res, next) => {
    // すべてのオリジンを許可
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Max-Age', '86400');
    // OPTIONSリクエストに対して即座に200を返す
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
app.use(express_1.default.json());
// MCPサーバーの作成
const mcpServer = new index_js_1.Server({
    name: 'filesystem-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// ツール一覧の定義
mcpServer.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
// ツール実行ハンドラ
mcpServer.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'list_directory': {
                const dirPath = args.path;
                const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
                const result = await Promise.all(entries.map(async (entry) => {
                    const fullPath = path_1.default.join(dirPath, entry.name);
                    const stats = await promises_1.default.stat(fullPath);
                    return {
                        name: entry.name,
                        type: entry.isDirectory() ? 'directory' : 'file',
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                    };
                }));
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
                const filePath = args.path;
                const content = await promises_1.default.readFile(filePath, 'utf-8');
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
                const filePath = args.path;
                const content = args.content;
                await promises_1.default.writeFile(filePath, content, 'utf-8');
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
                const dirPath = args.path;
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
                const targetPath = args.path;
                const stats = await promises_1.default.stat(targetPath);
                if (stats.isDirectory()) {
                    await promises_1.default.rm(targetPath, { recursive: true, force: true });
                }
                else {
                    await promises_1.default.unlink(targetPath);
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
// MCPエンドポイント - GET (情報表示)
app.get('/mcp', (req, res) => {
    res.json({
        message: 'MCP Server is running',
        version: '1.0.0',
        endpoints: {
            post: '/mcp - JSON-RPC requests',
            sse: '/sse - Server-Sent Events stream',
            health: '/health - Health check'
        }
    });
});
// MCPエンドポイント - SSE接続
app.get('/sse', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
    const transport = new sse_js_1.SSEServerTransport('/message', res);
    await mcpServer.connect(transport);
});
// MCPエンドポイント - HTTP POST
app.post('/mcp', async (req, res) => {
    console.log('Received MCP request:', req.body);
    // シンプルなリクエスト/レスポンス処理
    const request = req.body;
    // Notificationの場合はレスポンスを返さない
    if (!request.id && request.method === 'notifications/initialized') {
        console.log('Received initialized notification');
        res.status(200).end();
        return;
    }
    try {
        if (request.method === 'initialize') {
            res.json({
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    protocolVersion: '2025-06-18',
                    capabilities: {
                        tools: {},
                    },
                    serverInfo: {
                        name: 'filesystem-mcp-server',
                        version: '1.0.0',
                    },
                },
            });
        }
        else if (request.method === 'tools/list') {
            // 直接ツール一覧を返す
            res.json({
                jsonrpc: '2.0',
                id: request.id,
                result: {
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
                },
            });
        }
        else if (request.method === 'tools/call') {
            // ツール実行のロジック
            const { name, arguments: args } = request.params;
            try {
                let result;
                switch (name) {
                    case 'list_directory': {
                        const dirPath = args.path;
                        const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
                        const fileList = await Promise.all(entries.map(async (entry) => {
                            const fullPath = path_1.default.join(dirPath, entry.name);
                            const stats = await promises_1.default.stat(fullPath);
                            return {
                                name: entry.name,
                                type: entry.isDirectory() ? 'directory' : 'file',
                                size: stats.size,
                                modified: stats.mtime.toISOString(),
                            };
                        }));
                        result = {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(fileList, null, 2),
                                },
                            ],
                        };
                        break;
                    }
                    case 'read_file': {
                        const filePath = args.path;
                        const content = await promises_1.default.readFile(filePath, 'utf-8');
                        result = {
                            content: [
                                {
                                    type: 'text',
                                    text: content,
                                },
                            ],
                        };
                        break;
                    }
                    case 'write_file': {
                        const filePath = args.path;
                        const content = args.content;
                        await promises_1.default.writeFile(filePath, content, 'utf-8');
                        result = {
                            content: [
                                {
                                    type: 'text',
                                    text: `File written successfully to ${filePath}`,
                                },
                            ],
                        };
                        break;
                    }
                    case 'create_directory': {
                        const dirPath = args.path;
                        await promises_1.default.mkdir(dirPath, { recursive: true });
                        result = {
                            content: [
                                {
                                    type: 'text',
                                    text: `Directory created successfully at ${dirPath}`,
                                },
                            ],
                        };
                        break;
                    }
                    case 'delete_file': {
                        const targetPath = args.path;
                        const stats = await promises_1.default.stat(targetPath);
                        if (stats.isDirectory()) {
                            await promises_1.default.rm(targetPath, { recursive: true, force: true });
                        }
                        else {
                            await promises_1.default.unlink(targetPath);
                        }
                        result = {
                            content: [
                                {
                                    type: 'text',
                                    text: `Successfully deleted ${targetPath}`,
                                },
                            ],
                        };
                        break;
                    }
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
                res.json({
                    jsonrpc: '2.0',
                    id: request.id,
                    result,
                });
            }
            catch (error) {
                res.json({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    },
                });
            }
        }
        else {
            res.json({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32601,
                    message: `Method not found: ${request.method}`,
                },
            });
        }
    }
    catch (error) {
        console.error('MCP request error:', error);
        res.json({
            jsonrpc: '2.0',
            id: request.id,
            error: {
                code: -32603,
                message: error instanceof Error ? error.message : 'Internal error',
            },
        });
    }
});
// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({ status: 'ok', name: 'filesystem-mcp-server', version: '1.0.0' });
});
const PORT = parseInt(process.env.PORT || '8765', 10);
const HOST = process.env.HOST || 'localhost';
app.listen(PORT, HOST, () => {
    console.log(`Filesystem MCP HTTP/SSE server running on ${HOST}:${PORT}`);
    console.log(`MCP HTTP endpoint: http://${HOST}:${PORT}/mcp`);
    console.log(`MCP SSE endpoint: http://${HOST}:${PORT}/sse`);
    console.log(`Health check: http://${HOST}:${PORT}/health`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please specify a different port using the PORT environment variable.`);
    }
    else {
        console.error('Server error:', err);
    }
    process.exit(1);
});
//# sourceMappingURL=mcp-http-server.js.map