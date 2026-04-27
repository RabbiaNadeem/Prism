import { useMemo, useState } from 'react';
import { createChatCompletion } from '../../lib/apiClient';
import { MessageList } from './MessageList';

export function ChatPlayground() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);

  const canSubmit = apiKey.trim() && prompt.trim() && !isLoading;
  const messageList = useMemo(() => messages, [messages]);

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
        model: model.trim(),
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
          Model
          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="gpt-4.1-mini"
          />
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
