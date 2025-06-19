import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { Mic, MicOff, Video, VideoOff, SkipForward, Home } from 'lucide-react';

const VideoChat: React.FC = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

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
    if (!socket) return;

    socket.emit('joinVideoChat', { username: 'Anonymous' });

    socket.on('videoChatMatched', async (data) => {
      setIsWaiting(false);
      setIsConnected(true);
      
      if (data.shouldCreateOffer) {
        await createOffer();
      }
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

    socket.on('partnerDisconnected', () => {
      setIsConnected(false);
      setIsWaiting(true);
      cleanupPeerConnection();
      socket.emit('joinVideoChat', { username: 'Anonymous' });
    });

    return () => {
      socket.off('videoChatMatched');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('partnerDisconnected');
    };
  }, [socket]);

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
        socket.emit('webrtc-offer', { offer });
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
        socket.emit('webrtc-answer', { answer });
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

  const handleNext = () => {
    if (!socket) return;
    
    setIsConnected(false);
    setIsWaiting(true);
    cleanupPeerConnection();
    socket.emit('findNewPartner');
    socket.emit('joinVideoChat', { username: 'Anonymous' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 transition duration-200"
            >
              <Home className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Video Chat</h1>
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

      {/* Video Area */}
      <div className="flex-1 p-4">
        <div className="max-w-6xl mx-auto h-full">
          {isWaiting ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600">Looking for someone to video chat with...</p>
              <p className="text-gray-500 text-sm mt-2">Make sure your camera and microphone are enabled</p>
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
                      <MicOff className="w-5 h-5 text-white" />
                    ) : (
                      <Mic className="w-5 h-5 text-white" />
                    )}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-full ${
                      isVideoOff ? 'bg-red-600' : 'bg-gray-600'
                    } transition duration-200`}
                  >
                    {isVideoOff ? (
                      <VideoOff className="w-5 h-5 text-white" />
                    ) : (
                      <Video className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoChat;