#requires -version 5.1
<#
    Frame by Frame - Windows Desktop Launcher
    ------------------------------------------
    Responsibility:
      1. Reuse an existing Frame by Frame app window (single instance).
      2. Start the local dev server (vite :5173) only when it is not running.
      3. Start the local AI API (node server/node.ts :8787) only when it is not running.
      4. Open the panel in Microsoft Edge App Mode (1400x900).
      5. On window close, stop ONLY the services this launcher started.

    Hard rules baked into this script:
      - Never taskkill by image name (no /IM node.exe).
      - Never stop a service that was already running before this launcher.
      - Never touch other Edge windows; only windows that belong to this app.
      - Never modify the website, the AI chain, or the DeepWorks assets.

    Parameters:
      -NoDialog      Suppress message boxes (automated tests / headless runs).
      -ConfigPath    Use an alternate config.json (tests only).
#>
[CmdletBinding()]
param(
    [switch]$NoDialog,
    [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Win32 interop (window discovery / activation / graceful close)
# ---------------------------------------------------------------------------
if (-not ('FbfWin32' -as [type])) {
    Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class FbfWin32
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassNameW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool PostMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
'@
}

# ---------------------------------------------------------------------------
# Paths / config
# ---------------------------------------------------------------------------
$script:ScriptRoot = $PSScriptRoot
$script:CfgPath = if ($ConfigPath) { $ConfigPath } else { Join-Path $ScriptRoot 'config.json' }
$script:Config = $null
$script:LogDir = $null
$script:LogPath = $null
$script:StatePath = Join-Path $ScriptRoot 'state.json'

function Initialize-Launcher {
    if (-not (Test-Path -LiteralPath $script:CfgPath)) {
        throw "config.json not found: $($script:CfgPath)"
    }
    $script:Config = Get-Content -LiteralPath $script:CfgPath -Raw -Encoding UTF8 | ConvertFrom-Json

    $script:LogDir = Join-Path $ScriptRoot ([string]$script:Config.logging.dir)
    if (-not (Test-Path -LiteralPath $script:LogDir)) {
        New-Item -ItemType Directory -Path $script:LogDir -Force | Out-Null
    }
    $script:LogPath = Join-Path $script:LogDir ('launcher-{0}.log' -f (Get-Date -Format 'yyyyMMdd'))

    # Log retention (best effort; never fail the launch because of this).
    try {
        $keep = [int]$script:Config.logging.keepDays
        if ($keep -gt 0) {
            $cutoff = (Get-Date).AddDays(-$keep)
            Get-ChildItem -LiteralPath $script:LogDir -Filter '*.log' -File -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTime -lt $cutoff } |
                ForEach-Object { try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop } catch { } }
        }
    } catch { }
}

function Get-ProjectRoot {
    $root = [System.IO.Path]::GetFullPath((Join-Path $ScriptRoot ([string]$script:Config.projectRoot)))
    return $root
}

