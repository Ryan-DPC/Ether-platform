# VEXT

<div align="center">

  ![Vext Banner](https://via.placeholder.com/1200x400?text=VEXT+Gaming+Platform)
  
  **The Next-Gen Decentralized Gaming Platform & Social Network**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)](https://tauri.app)
  [![Bun](https://img.shields.io/badge/Bun-1.0-orange)](https://bun.sh)
  [![Vue 3](https://img.shields.io/badge/Vue-3.0-42b883)](https://vuejs.org)
  [![ElysiaJS](https://img.shields.io/badge/Elysia-JS-ff0050)](https://elysiajs.com)

  [Features](#-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Contributing](#-contributing)

</div>

---

## 🚀 Overview

**Vext** is a modern game distribution platform designed to bridge the gap between players and developers. More than just a store, Vext is a fully integrated social ecosystem offering real-time interaction, lobbies, and a seamless desktop experience.

Built with performance in mind using **Rust (Tauri)** and **Bun**, Vext delivers a native-like feel with the flexibility of web technologies.

## ✨ Features

- **🎮 Digital Marketplace**: Buy, sell, and manage your game library with a unique ownership system.
- **💬 Social Hub**: Real-time chat, friends system, and status updates via specialized WebSocket architecture.
- **🔌 Lobbies & Matchmaking**: Create rooms, invite friends, and launch games together seamlessly.
- **⚡ Native Performance**: Powered by Tauri for an ultra-lightweight and fast desktop experience (Windows/Linux/macOS).
- **💰 Economy**: integrated multi-currency wallet support (VTX, CHF, EUR).

## 🏗️ Architecture

Vext operates as a **Monorepo** powered by **Bun Workspaces**.

| Component | Tech Stack | Description |
| :--- | :--- | :--- |
| **Frontend** | **Tauri** + **Vue 3** + **TypeScript** | The desktop client application. |
| **Backend API** | **Elysia.js** + **Bun** | High-performance REST API for Authentication, Marketplace, and Users. |
| **Real-time Server** | **Elysia.js** (WebSocket) | Dedicated socket server for Chat, Notifications, and Lobbies. |
| **Database** | **MongoDB** + **Redis** | Data persistence and high-speed caching layer. |
| **Infrastructure** | **Docker** | Containerized deployment for all backend services. |

## 🛠️ Getting Started

Follow these steps to set up Vext locally for development.

### Prerequisites
- **Docker Desktop** (Required for DB/Redis)
- **Bun** (Latest version)
- **Rust** (Required for Tauri)

### Installation

1.  **Clone the Repo**
    ```bash
    git clone https://github.com/your-username/vext.git
    cd vext
    ```

2.  **Install Dependencies**
    ```bash
    bun install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root (and apps if needed) based on `.env.example`.

4.  **Start the Application**
    
    By default, the Frontend connects to the **Render hosted backend**. You don't need to run the server locally.

    *   **Frontend Only (Recommended)**:
        ```bash
        cd apps/frontend && bun run tauri dev
        ```

    *   **Full Local Stack (Optional)**:
        If you want to work on the Backend API:
        1.  Start DB/Redis: `docker-compose -f docker-compose.infra.yml up -d`
        2.  Run Backend: `cd apps/backend && bun run dev`
        3.  Run WebSocket: `cd apps/server && bun run dev`

## 🤝 Contributing

We welcome contributions from the community! Whether it's a bug fix, new feature, or documentation improvement.

Please read our [**Contributing Guide**](docs/CONTRIBUTING.md) and [**Code of Conduct**](docs/CODE_OF_CONDUCT.md) located in the `docs/` folder before getting started.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ by the Vext Team</sub>
</div>
