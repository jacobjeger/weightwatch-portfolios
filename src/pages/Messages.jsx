import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { useAuth, getPortfolios, getMessages, sendMessage } from '../context/AuthContext';

export default function Messages() {
  const { user, role } = useAuth();
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  // Load portfolios
  useEffect(() => {
    if (user) {
      const all = getPortfolios(user.id);
      setPortfolios(all);
      if (all.length > 0 && !selectedPortfolioId) {
        setSelectedPortfolioId(all[0].id);
      }
    }
  }, [user]);

  // Load messages for selected portfolio
  useEffect(() => {
    if (selectedPortfolioId) {
      setMessages(getMessages(selectedPortfolioId));
    }
  }, [selectedPortfolioId]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!selectedPortfolioId) return;
    const interval = setInterval(() => {
      setMessages(getMessages(selectedPortfolioId));
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedPortfolioId]);

  function handleSend(type = 'comment') {
    if (!text.trim() && type === 'comment') return;
    if (!selectedPortfolioId) return;
    const msg = sendMessage({
      portfolio_id: selectedPortfolioId,
      sender_id: user.id,
      sender_email: user.email,
      sender_role: role,
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

  // Get unique conversation partners
  const conversationPartners = portfolios.map((p) => {
    const msgs = getMessages(p.id);
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const unread = msgs.filter((m) => m.sender_id !== user?.id).length;
    return { portfolio: p, lastMsg, messageCount: msgs.length, unread };
  });

  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId);

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">
        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 inline-block mr-2 text-blue-500" />
        Messages
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6" style={{ minHeight: '60vh' }}>
        {/* Conversation list */}
        <div className="card overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Conversations</h2>
            <p className="text-xs text-slate-400 mt-0.5">Messages per portfolio</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[30vh] lg:max-h-[60vh] overflow-y-auto">
            {conversationPartners.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">
                No conversations yet. Messages appear here when you or your {role === 'advisor' ? 'clients' : 'advisor'} communicate about portfolios.
              </div>
            )}
            {conversationPartners.map(({ portfolio: p, lastMsg, messageCount }) => (
              <button
                key={p.id}
                onClick={() => setSelectedPortfolioId(p.id)}
                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                  selectedPortfolioId === p.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-900 truncate">{p.name}</span>
                  {messageCount > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full ml-2">
                      {messageCount}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {lastMsg.sender_id === user?.id ? 'You: ' : ''}{lastMsg.text}
                  </p>
                )}
                {lastMsg && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(lastMsg.created_at).toLocaleDateString()}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Message thread */}
        <div className="lg:col-span-2 card flex flex-col">
          {!selectedPortfolioId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Select a conversation to start messaging
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{selectedPortfolio?.name}</h3>
                    <p className="text-xs text-slate-500">
                      {role === 'advisor' ? 'Conversation with client' : 'Conversation with advisor'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      role === 'advisor' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 max-h-[40vh] sm:max-h-[50vh]">
                {messages.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">No messages yet. Start the conversation.</p>
                )}

                {messages.map((msg) => {
                  if (msg.type === 'approval') {
                    return (
                      <div key={msg.id} className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-700 text-sm font-medium">Portfolio approved</span>
                        </div>
                        <span className="block text-xs text-green-500 mt-0.5">
                          {msg.sender_email} &middot; {new Date(msg.created_at).toLocaleString()}
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
                          <span className="text-amber-700 text-sm font-medium">Changes requested</span>
                        </div>
                        <span className="block text-xs text-amber-500 mt-0.5">
                          {msg.sender_email} &middot; {new Date(msg.created_at).toLocaleString()}
                        </span>
                        {msg.text && msg.text !== 'Requested changes' && (
                          <p className="text-sm text-amber-600 mt-1">{msg.text}</p>
                        )}
                      </div>
                    );
                  }

                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                      }`}>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className={`text-xs font-semibold ${isMe ? 'text-blue-100' : 'text-slate-600'}`}>
                            {isMe ? 'You' : msg.sender_email}
                          </span>
                          <span className={`text-[10px] ${isMe ? 'text-blue-200' : (msg.sender_role === 'advisor' ? 'text-blue-400' : 'text-green-500')}`}>
                            {msg.sender_role}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Approval actions for clients */}
              {role === 'client' && (
                <div className="px-4 py-2 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                    onClick={() => handleSend('approval')}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                    onClick={() => {
                      if (!text.trim()) {
                        document.getElementById('msg-main-input')?.focus();
                        return;
                      }
                      handleSend('change_request');
                    }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Request Changes
                  </button>
                </div>
              )}

              {/* Message input */}
              <div className="p-3 sm:p-4 border-t border-slate-100 flex gap-2">
                <input
                  id="msg-main-input"
                  type="text"
                  placeholder={`Message your ${role === 'advisor' ? 'client' : 'advisor'}...`}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