# ---------------------------------------------------------------------------
# Logging / user messages
# ---------------------------------------------------------------------------
function Write-Log {
    param(
        [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level,
        [string]$Message
    )
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    try { Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8 } catch { }
    switch ($Level) {
        'ERROR' { Write-Host $line -ForegroundColor Red }
        'WARN' { Write-Host $line -ForegroundColor Yellow }
        default { Write-Host $line }
    }
}

function Show-LauncherMessage {
    param(
        [ValidateSet('Info', 'Warning', 'Error')][string]$Kind = 'Info',
        [string]$Message
    )
    if ($NoDialog) { Write-Log 'INFO' ("[no-dialog] $Message") ; return }
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        $icon = [System.Windows.Forms.MessageBoxIcon]::Information
        if ($Kind -eq 'Warning') { $icon = [System.Windows.Forms.MessageBoxIcon]::Warning }
        if ($Kind -eq 'Error') { $icon = [System.Windows.Forms.MessageBoxIcon]::Error }
        [void][System.Windows.Forms.MessageBox]::Show($Message, 'Frame by Frame', [System.Windows.Forms.MessageBoxButtons]::OK, $icon)
    } catch {
        Write-Log 'WARN' "message box unavailable: $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
# Probes
# ---------------------------------------------------------------------------
function Test-TcpPort {
    param(
        [string]$TargetHost = '127.0.0.1',
        [int]$Port,
        [int]$TimeoutMs = 700
    )
    if ($Port -le 0) { return $false }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
        $client.EndConnect($iar)
        return $client.Connected
    } catch {
        return $false
    } finally {
        try { $client.Close() } catch { }
    }
}

function Test-HttpReady {
    param(
        [string]$Url,
        [string]$Marker,
        [int]$TimeoutSec = 4
    )
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        $code = [int]$response.StatusCode
        if ($code -lt 200 -or $code -ge 400) { return $false }
        if ($Marker) {
            $content = $response.Content
            if ($content -is [byte[]]) { $content = [System.Text.Encoding]::UTF8.GetString($content) }
            if ($content.IndexOf($Marker, [System.StringComparison]::Ordinal) -lt 0) { return $false }
        }
        return $true
    } catch {
        return $false
    }
}

