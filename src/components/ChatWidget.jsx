import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import {
  sendChatMessage, extractLeadData, extractAuditData, extractProposalData,
  cleanResponseText, saveLead, saveConversation, submitAudit, getAuditStatus, submitProposal,
  lookupReturningVisitor,
} from '../api/chat.js';

const GREETING = "Hey there — I'm Alex from ThermaShift. Fun fact: most data centers we talk to are losing $200K–$500K a year in cooling inefficiency without even realizing it. Whether you're dealing with rising cooling costs, planning a liquid cooling transition, or tackling ESG compliance, I can point you in the right direction.\n\nBetter yet — we offer a **free cooling efficiency review**. I just need a few details about your facility and I'll generate a personalized report with savings estimates, PUE improvement targets, and waste heat revenue potential. Takes about 5 minutes.\n\nWhat brings you here today?";

function makeSessionId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const sessionIdRef = useRef(makeSessionId());
  const leadCapturedRef = useRef(false);
  const leadDataRef = useRef(null);
  const auditSubmittedRef = useRef(false);
  const auditIdRef = useRef(null);
  const returningCheckedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  // Check for returning visitor via localStorage email
  useEffect(() => {
    if (!isOpen || returningCheckedRef.current) return;
    returningCheckedRef.current = true;
    const savedEmail = localStorage.getItem('thermashift_email');
    if (!savedEmail) return;

    lookupReturningVisitor(savedEmail).then(data => {
      if (data?.found && data.name) {
        leadCapturedRef.current = true;
        leadDataRef.current = { email: savedEmail, name: data.name, company: data.company };
        const welcomeBack = data.last_audit?.estimated_annual_savings
          ? `Welcome back, ${data.name}! Last time we identified **$${data.last_audit.estimated_annual_savings.toLocaleString()}/year in potential savings** for ${data.company || 'your facility'}. Want to pick up where we left off, or is there something new I can help with?`
          : `Welcome back, ${data.name}! Good to see you again. What can I help you with today?`;
        setMessages([{ role: 'assistant', content: welcomeBack }]);
      }
    }).catch(() => {});
  }, [isOpen]);

  // Save conversation after each assistant response
  const persistConversation = useCallback((msgs, lead) => {
    const cleanMessages = msgs.map(m => ({
      role: m.role,
      content: cleanResponseText(m.content),
    }));
    saveConversation({
      session_id: sessionIdRef.current,
      lead_id: lead?.id || null,
      lead_email: lead?.email || leadDataRef.current?.email || null,
      messages: cleanMessages,
    }).catch(() => {});
  }, []);

  // Poll for audit completion and inject results into conversation
  const pollAuditResults = useCallback(async (auditId) => {
    const maxAttempts = 30; // 30 seconds
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const result = await getAuditStatus(auditId);
        if (result?.status === 'completed' && result.review_summary) {
          // Inject the review results as a system context message and trigger Alex to discuss them
          const reviewContext = `[SYSTEM: The cooling efficiency review has been generated and emailed to the prospect. Here are the results for you to discuss with them:\n\n` +
            `Estimated Annual Savings: $${(result.estimated_annual_savings || 0).toLocaleString()}\n` +
            `Current PUE: ${result.current_pue || 'Unknown'} → Target PUE: ${result.target_pue || 'N/A'}\n` +
            `Waste Heat Revenue Potential: $${(result.waste_heat_revenue_potential || 0).toLocaleString()}/year\n` +
            `Recommended Services: ${(result.recommended_services || []).join(', ')}\n\n` +
            `Review Summary:\n${result.review_summary}\n\n` +
            `Walk the prospect through these findings. Lead with the headline savings number. Create urgency. Then recommend specific services and offer to generate a formal proposal.]`;

          // Send a follow-up message from Alex discussing the results
          const currentMessages = [
            ...messages.map(m => ({ role: m.role, content: cleanResponseText(m.content) })),
            { role: 'user', content: reviewContext },
          ];

          setIsTyping(true);
          let streamedText = '';
          try {
            await sendChatMessage(currentMessages, (chunk) => {
              streamedText += chunk;
              const displayText = cleanResponseText(streamedText);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last._streaming) {
                  return [...prev.slice(0, -1), { role: 'assistant', content: displayText, _streaming: true }];
                }
                return [...prev, { role: 'assistant', content: displayText, _streaming: true }];
              });
            });

            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?._streaming) {
                const clean = cleanResponseText(last.content);
                return [...prev.slice(0, -1), { role: 'assistant', content: clean }];
              }
              return prev;
            });
          } catch {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: "Great news — your cooling efficiency review is ready! I just sent it to your email. Would you like me to walk you through the highlights?",
            }]);
          } finally {
            setIsTyping(false);
          }
          return;
        }
        if (result?.status === 'failed') {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: "I ran into a hiccup generating your review — but no worries, I've flagged it for our team. They'll have it in your inbox within the hour. In the meantime, based on what you've told me, I can already share some initial observations. Want me to?",
          }]);
          return;
        }
      } catch { /* keep polling */ }
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    const apiMessages = updatedMessages.map(m => ({
      role: m.role,
      content: cleanResponseText(m.content),
    }));

    try {
      abortRef.current = new AbortController();
      let streamedText = '';

      await sendChatMessage(apiMessages, (chunk) => {
        streamedText += chunk;
        const displayText = cleanResponseText(streamedText);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last._streaming) {
            return [...prev.slice(0, -1), { role: 'assistant', content: displayText, _streaming: true, _raw: streamedText }];
          }
          return [...prev, { role: 'assistant', content: displayText, _streaming: true, _raw: streamedText }];
        });
      }, abortRef.current.signal);

      // Finalize message
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?._streaming) {
          const rawText = last._raw || last.content;
          const cleanContent = cleanResponseText(rawText);
          const finalMsgs = [...prev.slice(0, -1), { role: 'assistant', content: cleanContent }];

          // Extract lead data
          if (!leadCapturedRef.current) {
            const lead = extractLeadData(rawText);
            if (lead?.email) {
              leadCapturedRef.current = true;
              leadDataRef.current = lead;
              try { localStorage.setItem('thermashift_email', lead.email); } catch {}
              saveLead({ ...lead, source: 'chat_widget' }).then(result => {
                if (result?.lead_id) leadDataRef.current = { ...lead, id: result.lead_id };
                persistConversation(finalMsgs, leadDataRef.current);
              }).catch(() => {});
            }
          }

          // Extract audit data — trigger review generation
          if (!auditSubmittedRef.current) {
            const audit = extractAuditData(rawText);
            if (audit) {
              auditSubmittedRef.current = true;
              submitAudit({
                ...audit,
                lead_email: audit.email || leadDataRef.current?.email,
              }).then(result => {
                if (result?.audit_id) {
                  auditIdRef.current = result.audit_id;
                  // Start polling for results
                  pollAuditResults(result.audit_id);
                }
              }).catch(err => console.error('Audit submit error:', err));
            }
          }

          // Extract proposal data
          const proposal = extractProposalData(rawText);
          if (proposal) {
            submitProposal({
              ...proposal,
              lead_email: leadDataRef.current?.email,
              lead_id: leadDataRef.current?.id,
              audit_id: auditIdRef.current,
            }).catch(err => console.error('Proposal submit error:', err));
          }

          persistConversation(finalMsgs, leadDataRef.current);
          return finalMsgs;
        }
        return prev;
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or reach out to us directly at our [contact page](/contact).",
        }]);
      }
    } finally {
      setIsTyping(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const toggleOpen = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) setHasUnread(false);
  };

  const renderContent = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\n)/g);
    return parts.map((part, i) => {
      if (part === '\n') return <br key={i} />;
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) return <a key={i} href={linkMatch[2]} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{linkMatch[1]}</a>;
      return part;
    });
  };

  return (
    <>
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(0,163,224,0.4); }
          70% { box-shadow: 0 0 0 12px rgba(0,163,224,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,163,224,0); }
        }
        .chat-widget-window { animation: chatSlideUp 0.25s ease-out forwards; }
        .chat-widget-btn:hover { transform: scale(1.08) !important; }
        .chat-send-btn:hover:not(:disabled) { background: var(--accent) !important; color: #fff !important; }
        .chat-input-field:focus { outline: none; border-color: var(--accent) !important; }
        .chat-message-user { background: var(--accent) !important; color: #fff !important; }
        .chat-message-assistant { background: var(--bg-card) !important; color: var(--text) !important; }
        @media (max-width: 640px) {
          .chat-widget-window {
            width: 100vw !important; height: 100dvh !important;
            bottom: 0 !important; right: 0 !important;
            border-radius: 0 !important; max-height: 100dvh !important;
          }
        }
      `}</style>

      {isOpen && (
        <div className="chat-widget-window" style={{
          position: 'fixed', bottom: '90px', right: '24px', width: '400px',
          maxHeight: '520px', height: '520px', background: 'var(--bg-dark)',
          border: '1px solid var(--border)', borderRadius: '16px',
          display: 'flex', flexDirection: 'column', zIndex: 10001,
          overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), #0077b6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Alex</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Online</div>
              </div>
            </div>
            <button onClick={toggleOpen} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px', borderRadius: '6px', display: 'flex',
            }} aria-label="Close chat"><X size={20} /></button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className={msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'} style={{
                  maxWidth: '85%', padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  fontSize: '0.9rem', lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}

            {isTyping && !messages[messages.length - 1]?._streaming && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  background: 'var(--bg-card)', padding: '12px 18px',
                  borderRadius: '14px 14px 14px 4px', display: 'flex', gap: '5px', alignItems: 'center',
                }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--text-muted)',
                      animation: `dotPulse 1.4s ease-in-out ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            background: 'var(--bg-card)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="chat-input-field" rows={1}
                style={{
                  flex: 1, resize: 'none', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '10px 14px',
                  background: 'var(--bg-dark)', color: 'var(--text)',
                  fontSize: '0.9rem', fontFamily: 'inherit', maxHeight: '80px', lineHeight: 1.4,
                }}
              />
              <button
                onClick={handleSend} disabled={!input.trim() || isTyping}
                className="chat-send-btn"
                style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  border: 'none', cursor: input.trim() && !isTyping ? 'pointer' : 'default',
                  background: input.trim() && !isTyping ? 'var(--accent)' : 'var(--border)',
                  color: input.trim() && !isTyping ? '#fff' : 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s',
                }}
                aria-label="Send message"
              ><Send size={18} /></button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              Powered by ThermaShift AI
            </div>
          </div>
        </div>
      )}

      <button onClick={toggleOpen} className="chat-widget-btn" style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '60px', height: '60px', borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent), #0077b6)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,163,224,0.35)', zIndex: 10000,
        transition: 'transform 0.2s',
        animation: !isOpen && !hasUnread ? 'pulseRing 2s ease-out 3' : 'none',
      }} aria-label={isOpen ? 'Close chat' : 'Open chat'}>
        {isOpen ? <X size={26} color="#fff" /> : <MessageCircle size={26} color="#fff" />}
      </button>
    </>
  );
}
