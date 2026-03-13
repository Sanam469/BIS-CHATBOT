'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, RotateCcw, Copy, Check, ThumbsUp, ExternalLink, Plus, Moon, Sun, LogOut } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: { url: string; title: string }[];
}

/* ── Minimalist Monochromatic Flower Icon ── */
function FlowerIcon({ size = 20, isDark = true }: { size?: number, isDark?: boolean }) {
    const color = isDark ? '#ffffff' : '#000000';
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <ellipse key={i} cx="16" cy="8" rx="3.5" ry="7"
                    fill={isDark ? `rgba(255,255,255,${0.2 + i * 0.05})` : `rgba(0,0,0,${0.1 + i * 0.05})`}
                    transform={`rotate(${angle} 16 16)`} />
            ))}
            <circle cx="16" cy="16" r="4" fill={isDark ? '#333333' : '#e5e5e5'} />
            <circle cx="16" cy="16" r="2" fill={color} />
        </svg>
    );
}

export default function ChatInterface() {
    const router = useRouter();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDark, setIsDark] = useState(true);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const email = localStorage.getItem('userEmail');
        if (!token || !email) {
            router.push('/login');
            return;
        }
        setUserEmail(email);
        const savedHistory = localStorage.getItem(`chat_history_${email}`);
        if (savedHistory) {
            try {
                setMessages(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to parse history");
            }
        }
    }, [router]);

    useEffect(() => {
        if (userEmail && messages.length > 0) {
            localStorage.setItem(`chat_history_${userEmail}`, JSON.stringify(messages));
        } else if (userEmail && messages.length === 0) {
            localStorage.removeItem(`chat_history_${userEmail}`);
        }
    }, [messages, userEmail]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [...messages, userMsg] }),
        });

        if (!res.body) throw new Error("No body");

        // Get sources from the custom header we set in the backend
        const sourcesHeader = res.headers.get('X-Sources');
        const sources = sourcesHeader ? JSON.parse(decodeURIComponent(sourcesHeader)) : [];

        // Add an empty assistant message to start filling
        setMessages(prev => [...prev, { role: 'assistant', content: '', sources }]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            accumulatedText += decoder.decode(value, { stream: true });
            
            // Update the last message in real-time
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = accumulatedText;
                return updated;
            });
        }
    } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error.' }]);
    } finally {
        setIsLoading(false);
    }
};

    const handleCopy = useCallback((text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    }, []);

    const stripSources = (text: string) =>
        text.replace(/\n*📋\s*\*{0,2}Sources:?\*{0,2}[\s\S]*$/i, '').trim();

    /* ── STYLING LOGIC ── */
    const glass = isDark
        ? 'bg-[#121212] border border-[#222222]' // Dark Mode Grey Bar/Bubble
        : 'bg-[#f4f4f4] border border-[#e0e0e0]'; // Light Mode "Dark White" Bar/Bubble

    const glassStrong = isDark
        ? 'bg-[#1a1a1a] border border-[#333333]'
        : 'bg-[#ebebeb] border border-[#dcdcdc]';

    const textPrimary = isDark ? 'text-white' : 'text-black';
    const textSoft = isDark ? 'text-[#a0a0a0]' : 'text-[#444444]';
    const textMuted = isDark ? 'text-[#666666]' : 'text-[#999999]';

    return (
        <div className={`relative flex h-screen w-full overflow-hidden ${textPrimary} ${isDark ? 'bg-black' : 'bg-white'} transition-colors duration-300`}>

            {/* ── SIDEBAR (History) ── */}
            <aside className={`relative z-10 w-[260px] flex-col p-4 hidden lg:flex ${glass} rounded-none`}>
                <button onClick={() => setMessages([])}
                    className={`flex items-center gap-2 ${glassStrong} py-2.5 px-4 rounded-xl text-[13px] font-medium mb-6 transition-all hover:opacity-80`}>
                    <Plus size={14} /> New chat
                </button>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {messages
                        .map((msg, idx) => ({ msg, idx }))
                        .filter(item => item.msg.role === 'user')
                        .slice(0, 100)
                        .map((item) => (
                        <div 
                            key={item.idx} 
                            onClick={() => {
                                const element = document.getElementById(`message-${item.idx}`);
                                element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] ${glassStrong} ${textSoft} hover:text-white transition-all cursor-pointer group active:scale-95`}
                        >
                            <span className="truncate flex-1">{item.msg.content}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-auto pt-4 space-y-4">
                    <div className="flex items-center gap-3 px-1">
                        <FlowerIcon size={24} isDark={isDark} />
                        <div>
                            <p className="text-[13px] font-bold tracking-tight">BIS Intel-Bot</p>
                            <p className={`text-[10px] ${textMuted} truncate w-32`} title={userEmail || ''}>
                                {userEmail ? userEmail : '2026 Edition'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button onClick={() => setIsDark(!isDark)}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl ${glassStrong} transition-all text-[13px] hover:opacity-70`}>
                            {isDark ? <Sun size={14} /> : <Moon size={14} />}
                            {isDark ? 'Light' : 'Dark'}
                        </button>

                        <button onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('userEmail');
                            router.push('/login');
                        }}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl ${glassStrong} transition-all text-[13px] hover:bg-red-500/10 text-red-500`}>
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── MAIN CHAT AREA ── */}
            <main className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-24 xl:px-48 py-8">

                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <FlowerIcon size={64} isDark={isDark} />
                            <h1 className="text-3xl font-bold tracking-tighter mt-6 mb-2">How can I help you today?</h1>
                            <p className={`${textSoft} text-[14px] mb-12`}>Official Technical Assistant for Bureau of Indian Standards</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
                                {[
                                    "What is BIS and its core functions?",
                                    "How to apply for ISI mark?",
                                    "Tell me about Hallmarking",
                                    "BIS Laboratory schemes"
                                ].map((q, i) => (
                                    <button key={i} onClick={() => handleSend(q)}
                                        className={`text-left p-4 rounded-2xl ${glass} hover:bg-opacity-50 transition-all text-[13px] ${textSoft}`}>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-4">
                            {messages.map((m, i) => (
                                <div key={i} id={`message-${i}`} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} scroll-mt-4`}>
                                    
                                    {/* Bubble */}
                                    <div className={`${m.role === 'user' ? 'max-w-[75%] w-fit' : 'max-w-[85%]'} ${m.role === 'user' ? 'px-4 py-2.5' : 'px-5 py-3.5'} rounded-3xl ${glass} ${m.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'} shadow-sm`}>
                                        <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : 'prose-slate'} 
                                            prose-p:leading-relaxed prose-p:text-[14px] ${textPrimary}`}>
                                            <ReactMarkdown 
    // remarkGfm must be imported: import remarkGfm from 'remark-gfm';
    remarkPlugins={[remarkGfm]} 
    components={{
        // 🎨 Table Fix: Overflow hidden & glass styling to fit boundary
        table: ({node, ...props}) => (
            <div className="my-10 overflow-x-auto rounded-xl border border-white/10 bg-black/5 dark:bg-white/5">
                <table {...props} className="min-w-full divide-y divide-white/10 border-collapse" />
            </div>
        ),
        th: ({node, ...props}) => (
            <th {...props} className="px-4 py-3 font-bold text-left bg-black/10 dark:bg-white/5 text-[13px] uppercase tracking-wider" />
        ),
        td: ({node, ...props}) => (
            <td {...props} className="px-4 py-3 border-t border-white/5 text-[13px] leading-relaxed" />
        ),
        // 🚀 Quadruple Newline Fix: Ensures p tags have massive gaps
        p: ({node, ...props}) => (
            <p {...props} className="mb-12 last:mb-0 leading-relaxed text-[14px]" />
        ),
        // 📑 Heading gaps
        h3: ({node, ...props}) => (
            <h3 {...props} className="text-lg font-bold mt-12 mb-6 flex items-center gap-2" />
        ),
        a: ({node, ...props}) => (
            <a {...props} target="_blank" className="underline decoration-white/30 underline-offset-4 hover:text-white transition-colors" />
        ),
        ul: ({node, ...props}) => <ul {...props} className="my-6 space-y-3 list-disc pl-5" />,
        ol: ({node, ...props}) => <ol {...props} className="my-6 space-y-3 list-decimal pl-5" />,
        li: ({node, ...props}) => <li {...props} className="pl-1" />
    }}
>
    {m.role === 'assistant' ? stripSources(m.content) : m.content}
</ReactMarkdown>
                                        </div>

                                        {/* Sources — max 5, hidden only when entire response is a decline */}
                                        {m.sources && m.sources.length > 0 && !(m.content.length < 400 && m.content.match(/could not find information|falls outside the scope/i)) && (
                                            <div className="mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                                                <p className={`text-[10px] font-bold mb-2 uppercase tracking-widest ${textMuted}`}>Sources</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {m.sources.slice(0, 5).map((s, j) => (
                                                        <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                                                            className={`text-[11px] flex items-center gap-1.5 px-3 py-1 rounded-full ${glassStrong} hover:opacity-70 transition-all`}>
                                                            <ExternalLink size={10} /> {s.title || 'Source'}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {m.role === 'assistant' && (
                                        <div className="flex gap-2 mt-2 ml-2">
                                            <button onClick={() => handleCopy(m.content, i)} className={`${textMuted} hover:text-white transition-colors`}>
                                                {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                            <button className={`${textMuted} hover:text-white`}><ThumbsUp size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-center gap-3 px-2">
                                    <div className="w-2 h-2 rounded-full bg-current animate-bounce" />
                                    <div className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0.4s]" />
                                </div>
                            )}
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>

                {/* ── INPUT BOX ── */}
                <div className="p-6 md:px-12 lg:px-24 xl:px-48">
                    <div className={`max-w-3xl mx-auto flex items-center gap-3 px-4 py-2 rounded-2xl ${glassStrong}`}>
                        <input
                            className={`flex-1 bg-transparent border-none py-3 outline-none text-[14px] ${textPrimary} placeholder:opacity-40`}
                            placeholder="Message BIS Intel-Bot..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
                            className={`p-2.5 rounded-xl transition-all ${input.trim() ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : 'opacity-20'}`}>
                            <Send size={16} />
                        </button>
                    </div>
                    <p className={`text-[10px] text-center mt-3 ${textMuted} uppercase tracking-widest`}>
                        Bureau of Indian Standards • Confidential Challenge 2026
                    </p>
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isDark ? '#333' : '#ddd'};
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? '#444' : '#ccc'};
                }
            `}</style>
        </div>
    );
}