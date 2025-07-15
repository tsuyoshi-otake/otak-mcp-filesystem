# Windows自動起動セットアップスクリプト
param(
    [string]$AllowedDirectory = "$env:USERPROFILE\Desktop\Otak",
    [switch]$Startup,
    [switch]$Service,
    [switch]$TaskScheduler
)

$ErrorActionPreference = "Stop"

# 実行ポリシーチェック
if ((Get-ExecutionPolicy) -eq 'Restricted') {
    Write-Host "実行ポリシーを変更してください: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Red
    exit 1
}

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath

# 1. スタートアップフォルダに追加
if ($Startup) {
    Write-Host "スタートアップフォルダに追加中..." -ForegroundColor Green
    
    $startupPath = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupPath "MCP-Filesystem-Server.lnk"
    
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-WindowStyle Hidden -Command `"cd '$projectRoot'; npx tsx src/index.ts '{`"allowedDirectory`":`"$AllowedDirectory`"}'`""
    $Shortcut.WorkingDirectory = $projectRoot
    $Shortcut.IconLocation = "shell32.dll,3"
    $Shortcut.Description = "MCP Filesystem Server"
    $Shortcut.Save()
    
    Write-Host "スタートアップに登録完了: $shortcutPath" -ForegroundColor Green
}

# 2. タスクスケジューラに登録
if ($TaskScheduler) {
    Write-Host "タスクスケジューラに登録中..." -ForegroundColor Green
    
    $taskName = "MCPFilesystemServer"
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-WindowStyle Hidden -Command `"cd '$projectRoot'; npx tsx src/index.ts '{`"allowedDirectory`":`"$AllowedDirectory`"}'`"" `
        -WorkingDirectory $projectRoot
    
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
        -Description "MCP Filesystem Server for Claude" -Force
    
    Write-Host "タスクスケジューラに登録完了: $taskName" -ForegroundColor Green
}

# 3. Windows Service として登録（NSSM使用）
if ($Service) {
    Write-Host "Windowsサービスとして登録中..." -ForegroundColor Green
    
    # NSSMがインストールされているか確認
    $nssm = Get-Command nssm -ErrorAction SilentlyContinue
    if (-not $nssm) {
        Write-Host "NSSMをインストールしてください: choco install nssm" -ForegroundColor Red
        exit 1
    }
    
    $serviceName = "MCPFilesystemServer"
    $nodePath = (Get-Command node).Path
    
    # サービスの作成
    & nssm install $serviceName $nodePath
    & nssm set $serviceName AppParameters "npx tsx src/index.ts `"{`\`"allowedDirectory`\`":`\`"$AllowedDirectory`\`"}`""
    & nssm set $serviceName AppDirectory $projectRoot
    & nssm set $serviceName DisplayName "MCP Filesystem Server"
    & nssm set $serviceName Description "Model Context Protocol Filesystem Server for Claude"
    & nssm set $serviceName Start SERVICE_AUTO_START
    
    Write-Host "Windowsサービスに登録完了: $serviceName" -ForegroundColor Green
    Write-Host "サービスを開始: Start-Service $serviceName" -ForegroundColor Yellow
}

# 使用方法を表示
if (-not ($Startup -or $TaskScheduler -or $Service)) {
    Write-Host @"
使用方法:
  .\install-windows.ps1 -Startup              # スタートアップフォルダに追加
  .\install-windows.ps1 -TaskScheduler        # タスクスケジューラに登録
  .\install-windows.ps1 -Service              # Windowsサービスとして登録（要NSSM）
  
オプション:
  -AllowedDirectory "C:\Path\To\Directory"    # アクセス許可ディレクトリを指定

例:
  .\install-windows.ps1 -Startup -AllowedDirectory "C:\Users\$env:USERNAME\Documents\MyProject"
"@ -ForegroundColor Cyan
}