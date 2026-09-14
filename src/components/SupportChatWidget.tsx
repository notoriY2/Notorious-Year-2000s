// src/components/SupportChatWidget.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ACCENT = '#C44D2B';
const FONT = "'Helvetica Neue', Arial, sans-serif";

const SupportChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm the Notorious.Y2 support assistant. Ask me about orders, shipping, returns, or sizing.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lets other parts of the app (e.g. Checkout's "Help Center" link)
  // open this widget without prop-drilling — see lib/supportChatBus.ts.
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-support-chat', handler);
    return () => window.removeEventListener('open-support-chat', handler);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('support-chat', {
  body: { message: trimmed, history: messages },
});

if (error) {
  const detail = await (error as any).context?.json?.().catch(() => null);
  const errorMessage = detail?.error ?? error.message;
  console.error('Support chat error:', errorMessage);
  throw new Error(errorMessage);
}

setMessages(prev => [
  ...prev,
  { role: 'assistant', content: data?.reply ?? "Sorry, I couldn't process that." },
]);
    } catch (err) {
      console.error('Support chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, something went wrong. You can also reach us at support@notorious.y2.com.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {/* LAUNCHER */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
        className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[105] w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shadow-lg hover:bg-gray-800 transition-colors"
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {/* PANEL */}
      {isOpen && (
        <div
          className="fixed bottom-[144px] lg:bottom-24 right-4 lg:right-6 z-[105] w-[92vw] max-w-sm h-[70vh] max-h-[520px] bg-white border border-gray-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden"
          style={{ fontFamily: FONT }}
        >
          {/* HEADER */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-black text-white">
            <div>
              <p className="text-sm font-medium tracking-wide">Notorious.Y2 Support</p>
              <p className="text-[10px] text-gray-300">We usually reply in a few minutes</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* MESSAGES */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-black text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-2xl rounded-bl-sm text-sm flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" />
                  Typing...
                </div>
              </div>
            )}
          </div>

          {/* INPUT */}
          <div className="border-t border-gray-100 p-3 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={isSending}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;