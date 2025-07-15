' 開発版用のVBScript（TypeScriptを直接実行）
Dim objShell, objFSO, strPath, strCommand

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' スクリプトのディレクトリを取得
strPath = objFSO.GetParentFolderName(objFSO.GetParentFolderName(WScript.ScriptFullName))

' 環境変数を設定してnpxを実行
objShell.CurrentDirectory = strPath

' コマンドライン引数から設定を取得
If WScript.Arguments.Count > 0 Then
    strCommand = "npx tsx src/index.ts " & WScript.Arguments(0)
Else
    strCommand = "npx tsx src/index.ts"
End If

' 非表示で実行（ウィンドウスタイル0 = 非表示）
objShell.Run strCommand, 0, False

' VBScript自体も即座に終了
WScript.Quit