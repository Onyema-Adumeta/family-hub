import { useState, useEffect, useRef } from 'react';
import { useMessages, useSendMessage } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { useMembers } from '../hooks/useApi';
import { uploadFile, api, mediaSrc } from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import { familySocket } from '../lib/socket';
import { useQueryClient } from '@tanstack/react-query';



const AI_PROMPTS = [
  { label: '🍽️ Meal idea',      prompt: 'Suggest a quick family dinner idea for tonight.' },
  { label: '🧹 Chore plan',     prompt: 'Create a fair chore plan for a family with kids.' },
  { label: '⭐ Motivate kids',  prompt: 'Give me 3 fun ways to motivate kids to do their chores.' },
  { label: '🛒 Grocery list',   prompt: 'Give me a simple weekly grocery list for a family of 4.' },
  { label: '🎮 Family activity',prompt: 'Suggest a fun family activity we can do this weekend.' },
];

type AIMessage = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const { member } = useAuthStore();
  const { data: messages = [], isLoading } = useMessages();
  const { data: members = [] } = useMembers();
  const sendMessage = useSendMessage();
  const queryClient = useQueryClient();

  const [text, setText]           = useState('');
  const [uploading, setUploading] = useState(false);
  const [showAI, setShowAI]       = useState(false);
  const [showExtras,setShowExtras] = useState(false);
  const [showHelp,setShowHelp] = useState(false);
  const [aiInput, setAiInput]     = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<AIMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; emoji: string; ts: number }>>({});
  const [pinnedMsg, setPinnedMsg] = useState<any | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [replyTo,setReplyTo] = useState<any|null>(null);
  const [sendError,setSendError] = useState('');
  const [pollOpen,setPollOpen]=useState(false),[pollQuestion,setPollQuestion]=useState(''),[pollOptions,setPollOptions]=useState('');
  const [actionBusy,setActionBusy]=useState<string|null>(null);
  const [hasNewMessages,setHasNewMessages] = useState(false);
  const nearBottom = useRef(true);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const aiInputRef  = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<any>(null);

  // Scroll to bottom on new messages
  useEffect(() => { if(nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); else setHasNewMessages(true); }, [messages.length, (messages as any[])[messages.length-1]?.id]);
  useEffect(() => { aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiHistory, aiLoading]);
  useEffect(() => { if (showAI) setTimeout(() => aiInputRef.current?.focus(), 100); }, [showAI]);

  // Find pinned message
  useEffect(() => {
    const pinned = (messages as any[]).filter(m => m.pinned);
    setPinnedMsg(pinned.length > 0 ? pinned[pinned.length - 1] : null);
  }, [messages]);

  // Real-time WebSocket
  useSocket((msg) => {
    if(msg.type==='message:updated')queryClient.invalidateQueries({queryKey:['messages']});
    if (msg.type === 'message:new') {
      queryClient.setQueryData(['messages'], (old: any[]) => {
        const existing = (old || []).find(m => m.id === msg.message.id);
        if (existing) return old;
        return [...(old || []), msg.message];
      });
      // Clear typing for sender
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[msg.message.memberId];
        return next;
      });
    }
    if (msg.type === 'chat:typing' && msg.memberId !== member?.id) {
      setTypingUsers(prev => ({
        ...prev,
        [msg.memberId]: { name: msg.memberName, emoji: msg.memberEmoji, ts: Date.now() }
      }));
      // Auto-clear after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => {
          const next = { ...prev };
          if (next[msg.memberId] && Date.now() - next[msg.memberId].ts >= 2900) {
            delete next[msg.memberId];
          }
          return next;
        });
      }, 3000);
    }
    if (msg.type === 'message:pinned') {
      queryClient.setQueryData(['messages'], (old: any[]) =>
        (old || []).map(m => m.id === msg.messageId ? { ...m, pinned: msg.pinned ?? true } : m)
      );
    }
    if (msg.type === 'message:deleted') {
      queryClient.setQueryData(['messages'], (old: any[]) =>
        (old || []).filter(m => m.id !== msg.messageId)
      );
    }
  });

  // Send typing indicator
  function handleTyping(val: string) {
    setText(val);
    clearTimeout(typingTimer.current);
    if (val.trim()) {
      familySocket.send({
        type: 'chat:typing',
        memberId: member?.id,
        memberName: member?.name,
        memberEmoji: member?.emoji,
      });
    }
  }

  function getMember(id: string) {
    return (members as any[]).find(m => m.id === id);
  }

  async function messageAction(id:string,action:'ack'|'vote',data:any){setActionBusy(id);try{await api.post(`/chat/${id}/${action}`,data);await queryClient.invalidateQueries({queryKey:['messages']});}catch{setSendError('Could not save that response. Please try again.');}finally{setActionBusy(null);}}
  async function createPoll(){if(sendMessage.isPending)return;try{await sendMessage.mutateAsync({pollQuestion,pollOptions:pollOptions.split('\n').map(s=>s.trim()).filter(Boolean)});setPollQuestion('');setPollOptions('');setPollOpen(false);}catch{setSendError('Could not create poll. Use a question and 2–6 different options.');}}
  async function handleSend() {
    if (!text.trim() || sendMessage.isPending) return;
    const draft=text; setSendError('');
    try {await sendMessage.mutateAsync({text:draft,...(replyTo?{replyToId:replyTo.id}:{})});setText(current=>current===draft?'':current);setReplyTo(null);nearBottom.current=true;}
    catch {setSendError('Message was not sent. Your draft is still here—tap Send to retry.');}
  }

  async function handlePin(msgId: string) {
    const {data}=await api.patch(`/chat/${msgId}/pin`);
    queryClient.setQueryData(['messages'], (old: any[]) =>
      (old || []).map(m => m.id === msgId ? { ...m, pinned: data.pinned } : m)
    );

  }

  function broadcast_pin(msgId: string) {
    familySocket.send({ type: 'message:pinned', messageId: msgId });
  }

  async function handleDelete(msgId: string) {
    if (!confirm('Delete this message?')) return;
    await api.delete(`/chat/${msgId}`);
    queryClient.setQueryData(['messages'], (old: any[]) =>
      (old || []).filter(m => m.id !== msgId)
    );

  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, type } = await uploadFile(file);
      await sendMessage.mutateAsync({mediaUrl:url,mediaType:type,...(replyTo?{replyToId:replyTo.id}:{})});setReplyTo(null);
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
      });
      setAiHistory(h => [...h, { role: 'assistant', content: data.text }]);
    } catch (err: any) {
      const msg = err?.response?.status === 403 ? (err.response.data?.error || 'AI features are off.') : '😕 Sorry, I had trouble responding. Please try again!';
      setAiHistory(h => [...h, { role: 'assistant', content: msg }]);
    } finally { setAiLoading(false); }
  }

  const typingList = Object.values(typingUsers);

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="clean-chat" style={{ display: 'flex', gap: 16, height: 'calc(100dvh - 120px)', minHeight: 340, maxWidth: 960, position:'relative' }}>
      <style>{`.clean-chat summary{cursor:pointer;list-style:none}.clean-chat summary::-webkit-details-marker{display:none}.clean-chat button,.clean-chat summary{touch-action:manipulation}.clean-chat .message-menu{position:absolute;z-index:5;right:0;min-width:150px;background:var(--bg-secondary);border:1px solid var(--border);padding:6px;border-radius:12px;box-shadow:0 6px 24px #0003}.clean-chat .message-menu button{display:block;width:100%;padding:10px;text-align:left;border:0;background:transparent;color:var(--text);cursor:pointer}.clean-chat summary:focus-visible{outline:2px solid var(--primary)}.clean-chat .assistant-overlay{position:absolute;inset:0;z-index:10;background:var(--bg-secondary);border:1px solid var(--border);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}.clean-chat .chat-bubble{max-width:82%}@media(min-width:700px){.clean-chat .chat-bubble{max-width:70%}}`}</style>

      {/* ── Family Chat ── */}
      <div hidden={showAI} style={{ flex: 1, display: showAI?'none':'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Family Chat</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {pinnedMsg && (
              <button onClick={() => setShowPinned(v => !v)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                background: showPinned ? 'rgba(251,191,36,0.2)' : 'var(--bg-secondary)',
                border: `1.5px solid ${showPinned ? 'rgba(251,191,36,0.5)' : 'var(--border)'}`,
                color: showPinned ? '#FBBF24' : 'var(--text)'
              }}>📌 Pinned</button>
            )}
            <button aria-label="Chat help" onClick={()=>setShowHelp(v=>!v)} style={{background:'none',border:'1px solid var(--border)',borderRadius:10,padding:'7px 12px',color:'var(--text)'}}>?</button>
          </div>
        </div>

        {/* Pinned message banner */}
        {pinnedMsg && showPinned && (
          <div style={{
            padding: '10px 14px', borderRadius: 12, marginBottom: 10, flexShrink: 0,
            background: 'rgba(251,191,36,0.08)', border: '1.5px solid rgba(251,191,36,0.3)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ fontSize: 16 }}>📌</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#FBBF24', marginBottom: 2 }}>PINNED MESSAGE</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pinnedMsg.text || '📎 Media'}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div onScroll={e=>{const el=e.currentTarget;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;if(nearBottom.current)setHasNewMessages(false);}} style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
          {(messages as any[]).map((msg: any) => {
            const sender = getMember(msg.memberId) || msg.member;
            const original=(messages as any[]).find(m=>m.id===msg.replyToId);
            const previous=(messages as any[])[(messages as any[]).indexOf(msg)-1];
            const showDate=!previous||new Date(previous.createdAt).toDateString()!==new Date(msg.createdAt).toDateString();
            const isMe = msg.memberId === member?.id;
            const isParent = member?.role === 'parent';
            return (
              <div key={msg.id}>{showDate&&<div style={{textAlign:'center',fontSize:11,color:'var(--text-muted)',margin:'12px 0'}}>{new Date(msg.createdAt).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</div>}<div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 10, alignItems: 'flex-end', gap: 6 }}
>
                {!isMe && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: sender?.color || '#6366F1', border: `2px solid ${sender?.color || '#6366F1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, overflow: 'hidden' }}>
                    {sender?.avatarUrl ? <img src={mediaSrc(sender.avatarUrl)} alt={sender.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : sender?.emoji}
                  </div>
                )}
                <div className="chat-bubble" style={{minWidth:0}}>
                  {!isMe && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 3, paddingLeft: 4 }}>{sender?.name}</div>}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMe ? 'var(--primary)' : 'var(--bg-tertiary)',
                      color: isMe ? '#fff' : 'var(--text)', fontSize: 13, fontWeight: 600,
                      border: msg.pinned ? '1.5px solid rgba(251,191,36,0.4)' : 'none',
                    }}>
                      {msg.pinned && <span style={{ fontSize: 10, marginRight: 6 }}>📌</span>}
                      {msg.replyToId&&<div style={{borderLeft:'3px solid var(--primary)',paddingLeft:8,marginBottom:8,fontSize:11,opacity:0.85}}><strong>Reply to {original?(getMember(original.memberId)?.name || original.member?.name || 'family member'):'earlier message'}</strong><div>{original?(original.text || original.pollQuestion || '📎 Attachment').slice(0,120):'Original message is no longer in this view.'}</div></div>}
                      {!msg.text&&!msg.mediaUrl&&!msg.pollQuestion&&<span style={{opacity:0.7}}>Earlier message has no text or attachment.</span>}
                      {msg.pollQuestion&&<div><strong>📊 {msg.pollQuestion}</strong>{(msg.pollOptions||[]).map((option:string,index:number)=>{const count=(msg.votes||[]).filter((v:any)=>v.optionIndex===index).length;const selected=(msg.votes||[]).some((v:any)=>v.memberId===member?.id&&v.optionIndex===index);return <button key={index} disabled={actionBusy===msg.id} onClick={()=>messageAction(msg.id,'vote',{optionIndex:index})} style={{display:'block',width:'100%',textAlign:'left',marginTop:6,padding:8,borderRadius:8,border:'1px solid var(--border)',background:selected?'var(--primary)':'var(--bg-secondary)',color:'var(--text-primary)'}}>{selected?'✓ ':''}{option} · {count} votes</button>})}<p style={{fontSize:11}}>One vote per person; tap another option to change your vote.</p></div>}
                      {msg.text && <span style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{msg.text}</span>}
                      {msg.mediaUrl && msg.mediaType === 'image' && (
                        <a href={mediaSrc(msg.mediaUrl)} target="_blank" rel="noreferrer">
                          <img src={mediaSrc(msg.mediaUrl)} alt="shared" style={{ maxWidth: '100%', borderRadius: 8, marginTop: msg.text ? 6 : 0, display: 'block' }} />
                        </a>
                      )}
                      {msg.mediaUrl && msg.mediaType === 'video' && (
                        <video src={mediaSrc(msg.mediaUrl)} controls style={{ maxWidth: '100%', borderRadius: 8, marginTop: msg.text ? 6 : 0 }} />
                      )}
                    </div>
                    <details style={{position:'relative',marginTop:3,textAlign:'right'}}>
                      <summary aria-label={`Actions for message from ${sender?.name || 'family member'}`} style={{display:'inline-block',padding:'2px 10px',fontSize:20,color:'var(--text-muted)',borderRadius:8}}>⋯</summary>
                      <div className="message-menu" onClick={e=>{if((e.target as HTMLElement).closest('button'))e.currentTarget.closest('details')?.removeAttribute('open');}}>
                        <button onClick={()=>setReplyTo(msg)}>Reply</button>
                        {!isMe&&<><button disabled={actionBusy===msg.id} onClick={()=>messageAction(msg.id,'ack',{kind:'seen'})}>Mark Seen</button><button disabled={actionBusy===msg.id} onClick={()=>messageAction(msg.id,'ack',{kind:'done'})}>Mark Done</button></>}
                        {isParent&&<button onClick={()=>handlePin(msg.id).catch(()=>setSendError('Could not update the pin. Please try again.'))}>{msg.pinned?'Unpin':'Pin message'}</button>}
                        {(isMe||isParent)&&<button onClick={()=>handleDelete(msg.id).catch(()=>setSendError('Could not delete the message. Please try again.'))}>Delete message</button>}
                      </div>
                    </details>
                  </div>
                  {!!msg.acknowledgements?.length&&<details style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}><summary>{['seen','done'].map(kind=>{const n=msg.acknowledgements.filter((a:any)=>a.kind===kind).length;return n?`${kind==='done'?'Done':'Seen'} by ${n}`:null;}).filter(Boolean).join(' · ')}</summary><div style={{padding:'6px 0'}}>{msg.acknowledgements.map((a:any)=>`${a.member?.name || 'Family member'}: ${a.kind==='done'?'Done':'Seen'}`).join(' · ')}</div></details>}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, textAlign: isMe ? 'right' : 'left', paddingLeft: isMe ? 0 : 4 }}>
                    {new Date(msg.createdAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div></div>
            );
          })}

          {/* Typing indicator */}
          {typingList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
                    animation: `bounce 1s ease infinite ${i * 0.15}s`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                {typingList.map(t => `${t.emoji} ${t.name}`).join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing...
              </span>
              <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }`}</style>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {hasNewMessages&&<button onClick={()=>{nearBottom.current=true;bottomRef.current?.scrollIntoView({behavior:'smooth'});setHasNewMessages(false);}} className="btn">Jump to latest messages ↓</button>}
        {showHelp&&<div style={{fontSize:12,lineHeight:1.6,padding:12,background:'var(--bg-secondary)',borderRadius:10,marginBottom:8}}>Use ⋯ on a message to reply or acknowledge it. Seen/Done is an acknowledgement, not a chore completion. Enter sends; Shift + Enter adds a line. Enable Family chat notifications in Settings on each device. <button onClick={()=>setShowHelp(false)}>Close help</button></div>}
        {showExtras&&<div style={{display:'flex',gap:8,flexWrap:'wrap',padding:'8px 0'}}><button className="btn" disabled={uploading} onClick={()=>{fileRef.current?.click();setShowExtras(false);}}>Photo / video</button><button className="btn" onClick={()=>{setPollOpen(true);setShowExtras(false);}}>Create poll</button><button className="btn" onClick={()=>{setShowAI(true);setShowExtras(false);}}>Family assistant</button></div>}
        {pollOpen&&<div className="card" style={{padding:12,marginBottom:12}}><label>Question<input className="input" value={pollQuestion} maxLength={200} onChange={e=>setPollQuestion(e.target.value)}/></label><label>Options (one per line)<textarea className="input" rows={3} value={pollOptions} onChange={e=>setPollOptions(e.target.value)} placeholder="Pasta\nRice\nTacos"/></label><button disabled={sendMessage.isPending||!pollQuestion.trim()} onClick={createPoll}>Post poll</button> <button onClick={()=>setPollOpen(false)}>Cancel</button></div>}
        {replyTo&&<div style={{padding:10,borderLeft:'3px solid var(--primary)',background:'var(--bg-secondary)'}}>Replying to {getMember(replyTo.memberId)?.name || replyTo.member?.name || 'family member'}: {(replyTo.text || replyTo.pollQuestion || '📎 Attachment').slice(0,100)} <button onClick={()=>setReplyTo(null)} aria-label="Cancel reply">×</button></div>}
        {sendError&&<p role="alert">{sendError}</p>}
        {/* Input */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 0', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <button aria-label="Add attachment, poll or open assistant" aria-expanded={showExtras} onClick={()=>setShowExtras(v=>!v)} disabled={uploading} style={{width:44,height:44,borderRadius:12,background:'var(--bg-secondary)',border:'1px solid var(--border)',color:'var(--text)',fontSize:24,flexShrink:0}}>{uploading?'…':showExtras?'×':'+'}</button>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          <textarea aria-label="Family message" rows={1} maxLength={4000} className="input" style={{ flex: 1,minWidth:0,resize:'vertical',minHeight:44,maxHeight:130 }} placeholder="Write to your family…"
            value={text} onChange={e => handleTyping(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          <button onClick={handleSend} disabled={!text.trim() || sendMessage.isPending} className="btn btn-primary" style={{ padding: '10px 16px', flexShrink: 0 }}>
            Send
          </button>
        </div>

      </div>

      {/* ── AI Assistant Panel ── */}
      {showAI && (
        <div className="assistant-overlay" role="region" aria-label="Family assistant" onKeyDown={e=>{if(e.key==='Escape')setShowAI(false);}}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(167,139,250,0.08))' }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>Family Assistant</strong><button autoFocus className="btn" onClick={()=>{setShowAI(false);setShowExtras(true);}}>Back to chat</button></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>Ask anything — meals, chores, activities</div>
          </div>
          {aiHistory.length === 0 && (
            <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8 }}>QUICK QUESTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AI_PROMPTS.map(p => (
                  <button key={p.label} onClick={() => handleAiSend(p.prompt)} style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border)', color: 'var(--text)' }}>{p.label}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {aiHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-tertiary)', color: msg.role === 'user' ? '#fff' : 'var(--text)', fontSize: 12, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '8px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>🤖 thinking...</div>
              </div>
            )}
            {aiHistory.length > 0 && !aiLoading && (
              <button onClick={() => setAiHistory([])} style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>🔄 Clear conversation</button>
            )}
            <div ref={aiBottomRef} />
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input ref={aiInputRef} className="input" style={{ flex: 1, fontSize: 12 }} placeholder="Ask the assistant..."
              value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSend(); } }}
              disabled={aiLoading} />
            <button onClick={() => handleAiSend()} disabled={!aiInput.trim() || aiLoading} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12, flexShrink: 0 }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}