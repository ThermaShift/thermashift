#!/bin/bash
# ============================================================
# ThermaShift VPS Setup Script — Run on a fresh IONOS VPS (Ubuntu 22.04+)
# ============================================================
# Usage: ssh root@YOUR_VPS_IP < setup-vps.sh
# Or: ssh into VPS, then: bash setup-vps.sh
# ============================================================

set -e

echo "=========================================="
echo "  ThermaShift VPS Setup"
echo "=========================================="

# Update system
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Nginx (reverse proxy)
apt install -y nginx

# Install PM2 (process manager — keeps Node running)
npm install -g pm2

# Install Certbot (free SSL from Let's Encrypt)
apt install -y certbot python3-certbot-nginx

# Create app directory
mkdir -p /var/www/thermashift
chown -R $USER:$USER /var/www/thermashift

# Firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo ""
echo "=========================================="
echo "  System ready! Next steps:"
echo "=========================================="
echo ""
echo "  1. Clone the repo:"
echo "     cd /var/www/thermashift"
echo "     git clone https://github.com/thermashift/thermashift.git ."
echo ""
echo "  2. Install dependencies & build:"
echo "     npm ci --production"
echo "     npm run build"
echo ""
echo "  3. Create .env file:"
echo "     cp .env.example .env"
echo "     nano .env  # Fill in your API keys"
echo ""
echo "  4. Start with PM2:"
echo "     pm2 start server/chat-proxy.js --name thermashift"
echo "     pm2 save"
echo "     pm2 startup  # auto-start on reboot"
echo ""
echo "  5. Configure Nginx:"
echo "     cp deploy/nginx.conf /etc/nginx/sites-available/thermashift"
echo "     ln -sf /etc/nginx/sites-available/thermashift /etc/nginx/sites-enabled/"
echo "     rm -f /etc/nginx/sites-enabled/default"
echo "     nginx -t && systemctl reload nginx"
echo ""
echo "  6. SSL certificate:"
echo "     certbot --nginx -d thermashift.net -d www.thermashift.net"
echo ""
echo "  Done! Site live at https://thermashift.net"
echo "=========================================="