# ---------------------------------------------------------------------------
# Owned process bookkeeping
# ---------------------------------------------------------------------------
function Start-OwnedProcess {
    param(
        [string]$Label,
        [string]$File,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$Match
    )
    $startedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
    $outLog = Join-Path $script:LogDir ("{0}.out.log" -f $Label)
    $errLog = Join-Path $script:LogDir ("{0}.err.log" -f $Label)

    $proc = Start-Process -FilePath $File `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -PassThru

    $record = [pscustomobject]@{
        Label     = $Label
        Pid       = [int]$proc.Id
        StartedAt = $startedAt
        Match     = $Match
    }
    Write-Log 'INFO' ("started {0} (pid={1}) :: {2} {3}" -f $Label, $record.Pid, $File, ($Arguments -join ' '))
    return $record
}

function Test-OwnedProcess {
    param($Record)
    if (-not $Record -or -not $Record.Pid) { return $false }
    $proc = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f [int]$Record.Pid) -ErrorAction SilentlyContinue
    if (-not $proc) { return $false }

    # Guard against PID reuse: creation time must be close to what we recorded.
    try {
        $created = [datetime]$proc.CreationDate
        $started = [datetime]::Parse([string]$Record.StartedAt, [System.Globalization.CultureInfo]::InvariantCulture)
        if ([math]::Abs(($created - $started).TotalSeconds) -gt 180) { return $false }
    } catch {
        return $false
    }

    # Guard against touching an unrelated process that happens to match the PID.
    if ($Record.Match) {
        $cmd = [string]$proc.CommandLine
        if ($cmd.IndexOf([string]$Record.Match, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) { return $false }
    }
    return $true
}

function Stop-OwnedProcess {
    param($Record)
    if (-not $Record) { return }
    if (Test-OwnedProcess -Record $Record) {
        Write-Log 'INFO' ("stopping owned {0} (pid={1}) with taskkill /T /F" -f $Record.Label, [int]$Record.Pid)
        & taskkill.exe /PID ([int]$Record.Pid) /T /F 2>&1 | Out-Null
        Start-Sleep -Milliseconds 400
        if (Test-OwnedProcess -Record $Record) {
            Write-Log 'WARN' ("{0} (pid={1}) is still alive after taskkill" -f $Record.Label, [int]$Record.Pid)
        } else {
            Write-Log 'INFO' ("stopped {0} (pid={1})" -f $Record.Label, [int]$Record.Pid)
        }
    } else {
        Write-Log 'WARN' ("skip cleanup for {0} (pid={1}): process gone or no longer ours (anti-mistake-kill)" -f $Record.Label, [int]$Record.Pid)
    }
}

function Save-LauncherState {
    param($Owned)
    $payload = [pscustomobject]@{
        launcherPid = $PID
        savedAt     = (Get-Date).ToString('o')
        owned       = @($Owned)
    }
    try {
        ($payload | ConvertTo-Json -Depth 6) | Set-Content -LiteralPath $script:StatePath -Encoding UTF8
    } catch {
        Write-Log 'WARN' "failed to persist state.json: $($_.Exception.Message)"
    }
}

function Read-LauncherState {
    if (-not (Test-Path -LiteralPath $script:StatePath)) { return $null }
    try {
        return (Get-Content -LiteralPath $script:StatePath -Raw -Encoding UTF8 | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Clear-LauncherState {
    try { if (Test-Path -LiteralPath $script:StatePath) { Remove-Item -LiteralPath $script:StatePath -Force } } catch { }
}

# ---------------------------------------------------------------------------
# Window discovery / activation
# ---------------------------------------------------------------------------
function Get-AppWindows {
    param(
        [string[]]$Needles,
        [string]$HostHint
    )
    $found = New-Object System.Collections.ArrayList

    $callback = [FbfWin32+EnumWindowsProc] {
        param([IntPtr]$hWnd, [IntPtr]$lParam)
        try {
            if ([FbfWin32]::IsWindowVisible($hWnd)) {
                $cls = New-Object System.Text.StringBuilder 256
                [void][FbfWin32]::GetClassNameW($hWnd, $cls, 256)
                if ($cls.ToString() -eq 'Chrome_WidgetWin_1') {
                    $tb = New-Object System.Text.StringBuilder 512
                    [void][FbfWin32]::GetWindowTextW($hWnd, $tb, 512)
                    $title = $tb.ToString()

                    # A normal Edge tab window carries the browser suffix; an App Mode
                    # window does not. That is what keeps us off other Edge windows.
                    # NOTE: browser titles can contain zero-width characters between
                    # "Microsoft" and "Edge", so match the brand word only.
                    $isBrowserWindow = $false
                    if ($title -match 'Microsoft' -or $title -like '*and other tabs*' -or $title -like '*和另外*' -or $title -like '*个人资料*') {
                        $isBrowserWindow = $true
                    }

                    if ($title -and -not $isBrowserWindow) {
                        # The SPA rewrites document.title to "<page> · Frame by Frame"
                        # after mount, so a prefix test would lose the window. Match
                        # the brand anywhere in the title instead.
                        $matched = $false
                        foreach ($needle in $Needles) {
                            if ($needle -and $title.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $matched = $true }
                        }
                        # Deliberately no URL/title fallback: an Edge error page shows
                        # the raw URL as its title, and accepting that would report a
                        # broken panel as a healthy window.
                        if ($matched) {
                            [void]$found.Add([pscustomobject]@{ Handle = $hWnd; Title = $title })
                        }
                    }
                }
            }
        } catch { }
        $true
    }

    [void][FbfWin32]::EnumWindows($callback, [IntPtr]::Zero)
    return $found
}

function Activate-AppWindow {
    param([IntPtr]$Handle)
    if ([FbfWin32]::IsIconic($Handle)) {
        [void][FbfWin32]::ShowWindow($Handle, 9)  # SW_RESTORE
    }

    # SetForegroundWindow is refused when the caller is not the foreground thread,
    # so attach to the current foreground thread first.
    $foreground = [FbfWin32]::GetForegroundWindow()
    $fgPid = [uint32]0
    $fgThread = [FbfWin32]::GetWindowThreadProcessId($foreground, [ref]$fgPid)
    $currentThread = [FbfWin32]::GetCurrentThreadId()
    $attached = $false
    try {
        if ($fgThread -ne 0 -and $fgThread -ne $currentThread) {
            $attached = [FbfWin32]::AttachThreadInput($currentThread, $fgThread, $true)
        }
        [void][FbfWin32]::BringWindowToTop($Handle)
        [void][FbfWin32]::SetForegroundWindow($Handle)
    } finally {
        if ($attached) { [void][FbfWin32]::AttachThreadInput($currentThread, $fgThread, $false) }
    }
}

function Wait-AppWindow {
    param(
        [string[]]$Needles,
        [string]$HostHint,
        [int]$TimeoutSeconds
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $windows = @(Get-AppWindows -Needles $Needles -HostHint $HostHint)
        if ($windows.Count -gt 0) { return $windows[0] }
        Start-Sleep -Milliseconds 400
    }
    return $null
}

# ---------------------------------------------------------------------------
# Browser lookup
# ---------------------------------------------------------------------------
function Find-Edge {
    param($Config)
    if ($Config.browser.exe -and (Test-Path -LiteralPath ([string]$Config.browser.exe))) {
        return [string]$Config.browser.exe
    }

    $candidates = New-Object System.Collections.ArrayList

    $regPaths = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe'
    )
    foreach ($rp in $regPaths) {
        try {
            $value = (Get-ItemProperty -LiteralPath $rp -ErrorAction Stop).'(default)'
            if ($value) { [void]$candidates.Add([string]$value) }
        } catch { }
    }

    $pf86 = ${env:ProgramFiles(x86)}
    $pf = $env:ProgramFiles
    $local = $env:LOCALAPPDATA
    if ($pf86) { [void]$candidates.Add("$pf86\Microsoft\Edge\Application\msedge.exe") }
    if ($pf) { [void]$candidates.Add("$pf\Microsoft\Edge\Application\msedge.exe") }
    if ($local) { [void]$candidates.Add("$local\Microsoft\Edge\Application\msedge.exe") }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    return $null
}

# ---------------------------------------------------------------------------
# Service readiness
# ---------------------------------------------------------------------------
function Wait-ServiceReady {
    param(
        $Record,
        [string]$Label,
        [string]$Url,
        [string]$Marker,
        [int]$Port,
        [int]$TimeoutSeconds
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Test-OwnedProcess -Record $Record)) {
            # The wrapper exited. Give the child a last chance via the HTTP probe below.
            if (-not (Test-HttpReady -Url $Url -Marker $Marker -TimeoutSec 2)) {
                Write-Log 'ERROR' ("{0} exited before becoming ready (see {0}.err.log)" -f $Label)
                return $false
            }
        }
        if (Test-HttpReady -Url $Url -Marker $Marker -TimeoutSec 3) {
            Write-Log 'INFO' ("{0} is ready at {1}" -f $Label, $Url)
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Log 'ERROR' ("{0} did not become ready within {1}s" -f $Label, $TimeoutSeconds)
    return $false
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
function Invoke-Launcher {
    Initialize-Launcher
    $cfg = $script:Config
    $projectRoot = Get-ProjectRoot

    Write-Log 'INFO' '================ Frame by Frame launcher ================'
    Write-Log 'INFO' ("launcher pid={0} config={1} projectRoot={2}" -f $PID, $script:CfgPath, $projectRoot)

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json'))) {
        Write-Log 'ERROR' "package.json not found under $projectRoot"
        Show-LauncherMessage -Kind Error -Message ("找不到项目根目录：{0}`n请确认 FrameByFrame-Launcher 位于 Frame by Frame 项目根目录下。" -f $projectRoot)
        return 1
    }

    $panelUri = [uri]$cfg.panelUrl
    $hostHint = $panelUri.Authority                     # 127.0.0.1:5173
    $needles = @($cfg.window.titleNeedles)

    # --- 1. Already open? Reuse it. No service start, no second window. ---
    $existing = @(Get-AppWindows -Needles $needles -HostHint $hostHint)
    if ($existing.Count -gt 0) {
        Write-Log 'INFO' ("existing app window found: ""{0}""" -f $existing[0].Title)
        Activate-AppWindow -Handle $existing[0].Handle
        Write-Log 'INFO' 'activated the existing window; nothing else to do'
        return 0
    }
    Write-Log 'INFO' 'no existing app window'

    # --- 2. Single-instance gate, held for the whole launcher lifetime. ---
    # Holding it end-to-end is what stops two near-simultaneous double-clicks
    # from starting two vite/Edge stacks while the first window is still loading.
    $mutex = New-Object System.Threading.Mutex($false, [string]$cfg.singleInstance.mutexName)
    $gateHeld = $false
    try {
        $gateHeld = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $gateHeld = $true
        Write-Log 'WARN' 'mutex was abandoned by a previous launcher; taking ownership'
    }

    if (-not $gateHeld) {
        Write-Log 'INFO' 'another launcher owns the gate; waiting for its window instead of starting a second stack'
        $deadline = (Get-Date).AddSeconds([int]$cfg.singleInstance.waitSeconds)
        while ((Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 600
            $peerWindow = @(Get-AppWindows -Needles $needles -HostHint $hostHint)
            if ($peerWindow.Count -gt 0) {
                Activate-AppWindow -Handle $peerWindow[0].Handle
                Write-Log 'INFO' 'activated the window created by the peer launcher'
                $mutex.Dispose()
                return 0
            }
        }
        $mutex.Dispose()
        Write-Log 'ERROR' 'peer launcher did not produce a window within the wait budget'
        Show-LauncherMessage -Kind Error -Message "另一个启动器实例正在启动 Frame by Frame，等待超时。`n请稍后重试。`n`n日志：$($script:LogPath)"
        return 1
    }

    # --- 3. Clean leftovers from a previous crashed launcher (owned only). ---
    # Safe to do here: holding the gate proves no other launcher is alive.
    $previous = Read-LauncherState
    if ($previous -and $previous.owned) {
        $previousPid = 0
        if ($previous.launcherPid) { $previousPid = [int]$previous.launcherPid }
        $previousAlive = $false
        if ($previousPid -gt 0 -and $previousPid -ne $PID) {
            $previousProcess = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $previousPid) -ErrorAction SilentlyContinue
            if ($previousProcess -and ([string]$previousProcess.CommandLine) -like '*launcher.ps1*') { $previousAlive = $true }
        }
        if ($previousAlive) {
            Write-Log 'INFO' ("state.json belongs to a live launcher (pid={0}); leaving its services alone" -f $previousPid)
        } else {
            Write-Log 'WARN' 'found state.json from a previous run; cleaning launcher-owned leftovers only'
            foreach ($record in @($previous.owned)) {
                if ($record -and $record.Label) { Stop-OwnedProcess -Record $record }
            }
            Clear-LauncherState
        }
    }

    $owned = New-Object System.Collections.ArrayList
    $aiDegraded = $false
    $exitCode = 1

    try {
        # --- 4. Web dev server (vite :5173) ---
        $webPort = [int]$cfg.web.port
        if ($cfg.web.enabled) {
            if (Test-TcpPort -Port $webPort) {
                if (Test-HttpReady -Url $cfg.web.readyUrl -Marker $cfg.web.readyMarker -TimeoutSec 6) {
                    Write-Log 'INFO' ("web server already running on 127.0.0.1:{0} and looks like Frame by Frame; reusing it (will NOT be stopped on close)" -f $webPort)
                } else {
                    Write-Log 'ERROR' ("port {0} is occupied but does not serve the Frame by Frame panel" -f $webPort)
                    Show-LauncherMessage -Kind Error -Message ("端口 {0} 已被其他程序占用，且返回的内容不是 Frame by Frame 面板。`n请先关闭占用该端口的程序，再重新双击启动器。`n`n日志：{1}" -f $webPort, $script:LogPath)
                    return 1
                }
            } else {
                $record = Start-OwnedProcess -Label 'vite' -File ([string]$cfg.web.startFile) -Arguments @($cfg.web.startArgs) -WorkingDirectory $projectRoot -Match ([string]$cfg.web.startMatch)
                [void]$owned.Add($record)
                Save-LauncherState -Owned $owned

                if (-not (Wait-ServiceReady -Record $record -Label 'vite' -Url $cfg.web.readyUrl -Marker $cfg.web.readyMarker -Port $webPort -TimeoutSeconds ([int]$cfg.web.startTimeoutSeconds))) {
                    Write-Log 'ERROR' ("failed to start the dev server; see {0}\vite.err.log" -f $script:LogDir)
                    foreach ($r in @($owned)) { Stop-OwnedProcess -Record $r }
                    Clear-LauncherState
                    Show-LauncherMessage -Kind Error -Message ("本地开发服务器启动失败（超时或异常退出）。`n`n可能原因：`n  - 项目依赖未安装（先执行 npm install）`n  - Node.js 不可用或 npm 执行策略受限`n  - 5173 端口被占用`n`n详细日志：{0}`n服务日志：{0}\vite.err.log" -f $script:LogDir)
                    return 1
                }
            }
        }

        # --- 5. Local AI API (:8787) ---
        if ($cfg.ai.enabled) {
            $aiPort = [int]$cfg.ai.port
            if (Test-TcpPort -Port $aiPort) {
                if (Test-HttpReady -Url $cfg.ai.readyUrl -Marker $cfg.ai.readyMarker -TimeoutSec 4) {
                    Write-Log 'INFO' ("AI API already running on 127.0.0.1:{0}; reusing it (will NOT be stopped on close)" -f $aiPort)
                } else {
                    Write-Log 'WARN' ("port {0} is occupied by something that is not the FBF AI API; leaving it alone" -f $aiPort)
                }
            } else {
                $aiRecord = Start-OwnedProcess -Label 'ai' -File ([string]$cfg.ai.startFile) -Arguments @($cfg.ai.startArgs) -WorkingDirectory $projectRoot -Match ([string]$cfg.ai.startMatch)
                [void]$owned.Add($aiRecord)
                Save-LauncherState -Owned $owned

                if (-not (Wait-ServiceReady -Record $aiRecord -Label 'ai' -Url $cfg.ai.readyUrl -Marker $cfg.ai.readyMarker -Port $aiPort -TimeoutSeconds ([int]$cfg.ai.startTimeoutSeconds))) {
                    Write-Log 'ERROR' 'AI API failed to start; the panel will still open (AI analysis unavailable)'
                    $aiDegraded = $true
                    if ($cfg.ai.required) {
                        foreach ($r in @($owned)) { Stop-OwnedProcess -Record $r }
                        Clear-LauncherState
                        Show-LauncherMessage -Kind Error -Message ("AI 服务启动失败，且当前配置要求 AI 服务必须可用。`n`n日志：{0}\ai.err.log" -f $script:LogDir)
                        return 1
                    }
                }
            }
            if ($aiDegraded) {
                Show-LauncherMessage -Kind Warning -Message ("AI 分析服务未能启动，面板仍会打开。`n`n电影与笔记可以正常保存，AI 分析暂不可用。`n若需要 AI 分析，请检查 .env 中的 DEEPSEEK_API_KEY。`n`n日志：{0}\ai.err.log" -f $script:LogDir)
            }
        }

        # --- 6. Launch Edge in App Mode ---
        $edge = Find-Edge -Config $cfg
        if (-not $edge) {
            Write-Log 'ERROR' 'Microsoft Edge not found'
            foreach ($r in @($owned)) { Stop-OwnedProcess -Record $r }
            Clear-LauncherState
            Show-LauncherMessage -Kind Error -Message "未找到 Microsoft Edge。`n启动器依赖 Edge 的 --app 模式打开独立窗口。`n安装 Edge 后重试，或在 config.json 中显式填写 browser.exe 路径。"
            return 1
        }
        Write-Log 'INFO' ("edge: {0}" -f $edge)

        $edgeArgs = @(
            ("--app={0}" -f $cfg.panelUrl),
            ("--window-size={0},{1}" -f [int]$cfg.window.width, [int]$cfg.window.height)
        )
        foreach ($extra in @($cfg.browser.extraArgs)) {
            if ($extra) { $edgeArgs += [string]$extra }
        }

        Start-Process -FilePath $edge -ArgumentList $edgeArgs | Out-Null
        Write-Log 'INFO' ("launched Edge app mode: {0}" -f ($edgeArgs -join ' '))

        $window = Wait-AppWindow -Needles $needles -HostHint $hostHint -TimeoutSeconds ([int]$cfg.lifecycle.windowAppearTimeoutSeconds)
        if (-not $window) {
            Write-Log 'ERROR' 'Edge did not produce a Frame by Frame app window in time'
            foreach ($r in @($owned)) { Stop-OwnedProcess -Record $r }
            Clear-LauncherState
            Show-LauncherMessage -Kind Error -Message ("Edge 未能打开 Frame by Frame 应用窗口。`n`n可能原因：`n  - Edge 启动被策略阻止`n  - 页面加载失败（服务刚启动时偶发，重试一次通常可解决）`n`n日志：{0}" -f $script:LogPath)
            return 1
        }
        Write-Log 'INFO' ("app window ready: ""{0}""" -f $window.Title)

        # The gate stays held until this launcher exits. A later double-click is
        # still instant because it finds the existing window before touching the
        # gate at all; only a genuinely window-less launch has to wait on it.

        # --- 7. Keep monitoring; on window close, stop only our own services. ---
        $pollMs = [int]$cfg.lifecycle.windowPollMs
        $warmupSeconds = [int]$cfg.lifecycle.windowWarmupSeconds
        $absentChecks = [int]$cfg.lifecycle.windowAbsentChecks
        if ($absentChecks -lt 1) { $absentChecks = 1 }
        Write-Log 'INFO' ("monitoring window every {0}ms; launcher stays resident (no tray icon by design)" -f $pollMs)

        # A window can disappear for one poll while Edge reloads. Require several
        # consecutive misses, and ignore misses during a short warm-up window.
        $watchStarted = Get-Date
        $absent = 0
        while ($true) {
            Start-Sleep -Milliseconds $pollMs
            $live = @(Get-AppWindows -Needles $needles -HostHint $hostHint)
            if ($live.Count -gt 0) {
                $absent = 0
                continue
            }
            $absent++
            $watched = ((Get-Date) - $watchStarted).TotalSeconds
            if ($watched -lt $warmupSeconds) { continue }
            if ($absent -lt $absentChecks) { continue }
            Write-Log 'INFO' ("app window closed ({0} consecutive checks without it)" -f $absent)
            break
        }

        if ($cfg.lifecycle.stopOwnedServicesOnClose) {
            if ($owned.Count -gt 0) {
                Write-Log 'INFO' ("cleaning up {0} launcher-owned service(s)" -f $owned.Count)
                foreach ($r in @($owned)) { Stop-OwnedProcess -Record $r }
            } else {
                Write-Log 'INFO' 'no launcher-owned services to clean up (everything was pre-existing)'
            }
        } else {
            Write-Log 'INFO' 'stopOwnedServicesOnClose is false; leaving services running'
        }
        Clear-LauncherState
        $exitCode = 0
        return $exitCode
    } finally {
        if ($gateHeld) { try { $mutex.ReleaseMutex() } catch { } }
        try { $mutex.Dispose() } catch { }
        Write-Log 'INFO' ("launcher exiting with code {0}" -f $exitCode)
    }
}

$exitCode = 1
try {
    $exitCode = Invoke-Launcher
} catch {
    $message = $_.Exception.Message
    Write-Log 'ERROR' ("unhandled launcher error: {0}" -f $message)
    Write-Log 'ERROR' ($_.ScriptStackTrace)
    if (-not $NoDialog) {
        Show-LauncherMessage -Kind Error -Message ("启动器发生未处理错误：`n{0}`n`n日志：{1}" -f $message, $script:LogPath)
    }
}
exit $exitCode
