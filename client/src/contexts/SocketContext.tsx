/**
 * Socket.io コンテキスト
 * アプリ全体でSocket.io接続を共有
 * 再接続機能を含む (Milestone B)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { ReconnectionModal } from '../components/ReconnectionModal';
import { useGame } from './GameContext';
import { SOCKET_CONFIG } from '../config/socket.config';
import type { GameStateData, SocketErrorData, ReconnectRequestData } from '../types/socket';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  isReconnecting: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  isReconnecting: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const navigate = useNavigate();
  const { setPlayers, setPot, setCommunityCards, setMyHand, setCurrentBettorId, setPlayerBets, setRoomId } = useGame();

  // タイムアウトIDを保持するref（クリーンアップ用）
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 再接続タイムアウトをクリアする関数
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const socketInstance = io(SOCKET_CONFIG.URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: SOCKET_CONFIG.RECONNECTION.ENABLED,
      reconnectionAttempts: SOCKET_CONFIG.RECONNECTION.MAX_ATTEMPTS,
      reconnectionDelay: SOCKET_CONFIG.RECONNECTION.DELAY,
      reconnectionDelayMax: SOCKET_CONFIG.RECONNECTION.DELAY_MAX,
      timeout: SOCKET_CONFIG.TIMEOUT.CONNECTION,
    });

    // 接続成功時の処理（初回 & 再接続）
    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setConnected(true);

      // localStorageから再接続情報を取得
      const savedPlayerId = localStorage.getItem('playerId');
      const savedRoomId = localStorage.getItem('roomId');

      // 再接続リクエストを送信（セッション情報がある場合のみ）
      if (savedPlayerId && savedRoomId) {
        console.log('Attempting reconnection with saved session:', { savedPlayerId, savedRoomId });

        const reconnectData: ReconnectRequestData = {
          playerId: savedPlayerId,
          roomId: savedRoomId,
        };
        socketInstance.emit('reconnectRequest', reconnectData);

        // 既存のタイムアウトをクリア
        clearReconnectTimeout();

        // 再接続タイムアウト: 設定時間以内にgameStateが来なければ失敗とみなす
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Reconnection timeout - clearing session and navigating to lobby');
          localStorage.removeItem('playerId');
          localStorage.removeItem('roomId');
          setIsReconnecting(false);
          navigate('/lobby');
        }, SOCKET_CONFIG.TIMEOUT.RECONNECT_REQUEST);
      }
    });

    // 切断時の処理
    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);

      // localStorageにセッション情報がある場合は再接続モーダルを表示
      const savedPlayerId = localStorage.getItem('playerId');
      const savedRoomId = localStorage.getItem('roomId');

      if (savedPlayerId && savedRoomId) {
        console.log('Disconnected with active session, showing reconnection modal');
        setIsReconnecting(true);
      }
    });

    // ゲーム状態の復元（再接続成功時）
    socketInstance.on('gameState', (data: GameStateData) => {
      console.log('Received gameState, restoring game...', data);

      // 再接続タイムアウトをクリア
      clearReconnectTimeout();

      // GameContextの状態を復元
      setRoomId(data.roomId);
      setPlayers(data.players);
      setCommunityCards(data.communityCards);
      setPot(data.pot);
      setCurrentBettorId(data.currentBettorId || '');
      setPlayerBets(data.playerBets);
      if (data.hand) {
        setMyHand(data.hand);
      }

      // 再接続成功: モーダルを閉じる
      setIsReconnecting(false);
    });

    // エラーハンドリング（再接続失敗など）
    socketInstance.on('error', (error: SocketErrorData) => {
      console.error('Socket error:', error);

      // RECONNECT_FAILED エラーの場合
      if (error.code === 'RECONNECT_FAILED') {
        console.log('Reconnection failed, clearing session and navigating to lobby');

        // タイムアウトをクリア
        clearReconnectTimeout();

        // localStorageをクリア
        localStorage.removeItem('playerId');
        localStorage.removeItem('roomId');

        // 再接続モーダルを閉じる
        setIsReconnecting(false);

        // ロビーに遷移
        navigate('/lobby');
      }
    });

    setSocket(socketInstance);

    // クリーンアップ処理
    return () => {
      // タイムアウトをクリア
      clearReconnectTimeout();

      // Socket接続を閉じる（イベントリスナーも自動的に削除される）
      socketInstance.close();
    };
    // GameContext settersは安定した関数だが、依存配列に含めるとeffectが再実行される
    // clearReconnectTimeoutはuseCallbackで安定しているため、含めても安全
    // navigate以外のGameContext settersを意図的に省略
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, clearReconnectTimeout]);

  return (
    <SocketContext.Provider value={{ socket, connected, isReconnecting }}>
      <ReconnectionModal isOpen={isReconnecting} />
      {children}
    </SocketContext.Provider>
  );
};
