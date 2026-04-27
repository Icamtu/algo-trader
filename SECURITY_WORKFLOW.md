# AetherDesk Prime: Security Workflow

To prevent accidental secret leaks, we have implemented a multi-layered detection system. This guide explains how to activate the **Local Shield** on your development machine.

## 🛡️ Step 1: Activate Local Protection
We use `pre-commit` to scan your code every time you run `git commit`.

1.  **Install the hooks**:
    Run this in the root of the project to link the security hooks to your git workflow:
    ```bash
    host_venv/bin/pip install pre-commit
    host_venv/bin/pre-commit install
    ```

From now on, if you accidentally include a secret (API Key, Password, etc.) in your commit, `pre-commit` will **block the commit** and show you where the leak is.

## ☁️ Step 2: Cloud Verification
Every Push and Pull Request to GitHub is automatically scanned by **Gitleaks** via GitHub Actions. If a secret is detected, the build will fail, preventing the leak from being merged into `main`.

## 🛑 What to do if a commit is blocked?
If `pre-commit` blocks your work:
1.  **Identify the secret**: The output will tell you which file and line triggered the alert.
2.  **Move it to `.env`**: Never keep secrets in the code. Use `os.getenv()` in Python or `import.meta.env` in the React UI.
3.  **Try again**: Once the secret is removed or moved to `.env`, you can commit successfully.

> [!IMPORTANT]
> If you have a specific reason to commit a file that looks like a secret but isn't (e.g., a dummy test key), you can use `# gitleaks:allow` on that line to ignore it. Use this sparingly!
