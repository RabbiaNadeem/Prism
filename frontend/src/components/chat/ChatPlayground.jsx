import { useEffect, useMemo, useState } from 'react';
import { createChatCompletion } from '../../lib/apiClient';
import { fetchModelCatalog } from '../../lib/modelCatalog';
import { MessageList } from './MessageList';

const PRISM_API_KEY_STORAGE_KEY = 'prism:adminApiKey';

function buildServedByLabel(providerRaw, modelRaw, catalog) {
  if (!providerRaw && !modelRaw) return '';

  const id =
    typeof providerRaw === 'string' ? providerRaw.trim().toLowerCase().split('-')[0] : '';
  const providerLabel =
    catalog.find((p) => p.id === id)?.label ||
    (id ? id[0].toUpperCase() + id.slice(1) : providerRaw || 'Unknown');

  const modelLabel =
    catalog.flatMap((p) => p.models || []).find((m) => m.id === modelRaw)?.label ||
    (typeof modelRaw === 'string' && modelRaw.trim() ? modelRaw : 'auto');

  return `${providerLabel} - ${modelLabel}`;
}

export function ChatPlayground() {
  const [apiKey, setApiKey] = useState('');
  const [providers, setProviders] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRISM_API_KEY_STORAGE_KEY);
      if (typeof saved === 'string' && saved.trim()) setApiKey(saved);
    } catch {
      // Ignore storage errors (private mode / blocked storage).
    }
  }, []);

  useEffect(() => {
    try {
      if (apiKey.trim()) localStorage.setItem(PRISM_API_KEY_STORAGE_KEY, apiKey);
      else localStorage.removeItem(PRISM_API_KEY_STORAGE_KEY);
    } catch {
      // Ignore storage errors (private mode / blocked storage).
    }
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;
    fetchModelCatalog()
      .then((list) => {
        if (cancelled) return;
        setProviders(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setCatalogError(err?.message || 'Failed to load model catalog');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCatalog = providers.length > 0;
  const canSubmit = apiKey.trim() && prompt.trim() && hasCatalog && !isLoading;
  const messageList = useMemo(() => messages, [messages]);

  const servedByLabel = useMemo(
    () => buildServedByLabel(meta?.providerUsed, meta?.modelUsed, providers),
    [meta?.providerUsed, meta?.modelUsed, providers],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt.trim(),
    };

    setIsLoading(true);
    setError('');
    setMeta(null);
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await createChatCompletion({
        apiKey: apiKey.trim(),
        messages: [{ role: 'user', content: userMessage.content }],
      });

      const assistant = response?.data?.choices?.[0]?.message?.content || 'No response content returned.';
      const servedBy = buildServedByLabel(
        response.meta?.providerUsed,
        response.meta?.modelUsed,
        providers,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistant,
          ...(servedBy ? { servedBy } : {}),
        },
      ]);
      setMeta(response.meta);
      setPrompt('');
    } catch (requestError) {
      setError(requestError.message || 'Request failed.');
      setMeta(requestError.meta || null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClearApiKey() {
    setApiKey('');
  }

  return (
    <section id="playground" className="panel playground-panel">
      <div className="section-heading">
        <p className="eyebrow">Playground</p>
        <h2>Test Prism chat completions instantly</h2>
      </div>

      <div className="playground-split">
        <div className="playground-controls">
          <form className="chat-form" onSubmit={handleSubmit}>
            <label>
              Prism API Key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste once — saved in this browser"
                autoComplete="off"
                required
              />
            </label>
            <div className="row-actions">
              <button className="btn btn-secondary" type="button" onClick={handleClearApiKey} disabled={!apiKey.trim()}>
                Clear saved key
              </button>
            </div>
            <label>
              Prompt
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                placeholder="Ask Prism something..."
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
              {isLoading ? 'Sending...' : 'Send Request'}
            </button>
          </form>

          {catalogError ? (
            <p className="status error">
              {catalogError} (set provider keys in your Prism `.env`, then restart the server)
            </p>
          ) : null}

          {error ? <p className="status error">{error}</p> : null}

          {meta ? (
            <div className="meta-bar" role="status">
              <span>Cache: {meta.cacheStatus ?? 'n/a'}</span>
              <span>
                Rate: {meta.rateLimitRemaining ?? 'n/a'}/{meta.rateLimitLimit ?? 'n/a'}
              </span>
              {meta.retryAfter ? <span>Retry-After: {meta.retryAfter}s</span> : null}
              {servedByLabel ? <span>Served by: {servedByLabel}</span> : null}
            </div>
          ) : null}
        </div>

        <aside className="playground-conversation" aria-label="User and assistant messages">
          <p className="eyebrow">Conversation</p>
          <p className="conversation-hint">Your prompts and assistant replies appear here.</p>
          {messages.length === 0 ? (
            <p className="conversation-empty">No messages yet.</p>
          ) : (
            <MessageList messages={messageList} />
          )}
        </aside>
      </div>
    </section>
  );
}
