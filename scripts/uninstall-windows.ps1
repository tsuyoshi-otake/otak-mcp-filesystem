# Windows自動起動削除スクリプト
param(
    [switch]$Startup,
    [switch]$Service,
    [switch]$TaskScheduler,
    [switch]$All
)

$ErrorActionPreference = "Stop"

if ($All) {
    $Startup = $true
    $TaskScheduler = $true
    $Service = $true
}

# 1. スタートアップフォルダから削除
if ($Startup) {
    Write-Host "スタートアップフォルダから削除中..." -ForegroundColor Yellow
    
    $startupPath = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupPath "MCP-Filesystem-Server.lnk"
    
    if (Test-Path $shortcutPath) {
        Remove-Item $shortcutPath -Force
        Write-Host "スタートアップから削除完了" -ForegroundColor Green
    } else {
        Write-Host "スタートアップに登録されていません" -ForegroundColor Gray
    }
}

# 2. タスクスケジューラから削除
if ($TaskScheduler) {
    Write-Host "タスクスケジューラから削除中..." -ForegroundColor Yellow
    
    $taskName = "MCPFilesystemServer"
    
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "タスクスケジューラから削除完了" -ForegroundColor Green
    } catch {
        Write-Host "タスクスケジューラに登録されていません" -ForegroundColor Gray
    }
}

# 3. Windows Service から削除
if ($Service) {
    Write-Host "Windowsサービスから削除中..." -ForegroundColor Yellow
    
    $serviceName = "MCPFilesystemServer"
    
    # サービスが存在するか確認
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service) {
        # サービスを停止
        if ($service.Status -eq 'Running') {
            Stop-Service -Name $serviceName -Force
        }
        
        # NSSMで削除
        $nssm = Get-Command nssm -ErrorAction SilentlyContinue
        if ($nssm) {
            & nssm remove $serviceName confirm
            Write-Host "Windowsサービスから削除完了" -ForegroundColor Green
        } else {
            Write-Host "NSSMが見つかりません。手動で削除してください: sc delete $serviceName" -ForegroundColor Red
        }
    } else {
        Write-Host "Windowsサービスに登録されていません" -ForegroundColor Gray
    }
}

# 使用方法を表示
if (-not ($Startup -or $TaskScheduler -or $Service)) {
    Write-Host @"
使用方法:
  .\uninstall-windows.ps1 -Startup         # スタートアップフォルダから削除
  .\uninstall-windows.ps1 -TaskScheduler   # タスクスケジューラから削除
  .\uninstall-windows.ps1 -Service         # Windowsサービスから削除
  .\uninstall-windows.ps1 -All            # すべて削除

例:
  .\uninstall-windows.ps1 -All
"@ -ForegroundColor Cyan
}