/**
 * Unit tests for Lobby component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Lobby } from '../../../src/components/Lobby';
import { GameProvider } from '../../../src/contexts/GameContext';
import { apiClient } from '../../../src/services/api';
import { socketClient } from '../../../src/services/socket';

vi.mock('../../../src/services/api');
vi.mock('../../../src/services/socket');

describe('Lobby', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (socketClient.connect as any).mockReturnValue(mockSocket);
    (socketClient.disconnect as any).mockImplementation(() => {});
    (socketClient.joinRoom as any).mockImplementation(() => {});
    (socketClient.onRoomUpdated as any).mockReturnValue(() => {});
  });

  it('should render create room and join room forms', () => {
    render(
      <GameProvider>
        <Lobby />
      </GameProvider>
    );

    expect(screen.getByText('Create New Room')).toBeInTheDocument();
    expect(screen.getByText('Join Existing Room')).toBeInTheDocument();
    const nameInputs = screen.getAllByPlaceholderText('Enter your name');
    expect(nameInputs).toHaveLength(2);
    expect(screen.getByPlaceholderText('Enter room ID')).toBeInTheDocument();
  });

  it('should create room when form is submitted', async () => {
    const mockRoomResponse = {
      roomId: 'room-123',
      hostId: 'player-456',
    };

    const mockRoom = {
      roomId: 'room-123',
      state: 'waiting' as const,
      players: [{ id: 'player-456', name: 'Alice', chips: 1000, isFolded: false }],
      smallBlind: 10,
      bigBlind: 20,
    };

    (apiClient.createRoom as any).mockResolvedValue(mockRoomResponse);
    (apiClient.getRoom as any).mockResolvedValue(mockRoom);

    render(
      <GameProvider>
        <Lobby />
      </GameProvider>
    );

    const nameInputs = screen.getAllByPlaceholderText('Enter your name');
    const createNameInput = nameInputs[0];
    const createButton = screen.getByText('Create Room');

    fireEvent.change(createNameInput, { target: { value: 'Alice' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(apiClient.createRoom).toHaveBeenCalledWith({
        hostName: 'Alice',
        smallBlind: 10,
        bigBlind: 20,
      });
    });
  });

  it('should join room when form is submitted', async () => {
    const mockJoinResponse = {
      playerId: 'player-789',
    };

    const mockRoom = {
      roomId: 'room-123',
      state: 'waiting' as const,
      players: [
        { id: 'player-456', name: 'Alice', chips: 1000, isFolded: false },
        { id: 'player-789', name: 'Bob', chips: 1000, isFolded: false },
      ],
      smallBlind: 10,
      bigBlind: 20,
    };

    (apiClient.joinRoom as any).mockResolvedValue(mockJoinResponse);
    (apiClient.getRoom as any).mockResolvedValue(mockRoom);

    render(
      <GameProvider>
        <Lobby />
      </GameProvider>
    );

    const roomIdInput = screen.getByPlaceholderText('Enter room ID');
    const nameInputs = screen.getAllByPlaceholderText('Enter your name');
    const joinNameInput = nameInputs[1];
    const joinButton = screen.getByText('Join Room');

    fireEvent.change(roomIdInput, { target: { value: 'room-123' } });
    fireEvent.change(joinNameInput, { target: { value: 'Bob' } });
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(apiClient.joinRoom).toHaveBeenCalledWith('room-123', {
        playerName: 'Bob',
      });
    });
  });

  it('should display error message', async () => {
    (apiClient.createRoom as any).mockRejectedValue(new Error('Room creation failed'));

    render(
      <GameProvider>
        <Lobby />
      </GameProvider>
    );

    const nameInputs = screen.getAllByPlaceholderText('Enter your name');
    const createNameInput = nameInputs[0];
    const createButton = screen.getByText('Create Room');

    fireEvent.change(createNameInput, { target: { value: 'Alice' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Room creation failed/)).toBeInTheDocument();
    });
  });

  it('should disable buttons during loading', async () => {
    const mockRoomResponse = {
      roomId: 'room-123',
      hostId: 'player-456',
    };

    (apiClient.createRoom as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockRoomResponse), 100))
    );

    render(
      <GameProvider>
        <Lobby />
      </GameProvider>
    );

    const nameInputs = screen.getAllByPlaceholderText('Enter your name');
    const createNameInput = nameInputs[0];
    const createButton = screen.getByText('Create Room');

    fireEvent.change(createNameInput, { target: { value: 'Alice' } });
    fireEvent.click(createButton);

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(createButton).toBeDisabled();
  });

  it('should not submit with empty name', () => {
    render(
      <GameProvider>
        <Lobby />
      </GameProvider>
    );

    const createButton = screen.getByText('Create Room');
    expect(createButton).toBeDisabled();
  });

  it('should trim input values', async () => {
    const mockRoomResponse = {
      roomId: 'room-123',
      hostId: 'player-456',
    };

    const mockRoom = {
      roomId: 'room-123',
      state: 'waiting' as const,
      players: [{ id: 'player-456', name: 'Alice', chips: 1000, isFolded: false }],
      smallBlind: 10,
      bigBlind: 20,
    };

    (apiClient.createRoom as any).mockResolvedValue(mockRoomResponse);
    (apiClient.getRoom as any).mockResolvedValue(mockRoom);

    render(
      <GameProvider>
        <Lobby />
      </GameProvider>
    );

    const nameInputs = screen.getAllByPlaceholderText('Enter your name');
    const createNameInput = nameInputs[0];
    const createButton = screen.getByText('Create Room');

    fireEvent.change(createNameInput, { target: { value: '  Alice  ' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(apiClient.createRoom).toHaveBeenCalledWith({
        hostName: 'Alice',
        smallBlind: 10,
        bigBlind: 20,
      });
    });
  });
});
