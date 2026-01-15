# 🤝 Contributing to Vext Platform

We welcome contributions! To maintain a high-quality codebase, please follow these guidelines.

## 🌿 Branching Strategy

We use a simplified Feature Branch workflow:

1.  **`main`**: Production-ready code. Do not push directly here.
2.  **`develop`** (Optional): Integration branch for next release.
3.  **`feat/feature-name`**: For new features (e.g., `feat/inventory-system`).
4.  **`fix/bug-name`**: For bug fixes (e.g., `fix/turn-order-crash`).
5.  **`refactor/component`**: For code cleanup without logic changes.

**Workflow:**
1. Create a branch: `git checkout -b feat/new-skill-system`
2. Commit often.
3. Open a Pull Request (PR).

## 🦀 Coding Standards (Rust)

- **Formatting**: Always run `cargo fmt` before committing.
- **Linting**: Ensure `cargo check` passes without warnings. We aim for 0 warnings.
- **Variable Naming**: Use `snake_case` for variables/functions, `CamelCase` for Structs/Enums.
- **Comments**: Comment complex logic, specifically in `turn.rs` and `main.rs`.

## 📁 Asset Management

- **Characters**: New characters must follow the Markdown template in `games/aether_strike/assets/character/_template.md` (if exists) or copy an existing one.
- **Images**: Optimize PNGs before adding them to keep repo size low.

## 🧪 Testing

- If you modify the **Turn System**, test:
    1. Single player logic (Speed sorting).
    2. Dead entity removal (Kill a minion, ensure valid next turn).
    3. Round reset functionality.

Thank you for building Vext with us!
