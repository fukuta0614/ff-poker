/**
 * FF Poker Game Context
 * ゲーム状態管理とAcknowledgment処理
 *
 * 設計原則:
 * 1. useCallbackでメモ化し、無限ループを回避
 * 2. 依存配列を正しく指定
 * 3. Acknowledgmentの自動送信
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  apiClient,
  type RoomResponse,
  type GameState,
  type ActionRequest,
} from '../services/api';
import { socketClient, type RoomUpdatedEvent } from '../services/socket';
import type { PlayerAction } from '../types/game';

// ============================================
// Context State Types
// ============================================

interface GameContextState {
  // Room情報
  roomId: string | null;
  room: RoomResponse | null;
  playerId: string | null;

  // ゲーム状態
  gameState: GameState | null;

  // 接続状態
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

type GameAction =
  | { type: 'SET_ROOM'; roomId: string; playerId: string }
  | { type: 'SET_ROOM_INFO'; room: RoomResponse }
  | { type: 'SET_GAME_STATE'; gameState: GameState }
  | { type: 'SET_CONNECTED'; isConnected: boolean }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

const initialState: GameContextState = {
  roomId: null,
  room: null,
  playerId: null,
  gameState: null,
  isConnected: false,
  isLoading: false,
  error: null,
};

// ============================================
// Reducer
// ============================================

function gameReducer(
  state: GameContextState,
  action: GameAction
): GameContextState {
  switch (action.type) {
    case 'SET_ROOM':
      return { ...state, roomId: action.roomId, playerId: action.playerId };

    case 'SET_ROOM_INFO':
      return { ...state, room: action.room };

    case 'SET_GAME_STATE':
      return { ...state, gameState: action.gameState };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.isConnected };

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface GameContextValue extends GameContextState {
  createRoom: (
    hostName: string,
    smallBlind: number,
    bigBlind: number
  ) => Promise<void>;
  joinRoom: (roomId: string, playerName: string) => Promise<void>;
  startGame: () => Promise<void>;
  executeAction: (action: PlayerAction) => Promise<void>;
  fetchGameState: () => Promise<void>;
  resetGame: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

// ============================================
// Provider
// ============================================

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // ============================================
  // WebSocket接続管理
  // ============================================

  useEffect(() => {
    const socket = socketClient.connect();

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', isConnected: true });
    });

    socket.on('disconnect', () => {
      dispatch({ type: 'SET_CONNECTED', isConnected: false });
    });

    return () => {
      socketClient.disconnect();
    };
  }, []);

  // ============================================
  // メモ化された関数（重要: 無限ループ回避）
  // ============================================

  /**
   * ゲーム状態取得
   * useCallbackでメモ化し、roomIdとplayerIdが変わった時のみ再生成
   */
  const fetchGameState = useCallback(async () => {
    if (!state.roomId || !state.playerId) {
      return;
    }

    try {
      const result = await apiClient.getGameState(state.roomId, state.playerId);
      dispatch({ type: 'SET_GAME_STATE', gameState: result.gameState });
    } catch (error) {
      console.error('❌ Failed to fetch game state:', error);
    }
  }, [state.roomId, state.playerId]);

  /**
   * アクション実行
   * useCallbackでメモ化
   */
  const executeAction = useCallback(
    async (action: PlayerAction) => {
      if (!state.roomId || !state.playerId) {
        throw new Error('Room ID or Player ID is not set');
      }

      try {
        const actionRequest: ActionRequest = {
          playerId: state.playerId,
          action: {
            type: action.type,
            amount: action.amount,
          },
        };

        const result = await apiClient.executeAction(
          state.roomId,
          actionRequest
        );

        // アクション実行後、即座に最新状態を反映
        dispatch({ type: 'SET_GAME_STATE', gameState: result.gameState });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to execute action';
        dispatch({ type: 'SET_ERROR', error: message });
        throw error;
      }
    },
    [state.roomId, state.playerId]
  );

  // ============================================
  // room:updated イベントリスナー
  // ============================================

  useEffect(() => {
    if (!state.roomId || !state.playerId) return;

    const unsubscribe = socketClient.onRoomUpdated(
      async (event: RoomUpdatedEvent) => {
        console.log('🔔 room:updated:', event.updateType);

        // ルーム情報を再取得
        try {
          const room = await apiClient.getRoom(state.roomId!);
          dispatch({ type: 'SET_ROOM_INFO', room });

          // ゲームが進行中の場合のみ、ゲーム状態を取得
          if (room.state === 'in_progress') {
            await fetchGameState();
          }
        } catch (error) {
          console.error('❌ Failed to fetch room info:', error);
        }
      }
    );

    return unsubscribe;
  }, [state.roomId, state.playerId, fetchGameState]);

  // ============================================
  // 自動Acknowledgment送信
  // ============================================

  useEffect(() => {
    if (!state.gameState || !state.playerId) return;

    const { waitingForAck, ackState } = state.gameState;

    // waitingForAck=true かつ自分がackすべき場合
    if (
      waitingForAck &&
      ackState &&
      ackState.expectedAcks.includes(state.playerId) &&
      !ackState.receivedAcks.includes(state.playerId)
    ) {
      console.log('📤 Sending acknowledgment...');
      executeAction({
        type: 'acknowledge',
      }).catch((error) => {
        console.error('❌ Failed to send acknowledgment:', error);
      });
    }
  }, [state.gameState, state.playerId, executeAction]);

  // ============================================
  // API関数
  // ============================================

  /**
   * ルーム作成
   */
  const createRoom = useCallback(
    async (hostName: string, smallBlind: number, bigBlind: number) => {
      try {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        dispatch({ type: 'CLEAR_ERROR' });

        const result = await apiClient.createRoom({
          hostName,
          smallBlind,
          bigBlind,
        });
        console.log('✅ Room created:', result);

        dispatch({
          type: 'SET_ROOM',
          roomId: result.roomId,
          playerId: result.hostId,
        });

        // WebSocketでルームに参加
        socketClient.joinRoom(result.roomId, result.hostId);

        // ルーム情報取得
        const room = await apiClient.getRoom(result.roomId);
        console.log('✅ Room info fetched:', room);
        dispatch({ type: 'SET_ROOM_INFO', room });

        dispatch({ type: 'SET_LOADING', isLoading: false });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create room';
        dispatch({ type: 'SET_ERROR', error: message });
        throw error;
      }
    },
    []
  );

  /**
   * ルーム参加
   */
  const joinRoom = useCallback(async (roomId: string, playerName: string) => {
    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const result = await apiClient.joinRoom(roomId, { playerName });
      console.log('✅ Room joined:', result);

      dispatch({ type: 'SET_ROOM', roomId, playerId: result.playerId });

      // WebSocketでルームに参加
      socketClient.joinRoom(roomId, result.playerId);

      // ルーム情報取得
      const room = await apiClient.getRoom(roomId);
      dispatch({ type: 'SET_ROOM_INFO', room });

      dispatch({ type: 'SET_LOADING', isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to join room';
      dispatch({ type: 'SET_ERROR', error: message });
      throw error;
    }
  }, []);

  /**
   * ゲーム開始
   */
  const startGame = useCallback(async () => {
    if (!state.roomId) {
      throw new Error('Room ID is not set');
    }

    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const result = await apiClient.startGame(state.roomId);
      dispatch({ type: 'SET_GAME_STATE', gameState: result.gameState });

      dispatch({ type: 'SET_LOADING', isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start game';
      dispatch({ type: 'SET_ERROR', error: message });
      throw error;
    }
  }, [state.roomId]);

  /**
   * ゲームリセット
   */
  const resetGame = useCallback(() => {
    if (state.roomId && state.playerId) {
      socketClient.leaveRoom(state.roomId, state.playerId);
    }
    dispatch({ type: 'RESET' });
  }, [state.roomId, state.playerId]);

  // ============================================
  // Context Value
  // ============================================

  const value: GameContextValue = {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    executeAction,
    fetchGameState,
    resetGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
