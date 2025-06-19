import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Video, Users } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/room/${code}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">SwiftChat</h1>
          <p className="text-lg text-gray-600">
            Connect instantly with people around the world
          </p>
        </div>

        {/* Main Action Cards */}
        <div className="grid gap-4 mb-8">
          {/* Random Text Chat */}
          <button
            onClick={() => navigate('/text')}
            className="w-full p-6 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition duration-200 text-left"
          >
            <div className="flex items-center space-x-4">
              <MessageCircle className="w-8 h-8 text-gray-700" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Random Text Chat</h3>
                <p className="text-gray-600">Start a conversation with a random stranger</p>
              </div>
            </div>
          </button>

          {/* Random Video Chat */}
          <button
            onClick={() => navigate('/video')}
            className="w-full p-6 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition duration-200 text-left"
          >
            <div className="flex items-center space-x-4">
              <Video className="w-8 h-8 text-gray-700" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Random Video Chat</h3>
                <p className="text-gray-600">Face-to-face conversations with random people</p>
              </div>
            </div>
          </button>

          {/* Private Room */}
          <button
            onClick={generateRoomCode}
            className="w-full p-6 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition duration-200 text-left"
          >
            <div className="flex items-center space-x-4">
              <Users className="w-8 h-8 text-gray-700" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Private Room</h3>
                <p className="text-gray-600">Create a private room and invite friends</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Landing;