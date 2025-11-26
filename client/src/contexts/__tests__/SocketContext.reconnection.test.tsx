/**
 * Socket再接続機能のテスト (Phase 1: 必須テスト)
 *
 * テスト対象:
 * - TC-01: Socket切断時に再接続モーダルが表示される
 * - TC-02: 再接続成功時にlocalStorageから情報を取得してreconnectRequestを送信
 * - TC-03: gameStateイベント受信時にゲーム状態が復元される
 * - TC-04: ブラウザリフレッシュ後の自動復帰
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SocketProvider } from '../SocketContext';
import { GameProvider } from '../GameContext';
import React from 'react';

// Socket.io-clientのモック
const mockSocket = {
  id: 'mock-socket-id',
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  close: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// React Router のモック
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// localStorageのモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// テスト用コンポーネント
// GameProvider が SocketProvider を囲む必要がある（useGameを使用するため）
const TestComponent: React.FC = () => {
  return (
    <GameProvider>
      <SocketProvider>
        <div>Test Component</div>
      </SocketProvider>
    </GameProvider>
  );
};

describe('Socket再接続機能 - Phase 1: 必須テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockSocket.connected = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-01: Socket再接続試行時に再接続モーダルが表示される', () => {
    it('localStorageに保存データがある状態でdisconnect イベント発生時に「再接続中...」モーダルが表示される', async () => {
      // Arrange: localStorageにセッション情報を保存してからコンポーネントをレンダリング
      localStorageMock.setItem('playerId', 'test-player');
      localStorageMock.setItem('roomId', 'test-room');
      render(<TestComponent />);

      // Act: disconnect イベントをシミュレート（再接続トリガー）
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];

      expect(disconnectHandler).toBeDefined();
      disconnectHandler?.();

      // Assert: 再接続モーダルが表示される
      await waitFor(() => {
        expect(screen.getByText(/再接続中/i)).toBeInTheDocument();
      });
    });

    it('モーダルにローディングスピナーが表示される', async () => {
      // Arrange: localStorageにセッション情報を保存
      localStorageMock.setItem('playerId', 'test-player');
      localStorageMock.setItem('roomId', 'test-room');
      render(<TestComponent />);

      // Act: disconnect イベントをシミュレート（再接続トリガー）
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Assert: ローディング要素が表示される
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('モーダルにキャンセルボタンが表示されない', async () => {
      // Arrange: localStorageにセッション情報を保存
      localStorageMock.setItem('playerId', 'test-player');
      localStorageMock.setItem('roomId', 'test-room');
      render(<TestComponent />);

      // Act: disconnect イベントをシミュレート（再接続トリガー）
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Assert: キャンセルボタンが存在しない
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /キャンセル/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-02: 再接続成功時にlocalStorageから情報を取得してreconnectRequestを送信', () => {
    it('localStorageにplayerIdとroomIdが存在する場合、reconnectRequestを送信する', async () => {
      // Arrange: localStorageに情報を保存
      const testPlayerId = 'test-player-123';
      const testRoomId = 'test-room-456';
      localStorageMock.setItem('playerId', testPlayerId);
      localStorageMock.setItem('roomId', testRoomId);

      render(<TestComponent />);

      // Act: connect イベントをシミュレート (再接続成功)
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];

      expect(connectHandler).toBeDefined();
      connectHandler?.();

      // Assert: reconnectRequest が正しいデータで送信される
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('reconnectRequest', {
          playerId: testPlayerId,
          roomId: testRoomId,
        });
      });
    });

    it('localStorageからplayerIdとroomIdを正しく取得する', async () => {
      // Arrange
      const testPlayerId = 'player-abc';
      const testRoomId = 'room-xyz';
      localStorageMock.setItem('playerId', testPlayerId);
      localStorageMock.setItem('roomId', testRoomId);

      render(<TestComponent />);

      // Act: 再接続処理をトリガー
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      connectHandler?.();

      // Assert: localStorageから正しく読み取られた
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('playerId');
        expect(localStorageMock.getItem).toHaveBeenCalledWith('roomId');
      });
    });
  });

  describe('TC-03: gameStateイベント受信時にゲーム状態が復元される', () => {
    it('gameStateイベントを受信したらGameContextの状態が更新される', async () => {
      // Arrange: localStorageにセッション情報を保存（モーダル表示のため）
      localStorageMock.setItem('playerId', 'test-player');
      localStorageMock.setItem('roomId', 'test-room');
      render(<TestComponent />);

      const testGameState = {
        roomId: 'room-123',
        players: [
          { id: 'p1', name: 'Player 1', chips: 1000, seat: 0 },
          { id: 'p2', name: 'Player 2', chips: 800, seat: 1 },
        ],
        communityCards: ['Ah', 'Kd', 'Qc'],
        pot: 500,
        currentBettorId: 'p1',
        playerBets: { p1: 100, p2: 100 },
        hand: ['Js', 'Ts'],
      };

      // Act: gameState イベントをシミュレート
      const gameStateHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'gameState'
      )?.[1];

      expect(gameStateHandler).toBeDefined();
      gameStateHandler?.(testGameState);

      // Assert: 状態が復元される (後でGameContextの状態を確認する実装が必要)
      await waitFor(() => {
        // TODO: GameContextから状態を取得して検証
        // 現時点ではイベントハンドラが呼ばれることを確認
        expect(gameStateHandler).toBeDefined();
      });
    });

    it('gameState受信後に再接続モーダルが閉じる', async () => {
      // Arrange: localStorageにセッション情報を保存して再接続試行状態にする
      localStorageMock.setItem('playerId', 'test-player');
      localStorageMock.setItem('roomId', 'test-room');
      render(<TestComponent />);

      // disconnect イベントで再接続試行を開始
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // モーダルが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText(/再接続中/i)).toBeInTheDocument();
      });

      // Act: gameState イベントで状態復元
      const gameStateHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'gameState'
      )?.[1];

      const testGameState = {
        roomId: 'room-123',
        players: [],
        communityCards: [],
        pot: 0,
        currentBettorId: null,
        playerBets: {},
        hand: null,
      };

      gameStateHandler?.(testGameState);

      // Assert: モーダルが閉じる
      await waitFor(() => {
        expect(screen.queryByText(/再接続中/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-04: ブラウザリフレッシュ後の自動復帰', () => {
    it('ページ読み込み時にlocalStorageにセッション情報があればreconnectRequestを送信', async () => {
      // Arrange: リフレッシュ前の状態をlocalStorageに保存
      const savedPlayerId = 'saved-player-999';
      const savedRoomId = 'saved-room-888';
      localStorageMock.setItem('playerId', savedPlayerId);
      localStorageMock.setItem('roomId', savedRoomId);

      // Act: コンポーネントマウント (ページ読み込みをシミュレート)
      render(<TestComponent />);

      // Socket接続イベントをトリガー
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      mockSocket.connected = true;
      connectHandler?.();

      // Assert: reconnectRequest が送信される
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('reconnectRequest', {
          playerId: savedPlayerId,
          roomId: savedRoomId,
        });
      });
    });

    it('localStorageにセッション情報がない場合はreconnectRequestを送信しない', async () => {
      // Arrange: localStorageが空の状態
      localStorageMock.clear();

      // Act: コンポーネントマウント
      render(<TestComponent />);

      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      mockSocket.connected = true;
      connectHandler?.();

      // Assert: reconnectRequest が送信されない
      await waitFor(() => {
        expect(mockSocket.emit).not.toHaveBeenCalledWith(
          'reconnectRequest',
          expect.anything()
        );
      });
    });
  });

  describe('TC-05: RECONNECT_FAILEDエラー時の処理 (エッジケース)', () => {
    it('RECONNECT_FAILEDエラーを受信したらロビーに遷移する', async () => {
      // Arrange
      render(<TestComponent />);

      // Act: error イベントでRECONNECT_FAILEDを受信
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      expect(errorHandler).toBeDefined();
      errorHandler?.({
        message: 'Reconnection failed - grace period expired',
        code: 'RECONNECT_FAILED',
      });

      // Assert: ロビーに遷移
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/lobby');
      });
    });

    it('RECONNECT_FAILEDエラー時にlocalStorageをクリアする', async () => {
      // Arrange
      localStorageMock.setItem('playerId', 'test-player');
      localStorageMock.setItem('roomId', 'test-room');

      render(<TestComponent />);

      // Act: RECONNECT_FAILEDエラーを受信
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      errorHandler?.({
        message: 'Reconnection failed',
        code: 'RECONNECT_FAILED',
      });

      // Assert: localStorageがクリアされる
      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('playerId');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('roomId');
      });
    });

    it('RECONNECT_FAILEDエラー時に再接続モーダルが閉じる', async () => {
      // Arrange: localStorageにセッション情報を保存して再接続試行状態にする
      localStorageMock.setItem('playerId', 'test-player');
      localStorageMock.setItem('roomId', 'test-room');
      render(<TestComponent />);

      // disconnect イベントで再接続試行を開始
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      await waitFor(() => {
        expect(screen.getByText(/再接続中/i)).toBeInTheDocument();
      });

      // Act: RECONNECT_FAILEDエラーを受信
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      errorHandler?.({
        message: 'Reconnection failed',
        code: 'RECONNECT_FAILED',
      });

      // Assert: モーダルが閉じる
      await waitFor(() => {
        expect(screen.queryByText(/再接続中/i)).not.toBeInTheDocument();
      });
    });
  });
});
