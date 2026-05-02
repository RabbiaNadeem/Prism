'use strict';

const CATALOG = [
  {
    id: 'groq',
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      // Groq exposes 70B as "versatile" (no separate *-instant id for 3.3 70B).
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'openrouter/auto', label: 'Auto-route' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (via OpenRouter)' },
    ],
  },
];

function getAvailableProviders(env = process.env) {
  return CATALOG.filter(
    (provider) => typeof env[provider.envKey] === 'string' && env[provider.envKey].trim().length > 0,
  ).map(({ envKey: _envKey, ...rest }) => rest);
}

module.exports = { CATALOG, getAvailableProviders };
