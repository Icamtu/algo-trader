# Algo-Trader Workspace 🚀

A comprehensive, containerized algorithmic trading ecosystem. This workspace combines a modern web frontend, a robust Python trading engine, and advanced middleware to interface with brokers securely and elegantly.

## 🌟 Key Features

* **Real-time Dashboard**: A sleek, professional trading UI built with SvelteKit & TypeScript.
* **Algo-Engine**: A Python Flask backend featuring multi-strategy execution, local SQLite trade logging, and robust risk management.
* **Seamless Broker Integration**: Native connectivity to Shoonya Broker via OpenAlgo.
* **LLM Analytics**: OpenClaw service integration for smart query, reporting, and trade summarizations limitlessly.
* **Trade Blotters & Tracking**: View your real-time aggregate positions, un-realized/realized P&L, and complete trade histories dynamically without logging into the broker application directly.

## 🏗 System Architecture

The entire stack is orchestrated seamlessly using Docker Compose:

1. **`openalgo`**: The broker connectivity service communicating with Shoonya APIs locally via `localhost:5000`.
2. **`algo-trader`**: The core execution system (Python/Flask). Reads strategies, logs trades onto SQLite, and provides internal REST APIs (`localhost:5001`).
3. **`trading-ui`**: The client-facing visual interface built on SvelteKit (`localhost:3000`).
4. **`redis`**: Sub-millisecond volatility caching and socket messaging layer.
5. **`openclaw`**: The generative AI gateway for fetching actionable insights securely.

## 📂 Directory Structure

```text
trading-workspace/
├── algo-trader/          # The Python algorithmic execution engine
├── trading-ui/           # SvelteKit modern user interface
├── data/                 # Local data storage for Postgres / SQLite
├── scripts/              # Utility scripts for setups and DB initialization
├── docker-compose.yml    # Root container orchestrator
├── .env                  # Core system environment variables (IGNORED IN GIT)
└── PROGRESS.md           # Developer progress tracking & phases
```

## 🚀 Quick Start

Ensure you have Docker and Docker Compose installed.

**1. Copy and Configure the Environment File:**
```bash
cp .env.example .env
# Edit the .env to add your API keys including ANTHROPIC_API_KEY and BROKER_API_KEY
```

**2. Launch the Application Stack:**
```bash
docker-compose up -d --build
```

**3. Access the Services:**
* **Frontend UI Dashboard**: `http://localhost:3000`
* **Backend Algo API**: `http://localhost:5001/health`
* **OpenAlgo Broker Connect**: `http://localhost:5000`

## 🔒 Security Best Practices
- **Do not commit `.env`!** Ensure it remains in your `.gitignore`.
- Update standard passwords (such as `READ_ONLY_PWD` for database access) frequently if opening this app beyond the local network.

## 🛠 Active Development

We rely strictly on `docker-compose.yml` to define our infrastructure configuration. See `PROGRESS.md` for a deeper dive into recently shipped phases and API specifications!
