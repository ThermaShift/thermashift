# ThermaShift Agent - Windows Quick Install
# Usage: Run in PowerShell as Administrator
# irm https://thermashift.net/agent/install-windows.ps1 | iex

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  ThermaShift Monitoring Agent Installer" -ForegroundColor Cyan
Write-Host "  Platform: Windows" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "ERROR: Python 3 is required." -ForegroundColor Red
    Write-Host "Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..."
python -m pip install --user psutil 2>$null
python -m pip install --user GPUtil 2>$null

# Download agent
Write-Host "Downloading ThermaShift agent..."
$agentDir = "$env:USERPROFILE\.thermashift"
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
Invoke-WebRequest -Uri "https://thermashift.net/agent/thermashift-agent.py" -OutFile "$agentDir\thermashift-agent.py"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Quick start:" -ForegroundColor Yellow
Write-Host "  python $agentDir\thermashift-agent.py --rack-name A1"
Write-Host ""
Write-Host "Continuous monitoring (every 60 seconds):" -ForegroundColor Yellow
Write-Host "  python $agentDir\thermashift-agent.py --rack-name A1 --interval 60"
Write-Host ""
Write-Host "Export for platform import:" -ForegroundColor Yellow
Write-Host "  python $agentDir\thermashift-agent.py --rack-name A1 --platform-format"
Write-Host ""
