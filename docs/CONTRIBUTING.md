# Contributing to Vext

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to Vext. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 🛠️ Project Architecture

Vext is a monorepo managed with **Bun Workspaces**.

- **apps/frontend**: Desktop application built with **Tauri** + **Vue 3**.
- **apps/backend-elysia**: Main REST API built with **Elysia.js**.
- **apps/server**: WebSocket server for real-time features.
- **packages/database**: Shared MongoDB schemas and connection logic.
- **infra**: Docker configurations for local development.

## 🚀 Getting Started

### Prerequisites

- **Docker Desktop** (running)
- **Bun** (latest version)
- **Rust** (for Tauri frontend)

### Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/vext.git
    cd vext
    ```

2.  **Install Dependencies**
    ```bash
    bun install
    ```

3.  **Environment Variables**
    Copy `.env.example` to `.env` in `apps/frontend`, `apps/backend-elysia`, and root if necessary.

4.  **Start Development**
    
    *   **Frontend (Default)**:
        Connects to the remote Render backend. Perfect for UI/UX work.
        ```bash
        cd apps/frontend && bun run tauri dev
        ```

    *   **Backend / Full Stack**:
        Required only if you are modifying the API or Database schemas.
        ```bash
        # Start Infrastructure
        docker-compose -f docker-compose.infra.yml up -d
        
        # Start Services
        cd apps/backend-elysia && bun run dev
        cd apps/server && bun run dev
        ```

## 🤝 Workflow

1.  **Fork the repository**.
2.  **Create a branch** for your feature or fix:
    - `feat/new-awesome-feature`
    - `fix/annoying-bug`
    - `docs/improve-readme`
3.  **Commit your changes** using [Conventional Commits](https://www.conventionalcommits.org/):
    - `feat: add user profile page`
    - `fix: resolve websocket connection timeout`
4.  **Push to your branch**.
5.  **Submit a Pull Request**.

## 🎨 Coding Standards

- **TypeScript**: We use strict typing. Avoid `any` whenever possible.
- **Formatting**: We use **Prettier**. Please run standard formatting before committing.
- **Linting**: We use **ESLint**. logic should be clean and readable.

## 🐛 Reporting Bugs

Bugs are tracked as GitHub issues. When filing an issue, please include:
- A clear title and description.
- Steps to reproduce.
- Expected vs. actual behavior.
- Use the **Bug Report** issue template.

## 💡 Feature Requests

Have an idea? We'd love to hear it! Open an issue using the **Feature Request** template.

---

Thank you for contributing to Vext! 💜
