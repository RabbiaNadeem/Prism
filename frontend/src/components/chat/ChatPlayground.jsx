import { useEffect, useMemo, useState } from 'react';
import { createChatCompletion } from '../../lib/apiClient';
import { fetchModelCatalog } from '../../lib/modelCatalog';
import { MessageList } from './MessageList';

export function ChatPlayground() {
  const [apiKey, setApiKey] = useState('');
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState('');
  const [modelId, setModelId] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchModelCatalog()
      .then((list) => {
        if (cancelled) return;
        setProviders(list);
        const firstProvider = list[0];
        if (firstProvider) {
          setProviderId(firstProvider.id);
          setModelId(firstProvider.models?.[0]?.id || '');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setCatalogError(err?.message || 'Failed to load model catalog');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === providerId) || null,
    [providers, providerId],
  );

  const modelOptions = selectedProvider?.models || [];

  const hasCatalog = providers.length > 0 && !!providerId && !!modelId;
  const canSubmit = apiKey.trim() && prompt.trim() && hasCatalog && !isLoading;
  const messageList = useMemo(() => messages, [messages]);

  function handleProviderChange(event) {
    const next = event.target.value;
    setProviderId(next);
    const provider = providers.find((p) => p.id === next);
    setModelId(provider?.models?.[0]?.id || '');
  }

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
        provider: providerId,
        model: modelId,
        messages: [{ role: 'user', content: userMessage.content }],
      });

      const assistant = response?.data?.choices?.[0]?.message?.content || 'No response content returned.';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: assistant },
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

  return (
    <section id="playground" className="panel">
      <div className="section-heading">
        <p className="eyebrow">Playground</p>
        <h2>Test Prism chat completions instantly</h2>
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label>
          Prism API Key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste allowed key"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Provider
          <select
            value={providerId}
            onChange={handleProviderChange}
            disabled={providers.length === 0}
          >
            {providers.length === 0 ? (
              <option value="">No providers configured</option>
            ) : (
              providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Model
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={modelOptions.length === 0}
          >
            {modelOptions.length === 0 ? (
              <option value="">No models available</option>
            ) : (
              modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))
            )}
          </select>
        </label>
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
          <span>Cache: {meta.cacheStatus || 'n/a'}</span>
          <span>
            Rate: {meta.rateLimitRemaining || 'n/a'}/{meta.rateLimitLimit || 'n/a'}
          </span>
          <span>Retry-After: {meta.retryAfter || 'n/a'}</span>
        </div>
      ) : null}

      <MessageList messages={messageList} />
    </section>
  );
}
