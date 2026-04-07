import docker
import requests
import os
import time
import threading
import psutil

# Configuration from environment variables
TOKEN = os.getenv('MONITOR_TELEGRAM_BOT_TOKEN') or os.getenv('TELEGRAM_BOT_TOKEN')
CHAT_ID = os.getenv('MONITOR_TELEGRAM_CHAT_ID') or os.getenv('TELEGRAM_CHAT_ID')
HOST_NAME = os.getenv('HOST_SERVER', 'OpenAlgo-Server')
ENABLE_COMMANDS = os.getenv('MONITOR_ENABLE_TELEGRAM_COMMANDS', 'false').strip().lower() in {
    '1',
    'true',
    'yes',
    'on',
}

def send_telegram_message(message):
    if not TOKEN or not CHAT_ID:
        print("Telegram configuration missing. Message not sent.")
        return
    
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
    except Exception as e:
        print(f"Error sending Telegram message: {e}")

def get_system_stats():
    cpu = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/').percent
    return f"💻 <b>Host Stats</b>\n" \
           f"CPU: <code>{cpu}%</code>\n" \
           f"RAM: <code>{ram}%</code>\n" \
           f"Disk: <code>{disk}%</code>\n" \
           f"Host: <code>{HOST_NAME}</code>"

def get_node_status():
    client = docker.from_env()
    try:
        containers = client.containers.list(all=True)
        status_msg = "🔌 <b>Node Status</b>\n"
        for c in containers:
            # Skip the monitor container itself to reduce noise if preferred, 
            # but usually it's good to see it's running.
            status = "🟢" if c.status == 'running' else "🔴"
            status_msg += f"{status} <code>{c.name}</code>: {c.status}\n"
        return status_msg
    except Exception as e:
        return f"❌ Error getting status: {e}"

def handle_commands():
    last_update_id = 0
    print("Command handler started...")
    while True:
        try:
            # Long polling for updates
            url = f"https://api.telegram.org/bot{TOKEN}/getUpdates?offset={last_update_id + 1}&timeout=30"
            response = requests.get(url, timeout=35)
            if response.status_code == 200:
                updates = response.json().get('result', [])
                for update in updates:
                    last_update_id = update['update_id']
                    message = update.get('message', {})
                    text = message.get('text', '')
                    sender_chat_id = str(message.get('chat', {}).get('id', ''))
                    
                    # Security: Only respond to the authorized Chat ID
                    if sender_chat_id == CHAT_ID:
                        if text == '/host-check':
                            send_telegram_message(get_system_stats())
                        elif text == '/node-connect':
                            send_telegram_message(get_node_status())
                        elif text == '/help' or text == '/start':
                            send_telegram_message("🤖 <b>Available Commands</b>\n"
                                                 "/host-check - System health report\n"
                                                 "/node-connect - Cluster status\n"
                                                 "/help - Show this menu")
            time.sleep(1)
        except Exception as e:
            print(f"Command handler error: {e}")
            time.sleep(5)

def monitor_events():
    client = docker.from_env()
    print(f"Monitoring Docker events on {HOST_NAME}...")
    
    # Send startup notification
    send_telegram_message(f"🚀 <b>Monitoring Started</b>\n"
                         f"Host: <code>{HOST_NAME}</code>\n"
                         f"Watching all containers for status changes.")

    for event in client.events(decode=True):
        status = event.get('status')
        name = event.get('Actor', {}).get('Attributes', {}).get('name', 'Unknown')
        
        # We are interested in these events
        if status in ['die', 'unhealthy', 'oom']:
            emoji = "⚠️" if status == 'unhealthy' else "🔴"
            msg = f"{emoji} <b>Container Alert!</b>\n" \
                  f"Container: <code>{name}</code>\n" \
                  f"Event: <b>{status.upper()}</b>\n" \
                  f"Host: <code>{HOST_NAME}</code>"
            send_telegram_message(msg)
            print(f"Alert sent for {name}: {status}")
        
        elif status in ['start', 'restart']:
            msg = f"🟢 <b>Container Recovered</b>\n" \
                  f"Container: <code>{name}</code>\n" \
                  f"Event: <b>{status.upper()}</b>\n" \
                  f"Host: <code>{HOST_NAME}</code>"
            send_telegram_message(msg)
            print(f"Info sent for {name}: {status}")

if __name__ == "__main__":
    if ENABLE_COMMANDS:
        # Command polling uses Telegram getUpdates, which must not share a token
        # with another long-polling bot such as OpenClaw.
        cmd_thread = threading.Thread(target=handle_commands, daemon=True)
        cmd_thread.start()
    else:
        print("Telegram command polling disabled; running in alert-only mode.")
    
    while True:
        try:
            monitor_events()
        except Exception as e:
            print(f"Monitor crashed, restarting in 10s: {e}")
            time.sleep(10)
