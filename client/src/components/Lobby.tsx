/**
 * ロビー画面
 * ルーム作成・参加
 */

import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useGame } from '../contexts/GameContext';
import type { Player } from '../contexts/GameContext';
import { useNavigate } from 'react-router-dom';

export const Lobby: React.FC = () => {
  const { socket, connected } = useSocket();
  const { setRoomId, setPlayerId, setPlayers } = useGame();
  const navigate = useNavigate();

  const [playerName, setPlayerName] = useState(() => {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `player_${randomSuffix}`;
  });
  const [roomIdInput, setRoomIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = () => {
    if (!socket || !playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    socket.emit('createRoom', {
      hostName: playerName,
      smallBlind: 10,
      bigBlind: 20,
    });

    socket.once('roomCreated', (data: { roomId: string; playerId: string; playerName: string; seat: number; chips: number }) => {
      console.log('Room created:', data);
      setRoomId(data.roomId);
      setPlayerId(data.playerId); // hostIdではなくplayerIdを使用

      // ホストはすでにプレイヤーとして追加されているので、プレイヤーリストを更新
      setPlayers([{
        id: data.playerId,
        name: data.playerName,
        seat: data.seat,
        chips: data.chips,
      }]);

      setLoading(false);
      navigate(`/room/${data.roomId}`);
    });

    socket.once('error', (err: { message: string }) => {
      setError(err.message);
      setLoading(false);
    });
  };

  const handleJoinRoom = () => {
    if (!socket || !playerName.trim() || !roomIdInput.trim()) {
      setError('Please enter your name and room ID');
      return;
    }

    setLoading(true);
    setError('');

    socket.emit('joinRoom', {
      roomId: roomIdInput,
      playerName,
    });

    socket.once('joinedRoom', (data: { roomId: string; playerId: string; players: Player[] }) => {
      console.log('Joined room:', data);
      setRoomId(data.roomId);
      setPlayerId(data.playerId);
      setPlayers(data.players);
      setLoading(false);
      navigate(`/room/${data.roomId}`);
    });

    socket.once('error', (err: { message: string }) => {
      setError(err.message);
      setLoading(false);
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>FF Poker</h1>

      <div style={{ marginBottom: '20px' }}>
        <p>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '30px' }}>
        <h2>Your Name</h2>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Create New Room</h2>
        <button
          onClick={handleCreateRoom}
          disabled={!connected || loading || !playerName.trim()}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>
      </div>

      <div>
        <h2>Join Existing Room</h2>
        <input
          type="text"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          placeholder="Enter Room ID"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            marginBottom: '10px',
          }}
          disabled={loading}
        />
        <button
          onClick={handleJoinRoom}
          disabled={!connected || loading || !playerName.trim() || !roomIdInput.trim()}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            cursor: 'pointer',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </div>
  );
};
