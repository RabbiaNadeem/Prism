/* eslint-disable no-control-regex */
'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTextFromMessages(messages) {
  if (!Array.isArray(messages)) return '';
  return messages
    .map((m) => (m && typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .join('\n');
}

function hasJailbreakOrInjectionSignals(text) {
  const t = text.toLowerCase();

  // Very common prompt-injection / jailbreak patterns.
  const patterns = [
    /\b(ignore|disregard|bypass)\b.{0,40}\b(previous|prior|above|earlier)\b.{0,20}\b(instructions|rules|policy|system|developer)\b/i,
    /\b(do anything now|dan\b|jailbreak)\b/i,
    /\b(system prompt|developer message|hidden instructions)\b/i,
    /\b(reveal|show|print|leak|exfiltrate)\b.{0,40}\b(system prompt|developer message|policy|rules|instructions|api key|token|secret|password)\b/i,
    /\b(prompt injection|injection attack)\b/i,
    /\b(begin\s+private\s+key\b|ssh-rsa\b|-----begin\s+(rsa|ec|openssh)\s+private\s+key-----)\b/i,
  ];

  return patterns.some((p) => p.test(t));
}

function hasClearlyHarmfulIntent(text) {
  const t = text.toLowerCase();

  // Heuristic: block obvious requests for violence/weapons, self-harm encouragement, or malware.
  const patterns = [
    /\b(how to (make|build) (a|an)?\s*(bomb|pipe bomb|explosive))\b/i,
    /\b(buy|build|make)\b.{0,30}\b(ghost gun|silencer|suppressor)\b/i,
    /\b(kill yourself|suicide|self harm)\b/i,
    /\b(write (a|an)?\s*(virus|malware|ransomware|keylogger))\b/i,
    /\b(steal|bypass)\b.{0,30}\b(passwords|2fa|otp)\b/i,
  ];

  return patterns.some((p) => p.test(t));
}

function createPromptSafetyMiddleware(options = {}) {
  const enabled = options.enabled ?? process.env.PROMPT_SAFETY_ENABLED ?? 'true';
  const isEnabled = String(enabled).toLowerCase() !== 'false';

  return function promptSafety(req, res, next) {
    try {
      if (!isEnabled) return next();

      const { messages } = req.body || {};
      const rawText = extractTextFromMessages(messages);
      const text = normalizeText(rawText);

      if (!text) return next();

      const looksBad = hasJailbreakOrInjectionSignals(text) || hasClearlyHarmfulIntent(text);
      if (!looksBad) return next();

      const err = new Error('Prompt rejected by safety policy');
      err.statusCode = 400;
      return next(err);
    } catch (err) {
      return next(err);
    }
  };
}

const promptSafety = createPromptSafetyMiddleware();

module.exports = { createPromptSafetyMiddleware, promptSafety };
