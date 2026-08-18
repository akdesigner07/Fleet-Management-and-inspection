export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  return isLocal ? 'http://localhost:5000' : 'https://node.reviewelp.com';
};

export const getAssetBaseUrl = () => {
  const apiBase = getApiBaseUrl();
  const assetBase = apiBase.includes('node.reviewelp.com')
    ? 'https://node.reviewelp.com/backend'
    : apiBase;
  
  console.log('[API Config] Resolved API Base:', apiBase, '| Resolved Asset Base:', assetBase);
  return assetBase;
};

export const API_BASE_URL = getApiBaseUrl();
export const ASSET_BASE_URL = getAssetBaseUrl();
