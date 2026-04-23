'use strict';

const { createLlmRouter } = require('./llmRouter');

// Singleton router instance (providers are read from env).
const llmRouter = createLlmRouter();

/**
 * Create an OpenAI-compatible chat completion.
 *
 * @param {object} params OpenAI request body
 * @param {object} ctx { cache, log }
 * @returns {Promise<{result: object, cacheStatus: 'HIT'|'MISS'|'BYPASS'}>}
 */
async function createChatCompletion(params = {}, ctx = {}) {
  return llmRouter.createChatCompletion(params, ctx);
}

module.exports = { createChatCompletion };
