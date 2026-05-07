import { memo } from 'react';

/**
 * Minimal markdown renderer — handles **bold** and newlines.
 * No external dependency needed.
 */
function renderMarkdown(text) {
  if (!text) return [];

  // Split on newlines to create paragraphs/lines
  return text.split('\n').map((line, lineIdx) => {
    if (line.trim() === '') {
      return <br key={`br-${lineIdx}`} />;
    }

    // Parse **bold** within each line
    const parts = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(<strong key={`b-${lineIdx}-${match.index}`}>{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <span key={`line-${lineIdx}`} style={{ display: 'block' }}>
        {parts}
      </span>
    );
  });
}

function MessageListBase({ messages }) {
  return (
    <div className="message-list" aria-live="polite">
      {messages.map((message) => (
        <article key={message.id} className={`message ${message.role}`}>
          <p className="message-role">{message.role}</p>
          <div className="message-content">{renderMarkdown(message.content)}</div>
          {message.role === 'assistant' && message.servedBy ? (
            <p className="message-served-by">{message.servedBy}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export const MessageList = memo(MessageListBase);
