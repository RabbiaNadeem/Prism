'use strict';

const CATALOG = [
  {
    id: 'groq',
    label: 'Groq',
    envKeys: ['GROQ_API_KEY', 'GROQ_API_KEYS'],
    models: [
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      // Groq exposes 70B as "versatile" (no separate *-instant id for 3.3 70B).
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    envKeys: ['GEMINI_API_KEY', 'GEMINI_API_KEYS'],
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
];

function getAvailableProviders(env = process.env) {
  return CATALOG.filter((provider) => {
    const keys = Array.isArray(provider.envKeys) ? provider.envKeys : [];
    return keys.some((k) => typeof env[k] === 'string' && env[k].trim().length > 0);
  }).map(({ envKeys: _envKeys, ...rest }) => rest);
}

module.exports = { CATALOG, getAvailableProviders };
