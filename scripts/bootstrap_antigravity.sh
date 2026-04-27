#!/bin/bash
# ============================================================
#  AetherDesk Prime – OCI ARM64 + noVNC Mobile Setup
#  Optimized for VM.Standard.A1.Flex (ARM64 / Ubuntu 22.04)
#  Access: http://<TAILSCALE_IP>:6080/vnc.html
# ============================================================

set -e
export DEBIAN_FRONTEND=noninteractive

echo "🚀 Starting AetherDesk + Antigravity Bootstrap..."

# --- 1. SYSTEM BASE ---
echo "📦 Step 1: Installing Core Dependencies..."
sudo apt-get update -qq
sudo apt-get install -y \
  xfce4 xfce4-goodies \
  tigervnc-standalone-server \
  novnc websockify \
  chromium-browser \
  dbus-x11 \
  x11-xserver-utils \
  curl wget gnupg2 git \
  libgbm1 libnss3 libatk-bridge2.0-0 \
  libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 \
  docker.io docker-compose-v2

# --- 2. ANTIGRAVITY AGENT ---
echo "🤖 Step 2: Configuring Antigravity Repository..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/antigravity-repo-key.gpg

echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] \
https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ \
antigravity-debian main" | \
  sudo tee /etc/apt/sources.list.d/antigravity.list > /dev/null

sudo apt-get update -qq
echo "📦 Installing Antigravity Agent..."
sudo apt-get install -y antigravity

# --- 3. VNC & DESKTOP CONFIG ---
echo "🖥️  Step 3: Configuring VNC Desktop (XFCE)..."
mkdir -p ~/.vnc

VNC_PASS="aetherdesk"
echo "$VNC_PASS" | vncpasswd -f > ~/.vnc/passwd
chmod 600 ~/.vnc/passwd

cat > ~/.vnc/xstartup << 'EOF'
#!/bin/bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_SESSION_TYPE=x11
export XDG_CURRENT_DESKTOP=XFCE
# Start DBUS for Chromium/Antigravity
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
    eval $(dbus-launch --sh-syntax)
fi
exec startxfce4
EOF
chmod +x ~/.vnc/xstartup

# --- 4. SYSTEMD SERVICES ---
echo "⚙️  Step 4: Setting up Background Services..."

# VNC Server
cat << EOF | sudo tee /etc/systemd/system/vncserver@1.service
[Unit]
Description=TigerVNC Server for AetherDesk
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$HOME
ExecStartPre=-/usr/bin/vncserver -kill :1 > /dev/null 2>&1
ExecStart=/usr/bin/vncserver :1 -geometry 1280x800 -depth 24 -localhost no
ExecStop=/usr/bin/vncserver -kill :1
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# noVNC Proxy
cat << EOF | sudo tee /etc/systemd/system/novnc.service
[Unit]
Description=noVNC Web Proxy for Mobile
After=network.target vncserver@1.service

[Service]
Type=simple
User=$USER
ExecStart=/usr/bin/websockify --web /usr/share/novnc/ 6080 localhost:5901
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable vncserver@1 novnc
sudo systemctl start vncserver@1 novnc

# --- 5. FIREWALL & NETWORK ---
echo "🔐 Step 5: Configuring Networking..."
if command -v tailscale &> /dev/null; then
  TAILSCALE_IP=$(tailscale ip -4)
  echo "✅ Tailscale detected: $TAILSCALE_IP"
else
  echo "⚠️  Tailscale not found. Opening Port 6080 to Public Traffic..."
  sudo iptables -I INPUT -p tcp --dport 6080 -j ACCEPT
  sudo apt-get install -y iptables-persistent -qq
  sudo netfilter-persistent save
fi

# --- 6. WORKSPACE PREP ---
echo "📂 Step 6: Initializing Workspace..."
# (User would run git clone here, but we provide the command)
echo "Tip: Run 'git clone <REPO_URL> ~/trading-workspace' once logged into XFCE."

# --- SUMMARY ---
echo ""
echo "======================================================"
echo "  ✅ AETHERDESK NATIVE BOOTSTRAP COMPLETE"
echo "======================================================"
echo "  Access URL    : http://${TAILSCALE_IP:-localhost}:6080/vnc.html"
echo "  VNC Password : $VNC_PASS"
echo "  Resolution   : 1280x800"
echo ""
echo "  INSTRUCTIONS FOR MOBILE:"
echo "  1. Open the URL above in Android/iOS Chrome."
echo "  2. Log in using the password: $VNC_PASS"
echo "  3. Open 'Terminal Emulator' in the XFCE Desktop."
echo "  4. Type 'antigravity' to start your session."
echo "  5. Use Chromium inside the Desktop for Google Login."
echo "======================================================"
