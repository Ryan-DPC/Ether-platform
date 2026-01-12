export const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL;
  const isTauri = !!(window as any).__TAURI__;

  if (isTauri) {
    if (!url) {
      return 'https://vext-backend.onrender.com';
    }
  }

  if (url) return url;
  return 'https://vext-backend.onrender.com'; // Default to production instead of relative/empty
};
