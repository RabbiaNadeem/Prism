const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function fetchModelCatalog() {
  const response = await fetch(`${API_BASE_URL}/providers/models`);
  if (!response.ok) {
    throw new Error(`Failed to load model catalog (HTTP ${response.status})`);
  }
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data?.providers) ? data.providers : [];
}
