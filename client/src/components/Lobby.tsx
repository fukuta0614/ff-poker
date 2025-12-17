/**
 * FF Poker Lobby Component
 * ルーム作成・参加UI
 */

import { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { apiClient } from '../services/api';

export function Lobby() {
  const { createRoom, joinRoom, isLoading, error } = useGame();

  // Room creation state
  const [hostName, setHostName] = useState('');
  const [smallBlind, setSmallBlind] = useState('10');
  const [bigBlind, setBigBlind] = useState('20');

  // Room joining state
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');

  // Room list state
  const [rooms, setRooms] = useState<Array<{
    id: string;
    playerCount: number;
    state: string;
    smallBlind: number;
    bigBlind: number;
  }>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      return;
    }
    try {
      await createRoom(hostName.trim(), Number(smallBlind), Number(bigBlind));
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !playerName.trim()) {
      return;
    }
    try {
      await joinRoom(roomId.trim(), playerName.trim());
    } catch (err) {
      console.error('Failed to join room:', err);
    }
  };

  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      const data = await apiClient.listRooms();
      setRooms(data.rooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleJoinFromList = (selectedRoomId: string) => {
    setRoomId(selectedRoomId);
  };

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 5000); // 5秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>FF Poker Lobby2</h1>

      {error && (
        <div
          style={{
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00',
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Room List Section */}
      {rooms.length > 0 && (
        <div style={{ marginTop: '30px', marginBottom: '30px' }}>
          <h2>Available Rooms</h2>
          {loadingRooms && <p>Loading rooms...</p>}
          <div style={{ display: 'grid', gap: '10px' }}>
            {rooms.map((room) => (
              <div
                key={room.id}
                style={{
                  padding: '15px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: room.state === 'waiting' ? '#f9f9f9' : '#eee',
                }}
              >
                <div>
                  <strong style={{ fontSize: '18px' }}>Room {room.id}</strong>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                    Players: {room.playerCount} | Blinds: {room.smallBlind}/{room.bigBlind} | Status: {room.state}
                  </div>
                </div>
                <button
                  onClick={() => handleJoinFromList(room.id)}
                  disabled={room.state !== 'waiting'}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: room.state === 'waiting' ? '#2196F3' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: room.state === 'waiting' ? 'pointer' : 'not-allowed',
                  }}
                >
                  {room.state === 'waiting' ? 'Select' : 'In Progress'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '40px', marginTop: '30px' }}>
        {/* Create Room Section */}
        <div style={{ flex: 1 }}>
          <h2>Create New Room</h2>
          <form
            onSubmit={handleCreateRoom}
            style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Your Name:
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Enter your name"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Small Blind:
              </label>
              <input
                type="number"
                value={smallBlind}
                onChange={(e) => setSmallBlind(e.target.value)}
                min="1"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Big Blind:
              </label>
              <input
                type="number"
                value={bigBlind}
                onChange={(e) => setBigBlind(e.target.value)}
                min="1"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !hostName.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor:
                  isLoading || !hostName.trim() ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor:
                  isLoading || !hostName.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        </div>

        {/* Join Room Section */}
        <div style={{ flex: 1 }}>
          <h2>Join Existing Room</h2>
          <form
            onSubmit={handleJoinRoom}
            style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Room ID:
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Your Name:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !roomId.trim() || !playerName.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor:
                  isLoading || !roomId.trim() || !playerName.trim()
                    ? '#ccc'
                    : '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor:
                  isLoading || !roomId.trim() || !playerName.trim()
                    ? 'not-allowed'
                    : 'pointer',
                marginTop: '43px', // Align with create button
              }}
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
