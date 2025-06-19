import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { Send, SkipForward, Home } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'partner';
  timestamp: Date;
}

const TextChat: React.FC = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    // Join text chat queue
    socket.emit('joinTextChat', { username: 'Anonymous' });

    socket.on('chatMatched', () => {
      setIsWaiting(false);
      setIsConnected(true);
      addSystemMessage('Connected to a stranger. Say hello!');
    });

    socket.on('messageReceived', (data) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: data.message,
        sender: 'partner',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('partnerDisconnected', () => {
      setIsConnected(false);
      setIsWaiting(true);
      addSystemMessage('Stranger disconnected. Looking for a new partner...');
      socket.emit('joinTextChat', { username: 'Anonymous' });
    });

    return () => {
      socket.off('chatMatched');
      socket.off('messageReceived');
      socket.off('partnerDisconnected');
    };
  }, [socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addSystemMessage = (text: string) => {
    const systemMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const sendMessage = () => {
    if (!messageText.trim() || !socket || !isConnected) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'me',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    socket.emit('sendMessage', { message: messageText });
    setMessageText('');
  };

  const handleNext = () => {
    if (!socket) return;
    
    setIsConnected(false);
    setIsWaiting(true);
    setMessages([]);
    socket.emit('findNewPartner');
    socket.emit('joinTextChat', { username: 'Anonymous' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 transition duration-200"
            >
              <Home className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Text Chat</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-gray-600 text-sm">
              {isWaiting ? 'Finding partner...' : 'Connected'}
            </span>
          </div>

          <button
            onClick={handleNext}
            disabled={!isConnected}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 text-white"
          >
            <SkipForward className="w-4 h-4" />
            <span>Next</span>
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4">
        <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            {isWaiting && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-600">Looking for someone to chat with...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender === 'me'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="break-words">{message.text}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender === 'me' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isConnected ? "Type your message..." : "Waiting for connection..."}
                disabled={!isConnected}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || !isConnected}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 text-white"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextChat;