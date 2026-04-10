'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { Send, Bot, User, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';

export default function ChatBot() {
    const { push } = useRouter();
    const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const message = input.trim();
        setInput('');
        await sendMessage(message);
    };

    const handleBack = () => {
        push("/");
    };

    return (
    <div className="flex flex-col h-screen relative">
        {/* Glassmorphism overlay for the chat */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
        
        {/* Header */}
        <div className="relative z-10 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-md border-b border-white/10 text-white p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleBack}
                        className="bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-300"
                    >
                        <Bot className="w-6 h-6" />
                    </Button>
                    
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                            Arven
                        </h1>
                        <p className="text-sm text-gray-300/90">AI Customer Support Assistant</p>
                    </div>
                </div>
                
                <Button
                    onClick={clearMessages}
                    className="px-4 py-2 text-sm bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 backdrop-blur-sm text-white"
                >
                    <span className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Clear</span>
                    </span>
                </Button>
            </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
            {messages.length === 0 && (
                <div className="flex-1 flex flex-col justify-center items-center text-center min-h-0 mt-9">
                    <div className="mb-4 rounded-2xl p-8">
                        {/* <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                            <Bot className="w-8 h-8 text-white" />
                        </div> */}
                        <h3 className="text-xl font-semibold text-white mb-2">
                            How can I help you today?
                        </h3>
                        <p className="text-gray-400">
                            Ask me anything about Aven&apos;s products and services
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
                        {[
                            "What is the Aven card?",
                            "How do I apply?",
                            "What are the fees?",
                            "Is Aven safe to use?"
                        ].map((suggestion) => (
                            <button
                                key={suggestion}
                                onClick={() => setInput(suggestion)}
                                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-full transition-all duration-300 backdrop-blur-sm text-white hover:scale-105 transform"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}
                >
                    <div
                        className={`flex max-w-[75%] ${
                            message.role === 'user' ? 'flex-row-reverse space-x-reverse space-x-3' : 'flex-row space-x-3'
                        } items-start`}
                    >
                        {/* Avatar */}
                        <div
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                message.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25'
                                    : 'bg-gradient-to-br from-gray-700 to-gray-800 shadow-lg shadow-gray-800/25'
                            } backdrop-blur-sm border border-white/10`}
                        >
                            {message.role === 'user' ? (
                                <User className="w-5 h-5 text-white" />
                            ) : (
                                <Bot className="w-5 h-5 text-white" />
                            )}
                        </div>
                        
                        <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {/* Message Bubble */}
                            <div
                                className={`px-4 py-3 rounded-2xl backdrop-blur-md border shadow-lg ${
                                    message.role === 'user'
                                        ? 'bg-gradient-to-br from-blue-600/60 to-blue-700/60 text-white border-blue-500/20 shadow-blue-500/15'
                                        : 'bg-gray-800/60 text-white border-gray-700/30 shadow-gray-900/20'
                                } transition-all duration-300 hover:shadow-xl`}
                            >
                                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            </div>
                            
                            {/* Sources */}
                            {message.sources && message.sources.length > 0 && (
                                <div className="mt-3 space-y-2 max-w-md">
                                    <p className="text-xs text-gray-400 font-medium flex items-center space-x-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        <span>Sources</span>
                                    </p>
                                    {message.sources.slice(0, 3).map((source, idx) => (
                                        <div key={idx} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-2 hover:bg-white/10 transition-all duration-300">
                                            <a
                                                href={source.source}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center space-x-2 text-xs text-gray-300 hover:text-blue-400 transition-colors"
                                                title={source.title}
                                            >
                                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate flex-1">{source.title}</span>
                                                <span className="text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded text-xs">
                                                    {(source.score).toFixed(2)}
                                                </span>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Timestamp */}
                            <p className="text-xs text-gray-500 mt-2">
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 shadow-lg shadow-gray-800/25 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-gray-800/90 backdrop-blur-md border border-gray-700/50 rounded-2xl px-4 py-3 shadow-lg shadow-gray-900/30">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
            <div className="mx-6 mb-4 p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl text-red-300 text-sm relative z-10">
                <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                </div>
            </div>
        )}

        {/* Input Section */}
        <div className="relative z-10 p-6 bg-gradient-to-t from-gray-900/90 to-transparent backdrop-blur-md border-t border-white/10">
            <form onSubmit={handleSubmit} className="flex space-x-4">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me about Aven..."
                        className="w-full px-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-white placeholder-gray-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/15"
                        disabled={isLoading}
                    />
                </div>
                
                <Button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform backdrop-blur-sm border border-blue-500/30"
                >
                    <Send className="w-5 h-5" />
                </Button>
            </form>
        </div>
    </div>
);
}
