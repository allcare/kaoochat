'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat history from OpenClaw on mount
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await fetch('/api/chat/history');
        if (response.ok) {
          const history = await response.json();
          if (history.messages && history.messages.length > 0) {
            // Convert OpenClaw messages to our format
            const formattedMessages = history.messages.map((msg: any, index: number) => {
              // Extract text content from OpenClaw's content array
              let textContent = '';

              if (typeof msg.content === 'string') {
                textContent = msg.content;
              } else if (Array.isArray(msg.content)) {
                // Extract only pure text blocks (skip thinking, toolCall, toolResult)
                textContent = msg.content
                  .filter((block: any) =>
                    block.type === 'text' &&
                    block.text &&
                    // Skip text blocks that look like JSON tool results
                    !block.text.trim().startsWith('{') &&
                    !block.text.trim().startsWith('[')
                  )
                  .map((block: any) => block.text)
                  .join('\n\n');
              }

              return {
                id: `${msg.timestamp || Date.now()}-${index}`,
                role: msg.role,
                content: textContent || '',
                timestamp: new Date(msg.timestamp || Date.now()),
                streaming: false,
              };
            }).filter((msg: any) =>
              msg.content.trim() &&
              // Additional filter: skip if content looks like system output
              !msg.content.includes('"status":') &&
              !msg.content.includes('"$schema":')
            ); // Filter out empty messages and system messages
            setMessages(formattedMessages);
            // Sync to localStorage
            localStorage.setItem('kaoochat-messages', JSON.stringify(formattedMessages));
          }
        } else {
          // Fallback to localStorage if OpenClaw fetch fails
          const savedMessages = localStorage.getItem('kaoochat-messages');
          if (savedMessages) {
            const parsed = JSON.parse(savedMessages);
            const messagesWithDates = parsed.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
              streaming: false,
            }));
            setMessages(messagesWithDates);
          }
        }
      } catch (error) {
        console.error('Error fetching chat history:', error);
        // Fallback to localStorage
        const savedMessages = localStorage.getItem('kaoochat-messages');
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          const messagesWithDates = parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
            streaming: false,
          }));
          setMessages(messagesWithDates);
        }
      }
    };

    fetchChatHistory();
  }, []);

  // Sync messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('kaoochat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    // WebSocket connection is managed per-request in sendMessage
    // No persistent connection needed
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Build the updated messages array with the new user message
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setIsConnected(true); // Set connected when starting request

    // Create placeholder for assistant response
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Call the API route for AI response
      // Only send the new user message - OpenClaw maintains session context
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: userMessage.role,
              content: userMessage.content,
            }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, streaming: false }
            : m
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: 'Sorry, I encountered an error. Please try again.',
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setIsConnected(false); // Disconnect after request completes
    }
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🦞</div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                KaooChat
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                OpenClaw Gateway Client
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 text-6xl">🦞</div>
              <h2 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Welcome to KaooChat
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Start a conversation with your AI assistant
              </p>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {message.role === 'assistant' && (
                      <div className="mt-1 text-xl">🦞</div>
                    )}
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                        {message.streaming && (
                          <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <form onSubmit={sendMessage} className="mx-auto max-w-3xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
