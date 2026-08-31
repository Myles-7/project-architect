# Project Architect - Graceful Process Stopper
# Stops all Node.js processes associated with port 3001 (Backend) and port 5174 (Frontend).

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Stopping Project Architect Services..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

function Stop-PortService($Port, $ServiceName) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conns) {
            $killedCount = 0
            foreach ($conn in $conns) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -gt 0) {
                    $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
                    if ($proc) {
                        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                        Write-Host "[OK] Stopped $ServiceName (PID: $pidToKill on port $Port)" -ForegroundColor Green
                        $killedCount++
                    }
                }
            }
            if ($killedCount -eq 0) {
                Write-Host "[INFO] No active process on port $Port" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[INFO] $ServiceName (Port $Port) is not running" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[WARN] Could not inspect port $Port : $_" -ForegroundColor Yellow
    }
}

Stop-PortService 3001 "Backend REST API Server"
Stop-PortService 5174 "Frontend Web App Server"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   All Project Architect services have been stopped." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
