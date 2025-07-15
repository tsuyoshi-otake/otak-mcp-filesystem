' VBScriptで非表示実行（コンソールウィンドウを表示しない）
Dim objShell, objFSO, strPath, strCommand

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' スクリプトのディレクトリを取得
strPath = objFSO.GetParentFolderName(objFSO.GetParentFolderName(WScript.ScriptFullName))

' コマンドライン引数から設定を取得
If WScript.Arguments.Count > 0 Then
    strCommand = "cmd /c cd /d """ & strPath & """ && npx tsx src/index.ts " & WScript.Arguments(0)
Else
    strCommand = "cmd /c cd /d """ & strPath & """ && npx tsx src/index.ts"
End If

' 非表示で実行
objShell.Run strCommand, 0, False