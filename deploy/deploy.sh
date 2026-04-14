#!/bin/bash
# ============================================================
# ThermaShift Deploy Script — Run from your local machine
# Pushes latest code to VPS, builds, and restarts
# ============================================================
# Usage: bash deploy/deploy.sh
# Requires: SSH key configured for root@YOUR_VPS_IP
# ============================================================

VPS_IP="${THERMASHIFT_VPS_IP:-YOUR_VPS_IP_HERE}"
VPS_USER="root"
APP_DIR="/var/www/thermashift"

echo "Deploying to $VPS_IP..."

# Push to GitHub first
git push origin main

# SSH into VPS and pull + rebuild + restart
ssh $VPS_USER@$VPS_IP << 'EOF'
  cd /var/www/thermashift
  git pull origin main
  npm ci --production
  npm run build
  pm2 restart thermashift
  echo "Deploy complete!"
EOF

echo "Done! Site live at https://thermashift.net"
