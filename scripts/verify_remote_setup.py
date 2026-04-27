import subprocess
import os

def check_service(name):
    try:
        status = subprocess.check_output(["systemctl", "is-active", name]).decode().strip()
        return status == "active"
    except:
        return False

def check_port(port):
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except:
        return False

def run_diagnostics():
    print("📋 Running System Diagnostics...")

    services = {
        "vncserver@1": "VNC Desktop Server",
        "novnc": "noVNC Web Interface",
        "docker": "Docker Engine"
    }

    all_ok = True
    for svc, desc in services.items():
        if check_service(svc):
            print(f"✅ {desc} is RUNNING")
        else:
            print(f"❌ {desc} is STOPPED")
            all_ok = False

    ports = {
        5901: "VNC Core",
        6080: "noVNC Web (Mobile Entry)",
        80: "AetherDesk Dashboard"
    }

    for port, desc in ports.items():
        if check_port(port):
            print(f"✅ Port {port} ({desc}) is OPEN")
        else:
            print(f"⚠️  Port {port} ({desc}) is CLOSED")
            # Port 80 might be closed until docker compose up is run

    # Check for antigravity binary
    try:
        version = subprocess.check_output(["antigravity", "--version"], stderr=subprocess.STDOUT).decode().strip()
        print(f"✅ Antigravity Agent detected: {version}")
    except:
        print("❌ Antigravity Agent NOT FOUND in PATH")
        all_ok = False

    if all_ok:
        print("\n✨ SYSTEM READY for Mobile Access!")
        try:
            ip = subprocess.check_output(["tailscale", "ip", "-4"]).decode().strip()
            print(f"🔗 URL: http://{ip}:6080/vnc.html")
        except:
            print("🔗 URL: http://<your-public-ip>:6080/vnc.html")
    else:
        print("\n⚠️  Some components are missing. Check the setup logs.")

if __name__ == "__main__":
    run_diagnostics()
