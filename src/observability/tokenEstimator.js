'use strict';

function estimateTextTokens(value) {
  if (typeof value !== 'string' || !value.trim()) return 0;
  // Approximation: 1 token ~= 4 chars for English-like text.
  return Math.max(1, Math.ceil(value.length / 4));
}

function estimateInputTokens(messages) {
  if (!Array.isArray(messages)) return 0;

  return messages.reduce((acc, message) => {
    if (!message || typeof message !== 'object') return acc;
    const roleTokens = estimateTextTokens(String(message.role || ''));
    const content = typeof message.content === 'string' ? message.content : '';
    // Add small structural overhead per message.
    return acc + roleTokens + estimateTextTokens(content) + 4;
  }, 0);
}

function estimateOutputTokens(result) {
  if (!result || typeof result !== 'object') return 0;
  if (Number.isInteger(result?.usage?.completion_tokens)) return result.usage.completion_tokens;

  const choices = Array.isArray(result.choices) ? result.choices : [];
  const combined = choices
    .map((choice) => choice?.message?.content)
    .filter((content) => typeof content === 'string' && content.length > 0)
    .join('\n');

  return estimateTextTokens(combined);
}

module.exports = {
  estimateInputTokens,
  estimateOutputTokens,
};
