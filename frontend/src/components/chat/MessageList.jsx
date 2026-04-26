import { memo } from 'react';

function MessageListBase({ messages }) {
  return (
    <div className="message-list" aria-live="polite">
      {messages.map((message) => (
        <article key={message.id} className={`message ${message.role}`}>
          <p className="message-role">{message.role}</p>
          <p>{message.content}</p>
        </article>
      ))}
    </div>
  );
}

export const MessageList = memo(MessageListBase);
