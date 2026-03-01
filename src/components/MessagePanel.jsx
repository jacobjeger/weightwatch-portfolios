import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { getMessages, sendMessage, fetchMessagesFromSupabase } from '../context/AuthContext';

export default function MessagePanel({ portfolioId, userId, userEmail, userRole, showApprovalActions = false, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const prevMsgCount = useRef(0);

  // Load messages whenever panel opens or portfolioId changes
  useEffect(() => {
    if (!open || !portfolioId) return;
    // Try Supabase first for cross-browser sync, fall back to localStorage
    fetchMessagesFromSupabase(portfolioId).then((msgs) => {
      setMessages(msgs ?? getMessages(portfolioId));
    });
  }, [open, portfolioId]);

  // Auto-scroll to bottom ONLY when new messages arrive (not on every re-render)
  useEffect(() => {
    if (!open || !messages.length) return;
    // Only scroll if message count increased (new message added)
    if (messages.length > prevMsgCount.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevMsgCount.current = messages.length;
  }, [messages, open]);

  // Poll for new messages every 5 seconds while panel is open (from Supabase when available)
  useEffect(() => {
    if (!open || !portfolioId) return;
    const interval = setInterval(async () => {
      const msgs = await fetchMessagesFromSupabase(portfolioId);
      setMessages(msgs ?? getMessages(portfolioId));
    }, 5000);
    return () => clearInterval(interval);
  }, [open, portfolioId]);

  function handleSend(type = 'comment') {
    if (!text.trim() && type === 'comment') return;
    const msg = sendMessage({
      portfolio_id: portfolioId,
      sender_id: userId,
      sender_email: userEmail,
      sender_role: userRole,
      type,
      text: text.trim() || (type === 'approval' ? 'Approved the portfolio' : 'Requested changes'),
    });
    setMessages((prev) => [...prev, msg]);
    setText('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const messageCount = messages.length;

  return (
    <div className="card p-5">
      {/* Header toggle */}
      <button
        type="button"
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-500" />
          <h2 className="section-title mb-0">Messages</h2>
          {messageCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {messageCount}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {/* Message thread */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No messages yet. Start the conversation.</p>
            )}

            {messages.map((msg) => {
              // Approval / change-request banners
              if (msg.type === 'approval') {
                return (
                  <div key={msg.id} className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 text-sm font-medium">
                        Portfolio approved
                      </span>
                    </div>
                    <span className="block text-xs text-green-500 mt-0.5">
                      {msg.sender_email} &middot; {(isNaN(new Date(msg.created_at).getTime()) ? '' : new Date(msg.created_at).toLocaleString())}
                    </span>
                    {msg.text && msg.text !== 'Approved the portfolio' && (
                      <p className="text-sm text-green-600 mt-1">{msg.text}</p>
                    )}
                  </div>
                );
              }

              if (msg.type === 'change_request') {
                return (
                  <div key={msg.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-amber-700 text-sm font-medium">
                        Changes requested
                      </span>
                    </div>
                    <span className="block text-xs text-amber-500 mt-0.5">
                      {msg.sender_email} &middot; {(isNaN(new Date(msg.created_at).getTime()) ? '' : new Date(msg.created_at).toLocaleString())}
                    </span>
                    {msg.text && msg.text !== 'Requested changes' && (
                      <p className="text-sm text-amber-600 mt-1">{msg.text}</p>
                    )}
                  </div>
                );
              }

              // Regular comment bubbles
              const isMe = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    isMe
                      ? 'bg-blue-50 text-blue-900 rounded-br-sm'
                      : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                  }`}>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold">
                        {isMe ? 'You' : msg.sender_email}
                      </span>
                      <span className={`text-[10px] ${
                        msg.sender_role === 'advisor' ? 'text-blue-400' : 'text-green-500'
                      }`}>
                        {msg.sender_role}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {(isNaN(new Date(msg.created_at).getTime()) ? '' : new Date(msg.created_at).toLocaleString())}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Approval actions (client only) */}
          {showApprovalActions && userRole === 'client' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                onClick={() => handleSend('approval')}
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
              <button
                type="button"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                onClick={() => {
                  if (!text.trim()) {
                    setText('');
                    // Focus the input to prompt user to describe changes
                    document.getElementById('msg-input')?.focus();
                    return;
                  }
                  handleSend('change_request');
                }}
              >
                <AlertTriangle className="w-4 h-4" /> Request Changes
              </button>
            </div>
          )}

          {/* Message input */}
          <div className="flex gap-2">
            <input
              id="msg-input"
              type="text"
              placeholder={showApprovalActions ? 'Comment or describe requested changes...' : 'Type a message...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!text.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
