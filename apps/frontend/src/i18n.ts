import { createI18n } from 'vue-i18n';

const messages = {
  English: {
    settings: {
      title: '{tab} SETTINGS',
      tabs: {
        Account: 'Account',
        Profile: 'Profile',
        Security: 'Security',
        Notifications: 'Notifications',
        Appearance: 'Appearance',
      },
      account: {
        username: 'Username',
        email: 'Email',
        language: 'Language',
        bio: 'Bio',
        social_links: 'Social Links',
        twitter: 'Twitter',
        discord: 'Discord',
        website: 'Website',
      },
      security: {
        current_password: 'Current Password',
        new_password: 'New Password',
        confirm_password: 'Confirm Password',
        update_btn: 'UPDATE PASSWORD',
      },
      appearance: {
        display_mode: 'Display Mode',
        dark_mode: 'Dark Mode',
        dark_mode_desc: 'Toggle between Light and Dark interface.',
        themes: 'Themes',
        community_plugins: 'Community Plugins',
        no_plugins: 'No plugins installed.',
        install_plugin: '+ Install Plugin',
        remove: 'Remove',
      },
      save_btn: 'SAVE CHANGES',
      saving: 'SAVING...',
    },
  },
  French: {
    settings: {
      title: 'PARAMÈTRES {tab}',
      tabs: {
        Account: 'Compte',
        Profile: 'Profil',
        Security: 'Sécurité',
        Notifications: 'Notifications',
        Appearance: 'Apparence',
      },
      account: {
        username: "Nom d'utilisateur",
        email: 'Email',
        language: 'Langue',
        bio: 'Biographie',
        social_links: 'Réseaux Sociaux',
        twitter: 'Twitter',
        discord: 'Discord',
        website: 'Site Web',
      },
      security: {
        current_password: 'Mot de passe actuel',
        new_password: 'Nouveau mot de passe',
        confirm_password: 'Confirmer le mot de passe',
        update_btn: 'METTRE À JOUR',
      },
      appearance: {
        display_mode: "Mode d'affichage",
        dark_mode: 'Mode Sombre',
        dark_mode_desc: "Basculer entre l'interface claire et sombre.",
        themes: 'Thèmes',
        community_plugins: 'Plugins Communautaires',
        no_plugins: 'Aucun plugin installé.',
        install_plugin: '+ Installer un plugin',
        remove: 'Supprimer',
      },
      save_btn: 'ENREGISTRER',
      saving: 'ENREGISTREMENT...',
    },
  },
  Spanish: {
    settings: {
      title: 'AJUSTES DE {tab}',
      tabs: {
        Account: 'Cuenta',
        Profile: 'Perfil',
        Security: 'Seguridad',
        Notifications: 'Notificaciones',
        Appearance: 'Apariencia',
      },
      account: {
        username: 'Nombre de usuario',
        email: 'Correo electrónico',
        language: 'Idioma',
        bio: 'Biografía',
        social_links: 'Redes Sociales',
        twitter: 'Twitter',
        discord: 'Discord',
        website: 'Sitio Web',
      },
      security: {
        current_password: 'Contraseña actual',
        new_password: 'Nueva contraseña',
        confirm_password: 'Confirmar contraseña',
        update_btn: 'ACTUALIZAR CONTRASEÑA',
      },
      appearance: {
        display_mode: 'Modo de visualización',
        dark_mode: 'Modo Oscuro',
        dark_mode_desc: 'Alternar entre interfaz clara y oscura.',
        themes: 'Temas',
        community_plugins: 'Plugins de la comunidad',
        no_plugins: 'No hay plugins instalados.',
        install_plugin: '+ Instalar plugin',
        remove: 'Eliminar',
      },
      save_btn: 'GUARDAR CAMBIOS',
      saving: 'GUARDANDO...',
    },
  },
};

const i18n = createI18n({
  legacy: false, // you must set `false`, to use Composition API
  locale: 'English', // set locale
  fallbackLocale: 'English', // set fallback locale
  messages, // set locale messages
});

export default i18n;
