'use client';

import { useState, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  timestamp: Date;
}

interface AgentChatProps {
  onMessage?: (message: string) => Promise<void>;
  simulateResponse?: (userMessage: string) => Promise<Message[]>;
  placeholder?: string;
  systemPrompt?: string;
}

export function AgentChat({
  simulateResponse,
  placeholder = 'Type your message...',
  systemPrompt,
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      if (simulateResponse) {
        const responses = await simulateResponse(userMessage.content);
        for (const response of responses) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          setMessages((prev) => [...prev, response]);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800">
      {systemPrompt && (
        <div className="p-3 bg-gray-800/50 border-b border-gray-700 rounded-t-lg">
          <p className="text-xs text-purple-400 font-semibold mb-1">System</p>
          <p className="text-xs text-gray-400">{systemPrompt}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-blue-600 text-white rounded-lg px-4 py-2">
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            )}

            {message.role === 'assistant' && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-gray-800 text-gray-100 rounded-lg px-4 py-2">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            )}

            {message.role === 'tool' && (
              <div className="flex justify-center">
                <div className="max-w-[90%] bg-amber-900/20 border border-amber-700/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <p className="text-xs font-semibold text-amber-400">
                      Tool: {message.toolName}
                    </p>
                  </div>

                  {message.toolInput && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Input:</p>
                      <pre className="text-xs bg-gray-900/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(message.toolInput, null, 2)}
                      </pre>
                    </div>
                  )}

                  {message.toolOutput && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Output:</p>
                      <pre className="text-xs bg-gray-900/50 p-2 rounded overflow-x-auto">
                        {message.toolOutput}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs">Processing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isProcessing}
            className="flex-1 bg-gray-800 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
