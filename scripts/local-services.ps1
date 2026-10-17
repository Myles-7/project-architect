param(
    [ValidateSet('start', 'stop')][string]$Action,
    [ValidateRange(1, 65535)][int]$ServerPort = 3001,
    [ValidateRange(1, 65535)][int]$WebPort = 5174
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$entries = @((Join-Path $repo 'apps/server/dist/index.js'), (Join-Path $repo 'apps/web/node_modules/vite/bin/vite.js'))
if ($Action -eq 'start') {
    $nodePath = (Get-Command node).Source
    $serverArgs = '"' + $entries[0] + '"'
    $webArgs = '"' + $entries[1] + '" "' + (Join-Path $repo 'apps/web') + '" --host 127.0.0.1 --port ' + $WebPort + ' --strictPort'
    $originalPort = $env:PORT
    try {
        $env:PORT = [string]$ServerPort
        $backend = Start-Process -FilePath $nodePath -ArgumentList $serverArgs -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $repo 'pa-server.log') -RedirectStandardError (Join-Path $repo 'pa-server-error.log')
        try {
            $null = Start-Process -FilePath $nodePath -ArgumentList $webArgs -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $repo 'pa-web.log') -RedirectStandardError (Join-Path $repo 'pa-web-error.log')
        } catch {
            $backend | Stop-Process -ErrorAction SilentlyContinue
            throw
        }
    } finally {
        $env:PORT = $originalPort
    }
} else {
    # Match this checkout's absolute entry points, never kill by port alone.
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
        $proc = $_
        if ($entries | Where-Object { $proc.CommandLine -and $proc.CommandLine.Contains('"' + $_ + '"') }) {
            Write-Host "[Stopping] Project Architect process $($proc.ProcessId)..."
            Stop-Process -Id $proc.ProcessId -ErrorAction SilentlyContinue
        }
    }
}
