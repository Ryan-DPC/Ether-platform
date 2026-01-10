# Tâches restantes pour Ether Platform

## 1. Tests & Validation Fonctionnelle
- [ ] **Chat Global** : Implémenter handler pour `chat:broadcast` (actuellement manquant).
- [ ] **Tests Automatisés** : Créer tests unitaires et d'intégration pour les endpoints critiques.
- [ ] **Tests E2E** : Tests de bout en bout pour les flux utilisateurs (achat, chat, lobby).

## 2. Optimisations & Améliorations
- [ ] **Cache Invalidation** : Configurer invalidation automatique du cache Redis lors des mises à jour (items, jeux).
- [ ] **Gestion d'Erreurs** : Standardiser les messages d'erreur et codes HTTP dans toute l'API.
- [ ] **Logging** : Implémenter un système de logging structuré (Winston/Pino) avec niveaux (debug, info, warn, error).
- [ ] **Rate Limiting** : Ajouter protection contre les abus (limite de requêtes par IP/utilisateur).

## 3. Fonctionnalités Manquantes
- [ ] **Version Checker Job** : Activer et tester le job `version-checker.job.ts` (actuellement commenté).
- [ ] **Notifications Push** : Implémenter notifications desktop (Tauri) pour messages, invitations, etc.
- [ ] **Recherche Avancée** : Filtres multi-critères pour jeux (genre, prix, note, date).
- [ ] **Système de Badges** : Récompenses et achievements pour utilisateurs actifs.

## 4. Sécurité
- [ ] **Validation des Inputs** : Ajouter validation stricte (Zod/Joi) sur tous les endpoints.
- [ ] **Rate Limiting WebSocket** : Limiter fréquence des messages WebSocket par utilisateur.
- [ ] **Audit de Sécurité** : Vérifier les vulnérabilités (injection, XSS, CSRF).
- [ ] **Rotation des Secrets** : Documenter procédure de rotation JWT_SECRET.

## 5. Documentation
- [ ] **README** : Mettre à jour avec architecture actuelle (API REST vs WebSocket).
- [ ] **API Docs** : Documenter tous les endpoints Swagger/OpenAPI (actuellement partiel).
- [ ] **Guide Déploiement** : Procédure complète pour déploiement production (Render, variables d'env).
- [ ] **Guide Contribution** : Standards de code, workflow Git, conventions de nommage.

## 6. DevOps & Monitoring
- [ ] **CI/CD Tests** : Ajouter exécution automatique des tests dans GitHub Actions.
- [ ] **Monitoring Production** : Configurer alertes (Sentry, LogRocket) pour erreurs en prod.
- [ ] **Health Checks** : Endpoints `/health` avec détails (DB, Redis, Cloudinary).
- [ ] **Backups Automatiques** : Stratégie de sauvegarde MongoDB (snapshots hebdomadaires).

## 7. UX/UI
- [ ] **Loading States** : Ajouter skeletons/spinners pour toutes les actions asynchrones.
- [ ] **Gestion Offline** : Comportement gracieux quand API/WebSocket indisponible.
- [ ] **Thème Customisable** : Permettre choix light/dark mode (actuellement forcé dark).
- [ ] **Accessibilité** : Audit WCAG (clavier, lecteurs d'écran, contrastes).

## 8. Performance
- [ ] **Lazy Loading** : Charger images/composants Vue à la demande.
- [ ] **CDN** : Servir assets statiques via CDN (Cloudflare/CloudFront).
- [ ] **Database Indexes** : Auditer et optimiser tous les index MongoDB.
- [ ] **Bundle Size** : Analyser et réduire taille du bundle frontend (code splitting).