import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store for managing connections and rooms
const textChatQueue = [];
const videoChatQueue = [];
const privateRooms = new Map();
const socketToRoom = new Map();
const socketToUsername = new Map();

// Utility function to generate unique room IDs
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle text chat matching
  socket.on('joinTextChat', (data) => {
    socketToUsername.set(socket.id, data.username);
    
    // Check if there's someone waiting
    if (textChatQueue.length > 0) {
      const partner = textChatQueue.shift();
      
      // Create a text chat room
      const roomId = `text_${generateRoomId()}`;
      socket.join(roomId);
      partner.socket.join(roomId);
      
      // Store room associations
      socketToRoom.set(socket.id, roomId);
      socketToRoom.set(partner.socket.id, roomId);
      
      // Notify both users
      socket.emit('chatMatched', { 
        partnerUsername: partner.username,
        roomId 
      });
      partner.socket.emit('chatMatched', { 
        partnerUsername: data.username,
        roomId 
      });
    } else {
      // Add to queue
      textChatQueue.push({
        socket,
        username: data.username
      });
    }
  });

  // Handle video chat matching
  socket.on('joinVideoChat', (data) => {
    socketToUsername.set(socket.id, data.username);
    
    // Check if there's someone waiting
    if (videoChatQueue.length > 0) {
      const partner = videoChatQueue.shift();
      
      // Create a video chat room
      const roomId = `video_${generateRoomId()}`;
      socket.join(roomId);
      partner.socket.join(roomId);
      
      // Store room associations
      socketToRoom.set(socket.id, roomId);
      socketToRoom.set(partner.socket.id, roomId);
      
      // Notify both users (first user creates offer)
      socket.emit('videoChatMatched', { 
        partnerUsername: partner.username,
        roomId,
        shouldCreateOffer: true
      });
      partner.socket.emit('videoChatMatched', { 
        partnerUsername: data.username,
        roomId,
        shouldCreateOffer: false
      });
    } else {
      // Add to queue
      videoChatQueue.push({
        socket,
        username: data.username
      });
    }
  });

  // Handle private room joining
  socket.on('joinPrivateRoom', (data) => {
    const { roomId, username } = data;
    socketToUsername.set(socket.id, username);
    socketToRoom.set(socket.id, roomId);
    
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!privateRooms.has(roomId)) {
      privateRooms.set(roomId, {
        participants: [],
        messages: []
      });
    }
    
    const room = privateRooms.get(roomId);
    
    // Add participant if not already in room
    if (!room.participants.includes(username)) {
      room.participants.push(username);
    }
    
    // Notify user about room state
    socket.emit('roomJoined', {
      participants: room.participants,
      shouldCreateOffer: room.participants.length === 2 && room.participants[0] === username
    });
    
    // Notify others in room
    socket.to(roomId).emit('userJoinedRoom', {
      username,
      participants: room.participants,
      shouldCreateOffer: room.participants.length === 2 && room.participants[0] !== username
    });
  });

  // Handle text messages
  socket.on('sendMessage', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('messageReceived', {
        message: data.message,
        sender: socketToUsername.get(socket.id)
      });
    }
  });

  // Handle room messages (private rooms)
  socket.on('sendRoomMessage', (data) => {
    const { roomId, message, sender } = data;
    
    socket.to(roomId).emit('roomMessage', {
      message,
      sender
    });
  });

  // WebRTC signaling for video chats
  socket.on('webrtc-offer', (data) => {
    const roomId = socketToRoom.get(socket.id) || data.roomId;
    if (roomId) {
      socket.to(roomId).emit('webrtc-offer', {
        offer: data.offer
      });
    }
  });

  socket.on('webrtc-answer', (data) => {
    const roomId = socketToRoom.get(socket.id) || data.roomId;
    if (roomId) {
      socket.to(roomId).emit('webrtc-answer', {
        answer: data.answer
      });
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const roomId = socketToRoom.get(socket.id) || data.roomId;
    if (roomId) {
      socket.to(roomId).emit('webrtc-ice-candidate', {
        candidate: data.candidate
      });
    }
  });

  // Handle finding new partner
  socket.on('findNewPartner', () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      // Notify partner about disconnection
      socket.to(roomId).emit('partnerDisconnected');
      
      // Leave current room
      socket.leave(roomId);
      socketToRoom.delete(socket.id);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from queues
    const textIndex = textChatQueue.findIndex(item => item.socket.id === socket.id);
    if (textIndex !== -1) {
      textChatQueue.splice(textIndex, 1);
    }
    
    const videoIndex = videoChatQueue.findIndex(item => item.socket.id === socket.id);
    if (videoIndex !== -1) {
      videoChatQueue.splice(videoIndex, 1);
    }
    
    // Handle room disconnection
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      // Notify others in room
      socket.to(roomId).emit('partnerDisconnected');
      
      // Handle private room cleanup
      if (privateRooms.has(roomId)) {
        const room = privateRooms.get(roomId);
        const username = socketToUsername.get(socket.id);
        room.participants = room.participants.filter(p => p !== username);
        
        // Notify remaining users
        socket.to(roomId).emit('userLeftRoom', {
          username,
          participants: room.participants
        });
        
        // Clean up empty private rooms
        if (room.participants.length === 0) {
          privateRooms.delete(roomId);
        }
      }
    }
    
    // Cleanup
    socketToRoom.delete(socket.id);
    socketToUsername.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SwiftChat server running on port ${PORT}`);
});