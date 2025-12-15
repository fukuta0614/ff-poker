/**
 * Unit tests for ActionButtons component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ActionButtons } from '../../../src/components/ActionButtons';
import { GameProvider } from '../../../src/contexts/GameContext';
import { socketClient } from '../../../src/services/socket';
import type { GameState } from '../../../src/services/api';

vi.mock('../../../src/services/socket');

const mockUseGame = vi.fn();
vi.mock('../../../src/contexts/GameContext', async () => {
  const actual = await vi.importActual('../../../src/contexts/GameContext');
  return {
    ...actual,
    useGame: () => mockUseGame(),
  };
});

describe('ActionButtons', () => {
  const mockExecuteAction = vi.fn();

  const createMockGameState = (overrides?: Partial<GameState>): GameState => ({
    players: [
      {
        id: 'player-1',
        chips: 1000,
        bet: 0,
        cumulativeBet: 0,
        isFolded: false,
        hand: { cards: [] },
      },
      {
        id: 'player-2',
        chips: 1000,
        bet: 0,
        cumulativeBet: 0,
        isFolded: false,
        hand: { cards: [] },
      },
    ],
    pot: 30,
    communityCards: [],
    currentBet: 20,
    stage: 'preflop',
    currentBettorIndex: 0,
    waitingForAck: false,
    minRaiseAmount: 40,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteAction.mockResolvedValue(undefined);
  });

  it('should render nothing when gameState is null', () => {
    mockUseGame.mockReturnValue({
      gameState: null,
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    const { container } = render(<ActionButtons />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when playerId is null', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState(),
      playerId: null,
      executeAction: mockExecuteAction,
    });

    const { container } = render(<ActionButtons />);
    expect(container.firstChild).toBeNull();
  });

  it('should render waiting message when not player turn', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({ currentBettorIndex: 1 }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);
    expect(screen.getByText('Waiting for other players...')).toBeInTheDocument();
  });

  it('should render nothing when waiting for acknowledgment', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({ waitingForAck: true }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    const { container } = render(<ActionButtons />);
    expect(container.firstChild).toBeNull();
  });

  it('should render action buttons when it is player turn', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState(),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    expect(screen.getByText('Fold')).toBeInTheDocument();
    expect(screen.getByText(/Call/)).toBeInTheDocument();
    expect(screen.getByText('Raise')).toBeInTheDocument();
    expect(screen.getByText(/All-In/)).toBeInTheDocument();
  });

  it('should render check button when currentBet equals bet', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({
        currentBet: 20,
        players: [
          {
            id: 'player-1',
            chips: 980,
            bet: 20,
            cumulativeBet: 20,
            isFolded: false,
            hand: { cards: [] },
          },
        ],
      }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    expect(screen.getByText('Check')).toBeInTheDocument();
    expect(screen.queryByText(/Call/)).not.toBeInTheDocument();
  });

  it('should execute fold action', async () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState(),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    const foldButton = screen.getByText('Fold');
    fireEvent.click(foldButton);

    expect(mockExecuteAction).toHaveBeenCalledWith({ type: 'fold' });
  });

  it('should execute call action', async () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState(),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    const callButton = screen.getByText(/Call/);
    fireEvent.click(callButton);

    expect(mockExecuteAction).toHaveBeenCalledWith({ type: 'call' });
  });

  it('should execute check action', async () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({
        currentBet: 20,
        players: [
          {
            id: 'player-1',
            chips: 980,
            bet: 20,
            cumulativeBet: 20,
            isFolded: false,
            hand: { cards: [] },
          },
        ],
      }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    const checkButton = screen.getByText('Check');
    fireEvent.click(checkButton);

    expect(mockExecuteAction).toHaveBeenCalledWith({ type: 'check' });
  });

  it('should execute raise action with amount', async () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState(),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    const raiseInput = screen.getByPlaceholderText(/Min:/);
    const raiseButton = screen.getByText('Raise');

    fireEvent.change(raiseInput, { target: { value: '50' } });
    fireEvent.click(raiseButton);

    expect(mockExecuteAction).toHaveBeenCalledWith({ type: 'raise', amount: 50 });
  });

  it('should not execute raise action when amount is below minimum', async () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({ minRaiseAmount: 40 }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    const raiseInput = screen.getByPlaceholderText(/Min:/);
    const raiseButton = screen.getByText('Raise');

    fireEvent.change(raiseInput, { target: { value: '30' } });

    expect(raiseButton).toBeDisabled();
  });

  it('should execute all-in action', async () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState(),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    const allInButton = screen.getByText(/All-In/);
    fireEvent.click(allInButton);

    expect(mockExecuteAction).toHaveBeenCalledWith({ type: 'allin' });
  });

  it('should display correct player chips and bet info', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({
        currentBet: 50,
        players: [
          {
            id: 'player-1',
            chips: 900,
            bet: 30,
            cumulativeBet: 30,
            isFolded: false,
            hand: { cards: [] },
          },
        ],
      }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    expect(screen.getByText(/Your chips:/)).toHaveTextContent('900');
    expect(screen.getByText(/Current bet:/)).toHaveTextContent('50');
    expect(screen.getByText(/To call:/)).toHaveTextContent('20');
  });

  it('should clear raise amount after successful raise', async () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState(),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    render(<ActionButtons />);

    const raiseInput = screen.getByPlaceholderText(/Min:/) as HTMLInputElement;
    const raiseButton = screen.getByText('Raise');

    fireEvent.change(raiseInput, { target: { value: '50' } });
    expect(raiseInput.value).toBe('50');

    await act(async () => {
      fireEvent.click(raiseButton);
    });

    await waitFor(() => {
      expect(raiseInput.value).toBe('');
    });
  });

  it('should render nothing when player has folded', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({
        players: [
          {
            id: 'player-1',
            chips: 1000,
            cumulativeBet: 0,
            isFolded: true,
            hand: { cards: [] },
          },
        ],
      }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    const { container } = render(<ActionButtons />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when player has no chips', () => {
    mockUseGame.mockReturnValue({
      gameState: createMockGameState({
        players: [
          {
            id: 'player-1',
            chips: 0,
            cumulativeBet: 1000,
            isFolded: false,
            hand: { cards: [] },
          },
        ],
      }),
      playerId: 'player-1',
      executeAction: mockExecuteAction,
    });

    const { container } = render(<ActionButtons />);
    expect(container.firstChild).toBeNull();
  });
});
