import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import TextChat from './pages/TextChat';
import VideoChat from './pages/VideoChat';
import PrivateRoom from './pages/PrivateRoom';
import { SocketProvider } from './context/SocketContext';

function App() {
  return (
    <SocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/text" element={<TextChat />} />
            <Route path="/video" element={<VideoChat />} />
            <Route path="/room/:roomId" element={<PrivateRoom />} />
          </Routes>
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;