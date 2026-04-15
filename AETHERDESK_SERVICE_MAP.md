# AetherDesk Prime: Unified Service Map (HTTPS)

All services are now secured with **SSL/TLS** using your Tailscale MagicDNS name. This provides a "green lock" and encrypted communication for all trading tools.

### 🏛️ Secure Access Matrix (Tailscale)

| Service | Secure HTTPS Link | Description |
| :--- | :--- | :--- |
| **Unified Portal** | [**https://kamaleswaralgo-vcn.tail716e1a.ts.net/**](https://kamaleswaralgo-vcn.tail716e1a.ts.net/) | Main AetherDesk UI |
| **OpenAlgo** | [**https://kamaleswaralgo-vcn.tail716e1a.ts.net/trading/**](https://kamaleswaralgo-vcn.tail716e1a.ts.net/trading/) | Broker & Order Management |
| **OpenClaw** | [**https://kamaleswaralgo-vcn.tail716e1a.ts.net/openclaw/**](https://kamaleswaralgo-vcn.tail716e1a.ts.net/openclaw/) | Strategy Automation hub |
| **Trading API** | [**https://kamaleswaralgo-vcn.tail716e1a.ts.net/api/v1/**](https://kamaleswaralgo-vcn.tail716e1a.ts.net/api/v1/) | Backend Execution endpoint |
| **Supabase** | [**https://kamaleswaralgo-vcn.tail716e1a.ts.net/supabase/**](https://kamaleswaralgo-vcn.tail716e1a.ts.net/supabase/) | Database & Auth Management |

---

### 🛡️ Compliance & Infrastructure

- **Outbound Regulatory IP**: `80.225.231.3` (Static Oracle IP). Matches your broker's requirement.
- **SSL Status**: ✅ **Valid Certificate** issued by Tailscale (Let's Encrypt).
- **Public access (Non-Tailscale)**: [http://80.225.231.3/](http://80.225.231.3/) (Unsecured — will work once you open Port 80 in OCI).
- **K3s Security**: Port 6443 reached only via `localhost` or Tailscale.

> [!NOTE]
> **Renewal**: Tailscale certificates are short-lived. I have stored the current cert in the `tailscale-tls` secret. You can renew it at any time by running:
> `sudo tailscale cert kamaleswaralgo-vcn.tail716e1a.ts.net` and updating the k8s secret.

**Your AetherDesk Prime ecosystem is now fully migrated, hardened, and secured.**
