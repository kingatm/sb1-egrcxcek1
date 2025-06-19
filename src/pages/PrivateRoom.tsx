import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { Copy, Share2, Home, Mic, MicOff, Video, VideoOff, MessageCircle, Send } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
}

const PrivateRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [roomCopied, setRoomCopied] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const roomUrl = `${window.location.origin}/room/${roomId}`;

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    initializeMedia();
    return () => {
      cleanupConnections();
    };
  }, []);

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit('joinPrivateRoom', { roomId, username: 'Anonymous' });

    socket.on('roomJoined', (data) => {
      setParticipants(data.participants);
      if (data.participants.length === 2) {
        setIsConnected(true);
        if (data.shouldCreateOffer) {
          createOffer();
        }
      }
    });

    socket.on('userJoinedRoom', (data) => {
      setParticipants(data.participants);
      if (data.participants.length === 2) {
        setIsConnected(true);
        if (data.shouldCreateOffer) {
          createOffer();
        }
      }
    });

    socket.on('userLeftRoom', (data) => {
      setParticipants(data.participants);
      setIsConnected(false);
      cleanupPeerConnection();
    });

    socket.on('roomMessage', (data) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: data.message,
        sender: data.sender,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('webrtc-offer', async (data) => {
      await handleOffer(data.offer);
    });

    socket.on('webrtc-answer', async (data) => {
      await handleAnswer(data.answer);
    });

    socket.on('webrtc-ice-candidate', async (data) => {
      await handleIceCandidate(data.candidate);
    });

    return () => {
      socket.off('roomJoined');
      socket.off('userJoinedRoom');
      socket.off('userLeftRoom');
      socket.off('roomMessage');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
    };
  }, [socket, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          roomId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    return peerConnection;
  };

  const createOffer = async () => {
    peerConnectionRef.current = createPeerConnection();
    
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      if (socket) {
        socket.emit('webrtc-offer', { roomId, offer });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    peerConnectionRef.current = createPeerConnection();
    
    try {
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (socket) {
        socket.emit('webrtc-answer', { roomId, answer });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const cleanupPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const cleanupConnections = () => {
    cleanupPeerConnection();
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const copyRoomUrl = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setRoomCopied(true);
      setTimeout(() => setRoomCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy room URL:', error);
    }
  };

  const shareRoom = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my SwiftChat room',
          text: `Join me in a private video chat on SwiftChat`,
          url: roomUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
        // Fallback to copying the URL if sharing fails
        copyRoomUrl();
      }
    } else {
      copyRoomUrl();
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const sendMessage = () => {
    if (!messageText.trim() || !socket) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'You',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    socket.emit('sendRoomMessage', { roomId, message: messageText, sender: 'Anonymous' });
    setMessageText('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 transition duration-200"
            >
              <Home className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Private Room</h1>
              <p className="text-sm text-gray-600">Room: {roomId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-gray-600 text-sm">
              {participants.length}/2 participants
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={shareRoom}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition duration-200 text-white text-sm"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
            <button
              onClick={copyRoomUrl}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition duration-200 text-white text-sm"
            >
              <Copy className="w-4 h-4" />
              <span>{roomCopied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Video Area */}
        <div className={`${showChat ? 'lg:flex-1' : 'w-full'} p-4`}>
          {participants.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center max-w-md mx-auto">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Waiting for someone to join</h3>
                <p className="text-gray-600 mb-6">Share this room link with someone to start chatting:</p>
                <div className="bg-gray-50 rounded p-3 mb-4 break-all text-sm text-gray-700 border">
                  {roomUrl}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={shareRoom}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition duration-200 text-white"
                  >
                    Share Room
                  </button>
                  <button
                    onClick={copyRoomUrl}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition duration-200 text-white"
                  >
                    {roomCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              {/* Remote Video */}
              <div className="relative bg-gray-900 rounded-lg overflow-hidden min-h-[300px]">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 rounded px-2 py-1">
                  <span className="text-white text-sm">Partner</span>
                </div>
              </div>

              {/* Local Video */}
              <div className="relative bg-gray-900 rounded-lg overflow-hidden min-h-[300px]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 rounded px-2 py-1">
                  <span className="text-white text-sm">You</span>
                </div>
                
                {/* Local Controls */}
                <div className="absolute bottom-4 right-4 flex space-x-2">
                  <button
                    onClick={toggleMute}
                    className={`p-2 rounded-full ${
                      isMuted ? 'bg-red-600' : 'bg-gray-600'
                    } transition duration-200`}
                  >
                    {isMuted ? (
                      <MicOff className="w-4 h-4 text-white" />
                    ) : (
                      <Mic className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-full ${
                      isVideoOff ? 'bg-red-600' : 'bg-gray-600'
                    } transition duration-200`}
                  >
                    {isVideoOff ? (
                      <VideoOff className="w-4 h-4 text-white" />
                    ) : (
                      <Video className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className="p-2 rounded-full bg-gray-600 transition duration-200"
                  >
                    <MessageCircle className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-full lg:w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-gray-900 font-semibold">Room Chat</h3>
            </div>
            
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="break-words">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-blue-600">
                        {message.sender}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-900 text-sm">{message.text}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageText.trim()}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 text-white"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivateRoom;