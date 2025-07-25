# Filesystem MCP Server

ファイルシステム操作をサポートするMCP (Model Context Protocol) サーバーの実装です。SSEとHTTP Streamingに対応しています。

## セキュリティ機能

- **ディレクトリアクセス制限**: 指定されたディレクトリ内のみでファイル操作が可能
- **デフォルト制限**: 引数なしの場合は `~/Desktop/Otak` ディレクトリのみアクセス可能
- **パストラバーサル防止**: `../` などを使った親ディレクトリへのアクセスを防止

## ディレクトリアクセス仕様

### デフォルト動作
- 引数が指定されない場合、`~/Desktop/Otak` ディレクトリが自動的に作成されます
- すべてのファイル操作はこのディレクトリ内に制限されます

### カスタムディレクトリの指定
JSON形式の引数で `allowedDirectory` を指定することで、アクセス可能なディレクトリを変更できます：

```json
{"allowedDirectory": "/path/to/your/directory"}
```

### セキュリティ制限
- 指定されたディレクトリの外へのアクセスは拒否されます
- 相対パス（`../` など）を使用した親ディレクトリへのアクセスは防止されます
- シンボリックリンクを使用した制限回避も防止されます

## 機能

### 基本的なファイルシステム操作
- ディレクトリの一覧表示
- ファイルの読み取り
- ファイルの書き込み
- ディレクトリの作成
- ファイル/ディレクトリの削除

### SSE (Server-Sent Events) エンドポイント
- ファイル/ディレクトリの変更監視
- ログファイルのリアルタイムtail機能

## インストール

### NPMパッケージとしてインストール（推奨）

```bash
# グローバルインストール
npm install -g otak-mcp-filesystem

# または一回だけ実行
npx otak-mcp-filesystem
```

### ソースコードからの開発用インストール

```bash
git clone https://github.com/tsuyoshi-otake/otak-mcp-filesystem.git
cd otak-mcp-filesystem
npm install
npm run build
```

## 使用方法

### MCP標準サーバー (stdio)

#### NPMパッケージから実行

デフォルト設定（Desktop/Otakのみアクセス可能）:
```bash
# グローバルインストール後
otak-mcp-filesystem

# または直接実行
npx otak-mcp-filesystem
```

カスタムディレクトリを指定:
```bash
# グローバルインストール後
otak-mcp-filesystem '{"allowedDirectory": "~/Desktop/SmileCHAT"}'

# または直接実行
npx otak-mcp-filesystem '{"allowedDirectory": "~/Desktop/SmileCHAT"}'

# 絶対パスも使用可能
otak-mcp-filesystem '{"allowedDirectory": "/path/to/allowed/directory"}'
```

#### ソースコードから実行

デフォルト設定:
```bash
npm run dev
```

カスタムディレクトリを指定:
```bash
npm run dev -- '{"allowedDirectory": "/path/to/allowed/directory"}'
```

### Claude Desktop設定例

#### NPMパッケージを使用（推奨）

**デフォルト設定**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "otak-mcp-filesystem"
      ]
    }
  }
}
```
この設定では `~/Desktop/Otak` ディレクトリが自動的に作成され、使用されます。

**カスタムディレクトリを指定する場合**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "otak-mcp-filesystem",
        "{\"allowedDirectory\": \"C:/Users/username/Documents/MyProject\"}"
      ]
    }
  }
}
```

**グローバルインストール後の設定**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "otak-mcp-filesystem",
      "args": [
        "{\"allowedDirectory\": \"/path/to/your/directory\"}"
      ]
    }
  }
}
```

### HTTPサーバー（カスタムAPI）

#### NPMパッケージから実行
```bash
# グローバルインストール後
otak-mcp-filesystem-http

# または直接実行（要ソースコード）
npm run dev:http  # ポート 8766
```

### MCP HTTP/SSEサーバー（Claude連携用）

#### NPMパッケージから実行
```bash
# グローバルインストール後
otak-mcp-filesystem-mcp

# または直接実行（要ソースコード）
npm run dev:mcp  # ポート 8765
```


### ポート設定

環境変数またはenvファイルでポートを変更できます：

```bash
# 環境変数で指定
PORT=8080 npm run dev:http

