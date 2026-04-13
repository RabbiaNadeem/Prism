'use strict';

const express = require('express');

const { createChatCompletion } = require('../services/ai.service');
const { promptSafety } = require('../middleware/promptSafety');
const { createAiCache } = require('../middleware/aiCache');

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
router.post('/chat/completions', promptSafety, async (req, res, next) => {
  try {
    const { model, messages, stream } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      const err = new Error('`messages` must be a non-empty array');
      err.statusCode = 400;
      throw err;
    }

    // Cache runs before calling any provider/LLM.
    // Only cache non-streaming requests.
    if (aiCache.enabled && stream !== true) {
      const key = aiCache.chatKey({ model, messages });

      try {
        const cached = await aiCache.get(key);
        if (cached) {
          res.set('X-Cache', 'HIT');
          return res.status(200).json(cached);
        }
      } catch (err) {
        req.log?.warn({ err }, 'AI cache read failed (bypassing)');
      }

      res.set('X-Cache', 'MISS');
      const result = await createChatCompletion({ model, messages });

      try {
        await aiCache.set(key, result);
      } catch (err) {
        req.log?.warn({ err }, 'AI cache write failed (bypassing)');
      }

      return res.status(200).json(result);
    }

    res.set('X-Cache', 'BYPASS');

    const result = await createChatCompletion({ model, messages });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = { aiRouter: router };
