'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, Copy, Check, ThumbsUp, ExternalLink, Plus, Moon, Sun } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: { url: string; title: string }[];
}

/* ── Flower / Daisy SVG icon (like Kulikéun) ── */
function FlowerIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <ellipse key={i} cx="16" cy="8" rx="3.5" ry="7"
                    fill={`rgba(167, 139, 250, ${0.6 + i * 0.05})`}
                    transform={`rotate(${angle} 16 16)`} />
            ))}
            <circle cx="16" cy="16" r="4" fill="#c4b5fd" />
            <circle cx="16" cy="16" r="2" fill="#e9e5ff" />
        </svg>
    );
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDark, setIsDark] = useState(true);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const suggestions = [
        { icon: '🏛️', text: 'What is BIS and its core functions?' },
        { icon: '📋', text: 'How to apply for BIS certification?' },
        { icon: '🏷️', text: 'Tell me about BIS hallmarking' },
        { icon: '⚖️', text: 'What schemes does BIS offer?' },
    ];

    async function handleSend(text?: string) {
        const msg = text || input;
        if (!msg.trim() || isLoading) return;
        const userMsg: ChatMessage = { role: 'user', content: msg };
        const all = [...messages, userMsg];
        setMessages(all);
        setInput('');
        setIsLoading(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: all.map(m => ({ role: m.role, content: m.content })) }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.error ? `⚠️ ${data.error}` : data.text,
                sources: data.sources
            }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error.' }]);
        } finally {
            setIsLoading(false);
        }
    }

    const handleCopy = useCallback((text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    }, []);

    const handleRegenerate = useCallback(async (idx: number) => {
        if (idx < 1 || messages[idx - 1]?.role !== 'user') return;
        const trimmed = messages.slice(0, idx);
        setMessages(trimmed);
        setIsLoading(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: trimmed.map(m => ({ role: m.role, content: m.content })) }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.error ? `⚠️ ${data.error}` : data.text,
                sources: data.sources
            }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error.' }]);
        } finally {
            setIsLoading(false);
        }
    }, [messages]);

    // Strip trailing "Sources:" block from bot text (frontend Reference pills handle it)
    const stripSources = (text: string) =>
        text.replace(/\n*📋\s*\*{0,2}Sources:?\*{0,2}[\s\S]*$/i, '').trim();

    // glass classes — pure black/grey for dark mode
    const glass = isDark
        ? 'bg-[#ffffff06] border border-[#ffffff10] backdrop-blur-xl'
        : 'bg-white/40 border border-white/50 backdrop-blur-xl';
    const glassStrong = isDark
        ? 'bg-[#ffffff0a] border border-[#ffffff14] backdrop-blur-2xl'
        : 'bg-white/60 border border-white/60 backdrop-blur-2xl';
    const textPrimary = isDark ? 'text-[#e5e5e5]' : 'text-[#1a1a2e]';
    const textSoft = isDark ? 'text-[#a0a0a0]' : 'text-[#6b6b88]';
    const textMuted = isDark ? 'text-[#666666]' : 'text-[#9b9bb0]';

    return (
        <div className={`relative flex h-screen w-full overflow-hidden ${textPrimary} transition-colors duration-500`}
            style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

            {/* ── AURORA BG ── */}
            <div className="absolute inset-0 z-0">
                <div className={`absolute inset-0 ${isDark ? 'bg-[#000000]' : 'bg-[#eef0f8]'}`} />
                {/* Top aurora blobs — BIS blue/violet theme */}
                <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full opacity-30"
                    style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)' }} />
                <div className="absolute -top-20 right-1/4 w-[500px] h-[500px] rounded-full opacity-25"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)' }} />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-15"
                    style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.3) 0%, transparent 70%)' }} />
                {/* Bottom subtle glow */}
                <div className="absolute bottom-0 left-0 right-0 h-64 opacity-10"
                    style={{ background: 'linear-gradient(to top, rgba(134, 96, 124, 0.2), transparent)' }} />
            </div>

            {/* ── SIDEBAR ── */}
            <aside className={`relative z-10 w-[240px] flex-col p-3 hidden lg:flex ${glass} border-r border-white/[0.06] rounded-none`}>
                <button onClick={() => setMessages([])}
                    className={`flex items-center gap-2 ${glassStrong} py-2 px-3.5 rounded-xl text-[13px] font-medium mb-4 transition-all hover:bg-white/[0.08]`}>
                    <Plus size={14} className="text-violet-400" /> New chat
                </button>

                <div className="flex-1 overflow-y-auto space-y-1">
                    {messages.length > 0 && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] ${glass} ${textSoft}`}>
                            <span className="truncate">{messages[0]?.content.substring(0, 32)}...</span>
                        </div>
                    )}
                </div>

                {/* Brand */}
                <div className={`p-3 rounded-xl ${glass} mb-2`}>
                    <div className="flex items-center gap-2">
                        <FlowerIcon size={22} />
                        <div>
                            <p className="text-[12px] font-semibold tracking-tight">BIS Intel-Bot</p>
                            <p className={`text-[10px] ${textMuted}`}>Gemini 2.5 Flash</p>
                        </div>
                    </div>
                </div>

                <button onClick={() => setIsDark(!isDark)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl ${glass} transition-all text-[13px] ${textSoft} hover:bg-white/[0.08]`}>
                    {isDark ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-violet-400" />}
                    {isDark ? 'Light' : 'Dark'}
                </button>
            </aside>

            {/* ── MAIN ── */}
            <main className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto pl-4 pr-4 md:pl-6 md:pr-10 lg:pl-8 lg:pr-16 xl:pl-12 xl:pr-28 py-6">

                    {/* ── EMPTY STATE ── */}
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-4">
                            <div className="mb-4 relative">
                                <div className="w-16 h-16 flex items-center justify-center">
                                    <FlowerIcon size={48} />
                                </div>
                                {/* glow behind flower */}
                                <div className="absolute inset-0 rounded-full blur-2xl opacity-30 bg-violet-500" />
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight mb-1.5 bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">
                                BIS Intel-Bot
                            </h1>
                            <p className={`${textSoft} text-[13px] max-w-xs leading-relaxed mb-7`}>
                                AI assistant for the Bureau of Indian Standards
                            </p>
                            <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                                {suggestions.map((q, i) => (
                                    <button key={i} onClick={() => handleSend(q.text)}
                                        className={`text-left p-3 rounded-xl ${glass} hover:bg-white/[0.08] transition-all text-[13px] ${textSoft} group`}>
                                        <span className="text-base mb-0.5 block">{q.icon}</span>
                                        <span className="opacity-70 group-hover:opacity-100 transition-opacity text-[13px] leading-snug">{q.text}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-5">
                            {messages.map((m, i) => (
                                <div key={i} className={`group ${m.role === 'user' ? 'flex justify-end' : ''}`}>

                                    {/* ── USER BUBBLE (glass + right pointer, no avatar) ── */}
                                    {m.role === 'user' && (
                                        <div className="relative max-w-[70%]">
                                            <div className={`px-4 py-2.5 rounded-2xl rounded-tr-sm ${glassStrong} shadow-lg shadow-violet-500/5`}>
                                                <p className="text-[13px] leading-relaxed">{m.content}</p>
                                            </div>
                                            {/* Glass pointer triangle */}
                                            <div className="absolute -right-1.5 top-3 w-3 h-3 rotate-45"
                                                style={{
                                                    background: isDark ? 'rgba(148, 106, 106, 0.06)' : 'rgba(255,255,255,0.6)',
                                                    borderRight: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.6)',
                                                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.6)',
                                                }} />
                                        </div>
                                    )}

                                    {/* ── BOT RESPONSE (flower icon + glass bubble + left pointer) ── */}
                                    {m.role === 'assistant' && (
                                        <div className="flex gap-2.5 items-start">
                                            {/* Flower icon */}
                                            <div className="shrink-0 mt-1 relative">
                                                <FlowerIcon size={22} />
                                                <div className="absolute inset-0 rounded-full blur-lg opacity-20 bg-violet-500" />
                                            </div>

                                            {/* Glass bubble with left pointer */}
                                            <div className="relative flex-1 min-w-0">
                                                {/* Left pointer */}
                                                <div className="absolute -left-1.5 top-3 w-3 h-3 rotate-45"
                                                    style={{
                                                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.4)',
                                                        borderLeft: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.5)',
                                                        borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.5)',
                                                    }} />

                                                <div className={`px-4 py-3 rounded-2xl rounded-tl-sm ${glass} shadow-lg shadow-black/5`}>
                                                    {/* Markdown Body */}
                                                    <div className={`
                                                        prose prose-sm max-w-none
                                                        ${isDark ? 'prose-invert' : ''}
                                                        prose-headings:font-semibold prose-headings:tracking-tight
                                                        prose-h2:text-[14px] prose-h2:mt-4 prose-h2:mb-1.5
                                                        prose-h3:text-[13px] prose-h3:mt-3 prose-h3:mb-1
                                                        prose-p:text-[12.5px] prose-p:leading-[1.7] prose-p:mb-2
                                                        prose-li:text-[12.5px] prose-li:leading-[1.6] prose-li:my-0
                                                        prose-ul:my-1.5 prose-ol:my-1.5
                                                        prose-strong:font-semibold
                                                        prose-a:no-underline prose-a:font-medium
                                                        ${isDark ? 'prose-a:text-violet-400 hover:prose-a:text-violet-300' : 'prose-a:text-violet-600 hover:prose-a:text-violet-500'}
                                                        prose-table:text-[11px]
                                                        prose-th:py-1 prose-th:px-2 prose-th:font-semibold
                                                        prose-td:py-1 prose-td:px-2
                                                        prose-code:text-[11px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal
                                                        ${isDark ? 'prose-code:bg-white/[0.06] prose-code:text-violet-300' : 'prose-code:bg-white/50 prose-code:text-violet-600'}
                                                    `}>
                                                        <ReactMarkdown
                                                            components={{
                                                                a: ({ href, children }) => (
                                                                    <a href={href} target="_blank" rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-0.5 transition-colors">
                                                                        {children}<ExternalLink size={9} className="opacity-40 ml-0.5" />
                                                                    </a>
                                                                ),
                                                                table: ({ children }) => (
                                                                    <div className="overflow-x-auto my-2 rounded-lg">
                                                                        <table className="min-w-full border border-white/[0.06]">{children}</table>
                                                                    </div>
                                                                ),
                                                            }}
                                                        >{stripSources(m.content)}</ReactMarkdown>
                                                    </div>

                                                    {/* Sources */}
                                                    {m.sources && m.sources.length > 0 && (
                                                        <div className="mt-3 pt-2 border-t border-white/[0.06]">
                                                            <p className={`text-[10px] uppercase tracking-[0.15em] ${textMuted} mb-1.5 font-medium`}>References</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {m.sources.slice(0, 5).map((s, j) => (
                                                                    <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] ${glass} ${textSoft} hover:bg-white/[0.08] transition-all`}>
                                                                        <ExternalLink size={8} className="text-violet-400 opacity-60" />
                                                                        <span className="truncate max-w-[150px]">{s.title || 'BIS Source'}</span>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-0.5 mt-1.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleCopy(m.content, i)}
                                                        className={`p-1 rounded-md hover:bg-white/[0.06] transition-all ${textMuted}`} title="Copy">
                                                        {copiedIdx === i ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                    </button>
                                                    <button onClick={() => handleRegenerate(i)}
                                                        className={`p-1 rounded-md hover:bg-white/[0.06] transition-all ${textMuted}`} title="Regenerate">
                                                        <RotateCcw size={12} />
                                                    </button>
                                                    <button className={`p-1 rounded-md hover:bg-white/[0.06] transition-all ${textMuted}`} title="Good response">
                                                        <ThumbsUp size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Loading */}
                            {isLoading && (
                                <div className="flex gap-2.5 items-start">
                                    <div className="shrink-0 mt-1 relative">
                                        <FlowerIcon size={22} />
                                        <div className="absolute inset-0 rounded-full blur-lg opacity-30 bg-violet-500 animate-pulse" />
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl rounded-tl-sm ${glass}`}>
                                        <div className="flex items-center gap-2">
                                            <div className="flex space-x-1">
                                                <div className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" />
                                                <div className="w-1 h-1 bg-violet-300 rounded-full animate-bounce [animation-delay:150ms]" />
                                                <div className="w-1 h-1 bg-indigo-300 rounded-full animate-bounce [animation-delay:300ms]" />
                                            </div>
                                            <span className={`text-[11px] ${textMuted}`}>Thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>

                {/* ── INPUT ── */}
                <div className="px-4 md:px-10 lg:px-16 xl:px-28 pb-4 pt-2">
                    <div className="max-w-3xl mx-auto">
                        <div className={`flex items-center gap-2 ${glassStrong} rounded-2xl px-3.5 py-1 transition-all focus-within:border-violet-500/20 focus-within:shadow-lg focus-within:shadow-violet-500/5`}>
                            <input
                                className={`flex-1 bg-transparent border-none py-2 px-1 outline-none text-[13px] ${textPrimary} placeholder:${textMuted}`}
                                placeholder="Ask about BIS standards, certifications..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                disabled={isLoading}
                            />
                            <button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
                                className={`p-1.5 rounded-lg transition-all ${input.trim() && !isLoading
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20 hover:bg-violet-500 hover:scale-105'
                                    : `bg-white/[0.04] ${textMuted} cursor-not-allowed`
                                    }`}>
                                <Send size={14} />
                            </button>
                        </div>
                        <p className={`text-[8px] text-center ${textMuted} mt-2 uppercase tracking-[0.3em]`}>
                            Bureau of Indian Standards • bis.gov.in
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}