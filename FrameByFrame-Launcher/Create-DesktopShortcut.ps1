#requires -version 5.1
<#
    Frame by Frame - 桌面快捷方式安装 / 刷新

    只做两件事：
      1. 在桌面创建（或刷新）指向 FrameByFrame-Launcher.bat 的快捷方式；
      2. 把快捷方式图标绑定到 icons\FrameByFrame.ico（第一版深蓝 + 香槟金）。

    不启动任何服务，不修改 launcher.ps1 / config.json 的任何字段。
    项目目录整体搬走后，重新运行本脚本即可修复图标路径。
#>
[CmdletBinding()]
param(
    # 快捷方式显示名称（不含 .lnk）
    [string]$ShortcutName = 'Frame by Frame',

    # 显式指定图标路径；默认使用 icons\FrameByFrame.ico
    [string]$IconPath
)

$ErrorActionPreference = 'Stop'

$launcherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath = Join-Path $launcherDir 'FrameByFrame-Launcher.bat'

if (-not (Test-Path -LiteralPath $batPath)) {
    throw "找不到启动入口：$batPath"
}

if (-not $IconPath) {
    $IconPath = Join-Path $launcherDir 'icons\FrameByFrame.ico'
}

if (-not (Test-Path -LiteralPath $IconPath)) {
    throw "找不到图标文件：$IconPath（请先运行 _work\launcher-icon\build-icon.py 生成）"
}

$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop)) {
    throw '无法定位当前用户桌面目录。'
}

$lnkPath = Join-Path $desktop ($ShortcutName + '.lnk')
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)

$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $launcherDir
$shortcut.IconLocation = "$IconPath,0"
$shortcut.Description = 'Frame by Frame - 私人电影记忆博物馆'
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Output ("快捷方式: {0}" -f $lnkPath)
Write-Output ("目标    : {0}" -f $shortcut.TargetPath)
Write-Output ("图标    : {0}" -f $shortcut.IconLocation)
Write-Output ("工作目录: {0}" -f $shortcut.WorkingDirectory)
