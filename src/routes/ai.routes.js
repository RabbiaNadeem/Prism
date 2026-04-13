'use strict';

const express = require('express');

const { createChatCompletion } = require('../services/ai.service');

const router = express.Router();

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
router.post('/chat/completions', async (req, res, next) => {
  try {
    const { model, messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      const err = new Error('`messages` must be a non-empty array');
      err.statusCode = 400;
      throw err;
    }

    const result = await createChatCompletion({ model, messages });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = { aiRouter: router };
