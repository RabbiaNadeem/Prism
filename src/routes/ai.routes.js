'use strict';

const express = require('express');

const { createChatCompletion } = require('../services/ai.service');
const { promptSafety } = require('../middleware/promptSafety');
const { createAiCache } = require('../middleware/aiCache');
const { recordCache } = require('../observability/metrics');

const router = express.Router();

const aiCache = createAiCache();

/**
 * @openapi
 * /v1/chat/completions:
 *   post:
 *     tags:
 *       - AI
 *     summary: Create a chat completion
 *     description: Prism gateway endpoint compatible with the OpenAI-style chat completions shape.
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 example: gpt-4.1-mini
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *                 example:
 *                   - role: user
 *                     content: Hello
 *             required:
 *               - messages
 *     responses:
 *       200:
 *         description: Chat completion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid request
 */
const SYSTEM_PROMPT = {
  role: 'system',
  content:
    'You are a helpful assistant. Always format your responses using proper Markdown:\n' +
    '- Start every new heading or numbered point on its own line.\n' +
    '- Use **bold** for headings and key terms.\n' +
    '- Separate each section with a blank line for readability.\n' +
    '- Never write long walls of text; break content into clear, concise paragraphs or lists.',
};

router.post('/chat/completions', promptSafety, async (req, res, next) => {
  try {
    const { messages, stream } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      const err = new Error('`messages` must be a non-empty array');
      err.statusCode = 400;
      throw err;
    }

    if (stream === true) {
      const err = new Error('Streaming is not supported on this endpoint (set `stream: false`)');
      err.statusCode = 400;
      throw err;
    }

    // Inject system prompt if none already provided by the caller.
    const hasSystemPrompt = messages.some((m) => m.role === 'system');
    const enrichedMessages = hasSystemPrompt ? messages : [SYSTEM_PROMPT, ...messages];

    const { result, cacheStatus, providerUsed, modelUsed } = await createChatCompletion(
      { ...req.body, messages: enrichedMessages },
      { cache: aiCache, log: req.log },
    );

    recordCache(cacheStatus);
    res.set('X-Cache', cacheStatus);
    if (providerUsed) res.set('X-Prism-Provider', String(providerUsed));
    if (modelUsed) res.set('X-Prism-Model', String(modelUsed));
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = { aiRouter: router };
