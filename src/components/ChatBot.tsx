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
        <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <Button variant="outline" size="icon" onClick={handleBack}>
                    <Bot className="w-8 h-8" />
                </Button>
                
                <div>
                <h1 className="text-xl font-bold">Arven</h1>
                <p className="text-sm opacity-90">Aven Customer Support Assistant</p>
                </div>
            </div>
            <Button
                onClick={clearMessages}
                className="px-3 py-1 text-sm bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
                Clear Chat
            </Button>
            </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
                <h3 className="text-lg font-medium mb-2">Welcome to Aven Support</h3>
                <p>Ask me anything about Aven's financial services and products!</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                    "What is the Aven card?",
                    "How do I apply?",
                    "What are the fees?",
                    "Is Aven safe to use?"
                ].map((suggestion) => (
                    <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
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
                className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
            >
                <div
                className={`flex max-w-[80%] ${
                    message.role === 'user' ? 'flex-row' : 'flex-row-reverse'
                }`}
                >
                <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                        ? 'bg-blue-500 text-white ml-3'
                        : 'bg-gray-200 text-gray-600 mr-3'
                    }`}
                >
                    {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div>
                    <div
                    className={`px-4 py-3 rounded-lg ${
                        message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                    >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500 font-medium">Sources:</p>
                        {message.sources.slice(0, 3).map((source, idx) => (
                        <div key={idx} className="text-xs text-gray-600 flex items-center space-x-1">
                            <ExternalLink className="w-3 h-3" />
                            <a
                            href={source.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 truncate max-w-xs"
                            title={source.title}
                            >
                            {source.title}
                            </a>
                            <span className="text-gray-400">({(source.score).toFixed(2)})</span>
                        </div>
                        ))}
                    </div>
                    )}
                    
                    <p className="text-xs text-gray-400 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                </div>
            </div>
            ))}

            {isLoading && (
            <div className="flex justify-start">
                <div className="flex">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 mr-3 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                </div>
                </div>
            </div>
            )}

            <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
            <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me about Aven..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-transparent"
                disabled={isLoading}
            />
            <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send className="w-5 h-5" />
            </Button>
            </form>
        </div>
        </div>
    );
}