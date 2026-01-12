# Contribuer à Vext

Merci de prendre le temps de contribuer ! 🎉

Voici quelques directives pour contribuer à Vext. Ce sont des conseils, pas des règles strictes. Utilisez votre jugement et n'hésitez pas à proposer des modifications à ce document via une Pull Request.

## 🛠️ Architecture du Projet

Vext est un monorepo géré avec **Bun Workspaces**.

- **apps/frontend** : Application Desktop construite avec **Tauri** + **Vue 3**.
- **apps/backend-elysia** : API REST principale avec **Elysia.js**.
- **apps/server** : Serveur WebSocket pour le temps réel.
- **packages/database** : Schémas MongoDB partagés et logique de connexion.
- **infra** : Configuration Docker pour le développement local.

## 🚀 Pour Commencer

### Prérequis

- **Docker Desktop** (lancé)
- **Bun** (dernière version)
- **Rust** (pour le frontend Tauri)

### Installation

1.  **Cloner le dépôt**
    ```bash
    git clone https://github.com/votre-username/vext.git
    cd vext
    ```

2.  **Installer les dépendances**
    ```bash
    bun install
    ```

3.  **Variables d'Environnement**
    Copiez `.env.example` en `.env` à la racine (et dans les apps si nécessaire).

4.  **Démarrer le Développement**
    
    *   **Frontend (Par défaut)** :
        Se connecte au backend distant (Render). Idéal pour travailler sur l'interface.
        ```bash
        cd apps/frontend && bun run tauri dev
        ```

    *   **Backend / Full Stack** :
        Nécessaire seulement si vous modifiez l'API ou la base de données.
        ```bash
        # Démarrer l'infrastructure (DB/Redis)
        docker-compose -f docker-compose.infra.yml up -d
        
        # Démarrer les services
        cd apps/backend-elysia && bun run dev
        cd apps/server && bun run dev
        ```

## 🤝 Workflow

1.  **Forker le projet**.
2.  **Créer une branche** pour votre fonctionnalité :
    - `feat/nouvelle-super-feature`
    - `fix/bug-relou`
3.  **Committez vos changements** en utilisant [Conventional Commits](https://www.conventionalcommits.org/) :
    - `feat: add user profile page`
    - `fix: resolve websocket connection timeout`
4.  **Pushez sur votre branche**.
5.  **Soumettez une Pull Request**.

## 🎨 Standards de Code

- **TypeScript** : Typage strict. Évitez `any`.
- **Formatage** : Nous utilisons **Prettier**.
- **Linting** : Nous utilisons **ESLint**.

## 🐛 Signaler un Bug

Les bugs sont suivis via les Issues GitHub. Incluez :
- Un titre clair.
- Les étapes pour reproduire.
- Le comportement attendu vs réel.
- Utilisez le template **Bug Report**.

---

Merci de contribuer à Vext ! 💜
