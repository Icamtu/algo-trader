import os
import re

def sanitize_env(input_path, output_path):
    print(f"📁 Reading source .env from {input_path}...")
    if not os.path.exists(input_path):
        print("❌ Error: .env file not found!")
        return

    with open(input_path, 'r') as f:
        lines = f.readlines()

    sanitized_lines = []
    # Patterns for instance-specific or sensitive values we might want to flag
    # But for a direct migration, we mostly want to ensure TAILSCALE_IP is cleared
    # so it can be re-detected on the new host.

    for line in lines:
        if line.startswith("TAILSCALE_IP="):
            sanitized_lines.append("# TAILSCALE_IP= (Auto-detected on new host)\n")
        elif line.startswith("VITE_SUPABASE_URL="):
            # Keep but flag
            sanitized_lines.append(line)
        else:
            sanitized_lines.append(line)

    with open(output_path, 'w') as f:
        f.writelines(sanitized_lines)

    print(f"✅ Sanitized .env written to {output_path}")
    print("💡 Copy this file to your new instance's root directory.")

if __name__ == "__main__":
    sanitize_env(".env", ".env.migration")
