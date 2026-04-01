#!/bin/bash
# ThermaShift Agent - macOS Quick Install
# Usage: curl -sSL https://thermashift.net/agent/install-mac.sh | bash

echo "========================================="
echo "  ThermaShift Monitoring Agent Installer"
echo "  Platform: macOS"
echo "========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required. Install with:"
    echo "  brew install python3"
    echo "  or download from https://www.python.org/downloads/"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pip3 install --user psutil 2>/dev/null || pip install --user psutil

echo ""
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
echo "Note: CPU temperature on macOS may require sudo for full access."
echo ""
