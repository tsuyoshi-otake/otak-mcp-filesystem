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

### グローバルインストール

#### Windows (PowerShell)
```powershell
# ワンライナーインストール
irm https://raw.githubusercontent.com/tsuyoshi-otake/otak-mcp-filesystem/main/install.ps1 | iex

# または手動で
curl -L https://github.com/tsuyoshi-otake/otak-mcp-filesystem/releases/latest/download/otak-mcp-filesystem.tgz -o otak-mcp-filesystem.tgz
npm install -g otak-mcp-filesystem.tgz
```

#### macOS/Linux
```bash
# ワンライナーインストール
curl -sSL https://raw.githubusercontent.com/tsuyoshi-otake/otak-mcp-filesystem/main/install.sh | bash

# または手動で
curl -L https://github.com/tsuyoshi-otake/otak-mcp-filesystem/releases/latest/download/otak-mcp-filesystem.tgz -o otak-mcp-filesystem.tgz
npm install -g otak-mcp-filesystem.tgz
```

#### 開発版インストール
```bash
git clone https://github.com/tsuyoshi-otake/otak-mcp-filesystem.git
cd otak-mcp-filesystem
npm install
npm run build
npm link
```

### ローカル開発

```bash
npm install
```

## 使用方法

### MCP標準サーバー (stdio)

デフォルト設定（Desktop/Otakのみアクセス可能）:
```bash
npm run dev
```

カスタムディレクトリを指定:
```bash
npm run dev -- '{"allowedDirectory": "/path/to/allowed/directory"}'
```

### Claude Desktop設定例

#### デフォルト設定（推奨）
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "otak-mcp-filesystem",
      "args": []
    }
  }
}
```
この設定では `~/Desktop/Otak` ディレクトリが自動的に作成され、使用されます。

#### カスタムディレクトリを指定する場合
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "otak-mcp-filesystem",
      "args": [
        "{\"allowedDirectory\": \"C:/Users/username/Documents/MyProject\"}"
      ]
    }
  }
}
```

### HTTPサーバー（カスタムAPI）
```bash
npm run dev:http  # ポート 8766
```

### MCP HTTP/SSEサーバー（Claude連携用）
```bash
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

## ビルド

```bash
npm run build
```

## プロダクション実行

```bash
npm start        # stdio版
npm start:http   # HTTP版
```

## Windows自動起動

### 自動登録

Windowsでは、初回実行時に自動的にスタートアップフォルダに登録されます。これにより、Windows起動時に自動的にMCPサーバーが開始されます。

### アンインストール

```bash
# 方法1: 自動起動を解除してからアンインストール（推奨）
otak-mcp-filesystem-uninstall
npm uninstall -g @tsuyoshi-otake/mcp-filesystem

# 方法2: 直接アンインストール（preuninstallスクリプトが動作する場合）
npm uninstall -g @tsuyoshi-otake/mcp-filesystem
```

### 自動起動のみ解除

```bash
# パッケージは残したまま自動起動だけ解除
otak-mcp-filesystem --uninstall-startup
```

### 手動登録オプション

```bash
# スタートアップフォルダに手動登録
otak-mcp-filesystem --install-startup

# カスタムディレクトリを指定して登録
otak-mcp-filesystem --install-startup '{"allowedDirectory":"C:/Users/username/Documents/MyProject"}'

# タスクスケジューラに登録（より詳細な制御が必要な場合）
otak-mcp-filesystem --install-task

# タスクスケジューラから削除
otak-mcp-filesystem --uninstall-task
```

### 登録状態の確認

- **スタートアップフォルダ**: `Win + R` → `shell:startup` でフォルダを開く
- **タスクスケジューラ**: `taskschd.msc` で確認（タスク名: MCPFilesystemServer）