# または.envファイル
cp .env.example .env
# .envを編集してPORTを設定
```

## APIエンドポイント

### ツール一覧の取得
```
GET /tools
```

### ツールの実行
```
POST /tools/:toolName
Content-Type: application/json

{
  "path": "/path/to/directory",
  "content": "file content (write_file only)"
}
```

### ファイル監視 (SSE)
```
GET /stream/watch?path=/path/to/watch
```

ファイルやディレクトリの変更をリアルタイムで監視します。

### ログファイルのtail (SSE)
```
GET /stream/tail?path=/path/to/file.log
```

ファイルの末尾10行を表示し、新しい内容が追加されたらリアルタイムで通知します。

## 利用可能なツール

### list_directory
指定されたディレクトリ内のファイルとサブディレクトリを一覧表示します。
- パラメータ: `path` (省略時は許可ディレクトリのルート)
- 戻り値: ファイル/ディレクトリの配列（名前、種類、サイズ、更新日時）

### read_file
指定されたファイルの内容を読み取ります。
- パラメータ: `path` (必須)
- 戻り値: ファイルの内容（テキスト）

### write_file
指定されたファイルに内容を書き込みます。
- パラメータ: `path` (必須), `content` (必須)
- 戻り値: 成功メッセージ

### create_directory
新しいディレクトリを作成します（再帰的に作成可能）。
- パラメータ: `path` (必須)
- 戻り値: 成功メッセージ

### delete_file
ファイルまたはディレクトリを削除します。
- パラメータ: `path` (必須)
- 戻り値: 成功メッセージ

**注意**: すべてのパスは許可されたディレクトリからの相対パス、または許可されたディレクトリ内の絶対パスである必要があります。

## ビルド（開発者向け）

```bash
npm run build
```

## プロダクション実行（開発者向け）

```bash
otak-mcp-filesystem        # stdio版
otak-mcp-filesystem-http   # HTTP版
otak-mcp-filesystem-mcp    # MCP HTTP/SSE版
```

## Windowsサービス化

Windows環境でMCPサーバーを常駐サービスとして動作させることができます。

### 前提条件

- Windows OS
- Node.js がインストールされている
- 管理者権限でコマンドプロンプトを実行

### サービスのインストール

```bash
# パッケージをグローバルインストール
npm install -g otak-mcp-filesystem

# デフォルト設定でサービスインストール（stdio MCP server）
otak-mcp-filesystem-service install

# カスタムディレクトリを指定してインストール
otak-mcp-filesystem-service install '{"allowedDirectory": "C:\\Users\\username\\Documents\\MyProject"}'

# HTTP サーバーとしてインストール
otak-mcp-filesystem-service install '{"serverType": "http"}'

# MCP HTTP/SSE サーバーとしてインストール
otak-mcp-filesystem-service install '{"serverType": "mcp"}'
```

### サービスの管理

```bash
# サービス開始
net start OtakMCPFilesystem

# サービス停止
net stop OtakMCPFilesystem

# サービスの状態確認
sc query OtakMCPFilesystem

# サービスのアンインストール
otak-mcp-filesystem-service uninstall
```

### サービス設定オプション

```json
{
  "allowedDirectory": "C:\\Users\\username\\Documents\\MyProject",
  "serviceName": "OtakMCPFilesystem",
  "displayName": "Otak MCP Filesystem Server",
  "description": "MCP server for secure filesystem operations",
  "serverType": "stdio"
}
```

**serverType オプション:**
- `stdio`: 標準入出力でMCPプロトコル（デフォルト）
- `http`: HTTPサーバー（ポート8766）
- `mcp`: MCP HTTP/SSEサーバー（ポート8765）

### サービスログ

Windowsサービスのログは Windows Event Viewer で確認できます：
1. Windows Event Viewer を開く
2. `Windows Logs` > `Application` を選択
3. `Source` が `OtakMCPFilesystem` のエントリを確認

## NPMパッケージの公開

GitHub Actionsを使用した自動公開:
1. **手動でバージョンアップ**: GitHub Actions > "Publish to NPM" > "Run workflow"
2. **タグを使用**: `git tag v1.0.1 && git push origin v1.0.1`