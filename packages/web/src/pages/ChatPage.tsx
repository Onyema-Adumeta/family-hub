import { useState, useEffect, useRef } from 'react';
import { useMessages, useSendMessage } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { useMembers } from '../hooks/useApi';
import { uploadFile, api } from '../lib/api';

const QUICK_MSGS = ['🍕 Pizza tonight?', '⭐ Great job!', '🏠 Heading home', '❓ Anyone home?', '🛒 Need anything?'];

const AI_PROMPTS = [
  { label: '🍽️ Meal idea', prompt: 'Suggest a quick family dinner idea for tonight.' },
  { label: '🧹 Chore plan', prompt: 'Create a fair chore plan for a family with kids.' },
  { label: '⭐ Motivate kids', prompt: 'Give me 3 fun ways to motivate kids to do their chores.' },
  { label: '🛒 Grocery list', prompt: 'Give me a simple weekly grocery list for a family of 4.' },
  { label: '🎮 Family activity', prompt: 'Suggest a fun family activity we can do this weekend.' },
];

type AIMessage = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const { member } = useAuthStore();
  const { data: messages = [], isLoading } = useMessages();
  const { data: members = [] } = useMembers();
  const sendMessage = useSendMessage();

  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<AIMessage[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiHistory, aiLoading]);

  useEffect(() => {
    if (showAI) setTimeout(() => aiInputRef.current?.focus(), 100);
  }, [showAI]);

  function getMember(id: string) {
    return (members as any[]).find(m => m.id === id);
  }

  async function handleSend() {
    if (!text.trim()) return;
    sendMessage.mutate({ text });
    setText('');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, type } = await uploadFile(file);
      sendMessage.mutate({ mediaUrl: url, mediaType: type });
    } catch { alert('Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleAiSend(overridePrompt?: string) {
    const userText = overridePrompt || aiInput.trim();
    if (!userText || aiLoading) return;
    setAiInput('');

    const newHistory: AIMessage[] = [...aiHistory, { role: 'user', content: userText }];
    setAiHistory(newHistory);
    setAiLoading(true);

    try {
      const { data } = await api.post('/ai/chat', {
        messages: newHistory.map(m => ({ role: m.role, content: m.content })),
        system: `You are a helpful, friendly family assistant for the ${member?.name || 'family'}'s household. Keep responses concise, warm, and practical. Use emojis occasionally. Never suggest anything inappropriate for children.`
      });
      setAiHistory(h => [...h, { role: 'assistant', content: data.text }]);
    } catch {
      setAiHistory(h => [...h, { role: 'assistant', content: '😕 Sorry, I had trouble responding. Please try again!' }]);
    } finally {
      setAiLoading(false);
    }
  }

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 48px)', maxWidth: 960 }}>

      {/* Family Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>💬 Family Chat</h1>
          <button
            onClick={() => setShowAI(v => !v)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
              background: showAI ? 'var(--primary)' : 'var(--bg-secondary)',
              border: `1.5px solid ${showAI ? 'var(--primary)' : 'var(--border)'}`,
              color: showAI ? '#fff' : 'var(--text)'
            }}
          >
            🤖 AI Assistant {showAI ? '✕' : ''}
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
          {(messages as any[]).map((msg: any) => {
            const sender = getMember(msg.memberId);
            const isMe = msg.memberId === member?.id;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 10, alignItems: 'flex-end', gap: 6 }}>
                {!isMe && (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: sender?.color || '#6366F1',
                    border: `2px solid ${sender?.color || '#6366F1'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0, overflow: 'hidden'
                  }}>
                    {sender?.avatarUrl
                      ? <img src={sender.avatarUrl} alt={sender.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : sender?.emoji
                    }
                  </div>
                )}
                <div style={{ maxWidth: '70%' }}>
                  {!isMe && (
                    <div style={{ fontSize: 10, fontWeight: 800, color: sender?.color || 'var(--text-muted)', marginBottom: 3, paddingLeft: 4 }}>
                      {sender?.name}
                    </div>
                  )}
                  <div style={{
                    padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? 'var(--primary)' : 'var(--bg-tertiary)',
                    color: isMe ? '#fff' : 'var(--text)', fontSize: 13, fontWeight: 600
                  }}>
                    {msg.text && <div>{msg.text}</div>}
                    {msg.mediaUrl && msg.mediaType === 'image' && (
                      <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
                        <img src={msg.mediaUrl} alt="shared" style={{ maxWidth: '100%', borderRadius: 8, marginTop: msg.text ? 6 : 0 }} />
                      </a>
                    )}
                    {msg.mediaUrl && msg.mediaType === 'video' && (
                      <video src={msg.mediaUrl} controls style={{ maxWidth: '100%', borderRadius: 8, marginTop: msg.text ? 6 : 0 }} />
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, textAlign: isMe ? 'right' : 'left', paddingLeft: isMe ? 0 : 4 }}>
                    {new Date(msg.createdAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, flexShrink: 0 }}>
          {QUICK_MSGS.map(q => (
            <button key={q} onClick={() => sendMessage.mutate({ text: q })} style={{
              padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700,
              whiteSpace: 'nowrap', cursor: 'pointer',
              background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', color: 'var(--text)'
            }}>{q}</button>
          ))}
        </div>

        {/* Input area */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 0', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
            width: 40, height: 40, borderRadius: 10, background: 'var(--bg-secondary)',
            border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: 18, flexShrink: 0
          }}>
            {uploading ? '⏳' : '📎'}
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          <input
            className="input" style={{ flex: 1 }}
            placeholder="Say something..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button onClick={handleSend} disabled={!text.trim() || sendMessage.isPending} className="btn btn-primary" style={{ padding: '10px 16px', flexShrink: 0 }}>
            Send →
          </button>
        </div>
      </div>

      {/* AI Assistant Panel */}
      {showAI && (
        <div style={{
          width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--bg-secondary)', borderRadius: 16,
          border: '1.5px solid var(--border)', overflow: 'hidden'
        }}>
          {/* AI Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(167,139,250,0.08))'
          }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>🤖 Family Assistant</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
              Ask anything — meals, chores, activities
            </div>
          </div>

          {/* Quick AI prompts */}
          {aiHistory.length === 0 && (
            <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8 }}>QUICK QUESTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AI_PROMPTS.map(p => (
                  <button key={p.label} onClick={() => handleAiSend(p.prompt)} style={{
                    padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    textAlign: 'left', cursor: 'pointer',
                    background: 'var(--bg-tertiary)', border: '1.5px solid var(--border)',
                    color: 'var(--text)'
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* AI conversation */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {aiHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-tertiary)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 12, fontWeight: 600, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '8px 14px', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700
                }}>
                  🤖 thinking...
                </div>
              </div>
            )}
            {aiHistory.length > 0 && !aiLoading && (
              <button
                onClick={() => setAiHistory([])}
                style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
              >
                🔄 Clear conversation
              </button>
            )}
            <div ref={aiBottomRef} />
          </div>

          {/* AI input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              ref={aiInputRef}
              className="input" style={{ flex: 1, fontSize: 12 }}
              placeholder="Ask the assistant..."
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSend(); } }}
              disabled={aiLoading}
            />
            <button
              onClick={() => handleAiSend()}
              disabled={!aiInput.trim() || aiLoading}
              className="btn btn-primary"
              style={{ padding: '8px 12px', fontSize: 12, flexShrink: 0 }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}