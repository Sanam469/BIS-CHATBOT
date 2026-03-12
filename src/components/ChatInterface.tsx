'use client';
import { useState, useRef, useEffect } from 'react';
import { Plus, Send, Moon, Sun, MessageSquare, ScanLine } from 'lucide-react';

export default function ChatInterface() {
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend() {
        if (!input.trim() || isLoading) return;
        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages, userMsg] }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to BIS Brain." }]);
        } finally {
            setIsLoading(false);
        }
    }

    const theme = {
        main: isDarkMode ? 'bg-[#131314]' : 'bg-[#f0f4f9]',
        sidebar: isDarkMode ? 'bg-[#1e1f20]' : 'bg-[#CCD0D8]',
        text: isDarkMode ? 'text-[#e3e3e3]' : 'text-[#1f1f1f]',
        input: isDarkMode ? 'bg-[#282a2d]' : 'bg-white',
        border: isDarkMode ? 'border-[#333537]' : 'border-[#d2d2d2]',
        // Message Bubbles
        userBubble: isDarkMode ? 'bg-[#2b2c2f] border-[#3c4043]' : 'bg-[#e1e5eb] border-[#c8ccd2]',
        botBubble: isDarkMode ? 'bg-[#1e1f20] border-[#333537]' : 'bg-white border-[#e3e3e3]'
    };

    return (
        <div className={`flex h-screen w-full ${theme.main} ${theme.text} transition-colors duration-300 font-sans`}>
            
            {/* SIDEBAR (20%) */}
            <aside className={`w-[20%] ${theme.sidebar} flex flex-col p-4 border-r ${theme.border} hidden md:flex shadow-inner`}>
                <button 
                    onClick={() => setMessages([])}
                    className={`flex items-center gap-3 ${isDarkMode ? 'bg-[#282a2d] hover:bg-[#333537]' : 'bg-[#dde3ea] hover:bg-[#d3d9e1]'} py-3 px-5 rounded-full text-sm font-medium mb-6 transition-all shadow-sm`}
                >
                    <Plus size={20} /> New Chat
                </button>

                <div className="flex-1 overflow-y-auto space-y-1">
                    <div className={`flex items-center gap-3 p-3 rounded-lg text-sm cursor-pointer hover:${isDarkMode ? 'bg-[#333537]' : 'bg-[#dde3ea]'}`}>
                        <MessageSquare size={16} className="opacity-60" /> 
                        <span className="truncate">BIS Standards Guide</span>
                    </div>
                </div>

                <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-2xl border ${theme.border} hover:${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} transition-all`}
                >
                    {isDarkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-blue-600" />}
                    <span className="text-sm font-medium">{isDarkMode ? 'Light' : 'Dark'}</span>
                </button>
            </aside>

            {/* CHAT PANEL */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                
                {/* Conversation Area */}
                <div className="flex-1 overflow-y-auto px-6 md:px-32 lg:px-48 py-12 space-y-6">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent animate-pulse">
                                Hello, BIS Expert.
                            </h2>
                            <p className="text-gray-500 text-lg opacity-80">I&apos;m powered by Gemini 2.5 Flash. How can I help?</p>
                        </div>
                    ) : (
                        messages.map((m, i) => (
                            <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`max-w-[85%] p-5 rounded-3xl border transition-all ${
                                    m.role === 'user' 
                                    ? `${theme.userBubble} rounded-tr-none shadow-sm` 
                                    : `${theme.botBubble} rounded-tl-none shadow-md`
                                }`}>
                                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                                        {m.content}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                    
                    {isLoading && (
                        <div className="flex justify-start animate-pulse">
                            <div className={`max-w-[85%] p-5 rounded-3xl border ${theme.botBubble} rounded-tl-none`}>
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>

                {/* Input Section */}
                <div className="p-2 md:px-32 lg:px-22 pb-5">
                    <div className="max-w-4xl mx-auto">
                        <div className={`flex items-center ${theme.input} border ${theme.border} rounded-full px-4 py-2 shadow-2xl focus-within:ring-2 focus-within:ring-blue-500/20 transition-all`}>
                            
                            <button 
                                onClick={() => alert("Launching ISI Scanner...")}
                                className={`p-3 rounded-full hover:${isDarkMode ? 'bg-[#333537]' : 'bg-[#f0f4f9]'} transition-colors group relative`}
                            >
                                <ScanLine size={20} className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} group-hover:text-blue-500 transition-colors`} />
                            </button>

                            <input 
                                className={`flex-1 bg-transparent border-none py-3 px-3 outline-none text-[16px] ${theme.text} placeholder-gray-500`}
                                placeholder="Message BIS Intel-Bot..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            
                            <button 
                                onClick={handleSend}
                                className={`p-3 rounded-full transition-all ${input.trim() ? 'text-blue-500 hover:bg-blue-500/10' : 'text-gray-500 opacity-20 cursor-not-allowed'}`}
                            >
                                <Send size={22} />
                            </button>
                        </div>
                        <p className="text-[10px] text-center text-gray-500 mt-4 uppercase tracking-[0.25em] font-bold opacity-40">
                            Standards • Certification • Verify
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}