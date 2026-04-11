'use strict';

async function createChatCompletion({ model, messages }) {
  const created = Math.floor(Date.now() / 1000);

  const lastUserMessage = Array.isArray(messages)
    ? [...messages].reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string')
    : null;

  const content = lastUserMessage?.content
    ? `Echo: ${lastUserMessage.content}`
    : 'Echo: (no user message provided)';

  return {
    id: `chatcmpl_${created}`,
    object: 'chat.completion',
    created,
    model: model || 'prism-echo',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
  };
}

module.exports = { createChatCompletion };
