#!/bin/bash
# ThermaShift Agent - Linux Quick Install
# Usage: curl -sSL https://thermashift.net/agent/install-linux.sh | bash

echo "========================================="
echo "  ThermaShift Monitoring Agent Installer"
echo "  Platform: Linux"
echo "========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required. Install with:"
    echo "  sudo apt install python3 python3-pip   # Debian/Ubuntu"
    echo "  sudo yum install python3 python3-pip   # RHEL/CentOS"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pip3 install --user psutil 2>/dev/null || pip install --user psutil

# Optional GPU support
echo "Attempting GPU support (optional)..."
pip3 install --user GPUtil 2>/dev/null || true

# Download agent
echo "Downloading ThermaShift agent..."
mkdir -p ~/.thermashift
curl -sSL https://thermashift.net/agent/thermashift-agent.py -o ~/.thermashift/thermashift-agent.py
chmod +x ~/.thermashift/thermashift-agent.py

echo ""
echo "========================================="
echo "  Installation Complete!"
echo "========================================="
echo ""
echo "Quick start:"
echo "  python3 ~/.thermashift/thermashift-agent.py --rack-name A1"
echo ""
echo "Continuous monitoring (every 60 seconds):"
echo "  python3 ~/.thermashift/thermashift-agent.py --rack-name A1 --interval 60"
echo ""
echo "Export for platform import:"
echo "  python3 ~/.thermashift/thermashift-agent.py --rack-name A1 --platform-format"
echo ""
echo "Set up as cron job (every 5 minutes):"
echo "  crontab -e"
echo "  */5 * * * * python3 ~/.thermashift/thermashift-agent.py -r A1 -p -o /tmp/thermashift_data.csv -q"
echo ""
