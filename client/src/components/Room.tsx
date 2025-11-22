/**
 * ゲームルーム画面
 * ゲームプレイとプレイヤー表示
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useGame } from '../contexts/GameContext';

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket } = useSocket();
  const {
    gameState,
    setPlayers,
    setDealerIndex,
    setCurrentBettorId,
    setPot,
    setCommunityCards,
    setMyHand,
    setRoundStage,
    setPlayerBets,
    setValidActions,
  } = useGame();

  const [canStart, setCanStart] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState('');

  useEffect(() => {
    if (!socket || !roomId) return;

    // ゲーム開始イベント
    socket.on('gameStarted', (data: {
      roomId: string;
      dealerIndex: number;
      players: Array<{ id: string; name: string; chips: number; seat: number }>;
    }) => {
      console.log('Game started:', data);
      setPlayers(data.players);
      setDealerIndex(data.dealerIndex);
      setRoundStage('preflop');
    });

    // 手札配布
    socket.on('dealHand', (data: { playerId: string; hand: [string, string] }) => {
      if (data.playerId === gameState.playerId) {
        setMyHand(data.hand);
      }
    });

    // ターン通知
    socket.on('turnNotification', (data: {
      playerId: string;
      currentBet: number;
      playerBets?: Record<string, number>;
      validActions?: Array<'fold' | 'check' | 'call' | 'raise' | 'allin'>;
    }) => {
      setCurrentBettorId(data.playerId);
      if (data.playerBets) {
        setPlayerBets(data.playerBets);
      }
      if (data.validActions) {
        setValidActions(data.validActions);
      }
    });

    // アクション実行通知
    socket.on('actionPerformed', (data: {
      playerId: string;
      action: string;
      amount?: number;
      pot: number;
      playerBets?: Record<string, number>;
    }) => {
      console.log('Action performed:', data);
      setPot(data.pot);
      if (data.playerBets) {
        setPlayerBets(data.playerBets);
      }
    });
    // 新しいストリート
    socket.on('newStreet', (data: {
      state: string;
      communityCards: string[];
    }) => {
      console.log('New street:', data);
      setCommunityCards(data.communityCards);
      setRoundStage(data.state as any);
    });

    // ショーダウン
    socket.on('showdown', (data: {
      players: Array<{ id: string; chips: number; hand?: [string, string] }>;
    }) => {
      console.log('Showdown:', data);
      setRoundStage('showdown');
      // プレイヤー情報更新
      setPlayers((prev) =>
        prev.map((p) => {
          const updated = data.players.find((up) => up.id === p.id);
          return updated ? { ...p, chips: updated.chips } : p;
        })
      );
    });

    // プレイヤー参加通知
    socket.on('playerJoined', (data: {
      playerId: string;
      playerName: string;
      seat: number;
      chips: number;
    }) => {
      console.log('Player joined:', data);
      setPlayers((prev) => [
        ...prev,
        {
          id: data.playerId,
          name: data.playerName,
          chips: data.chips,
          seat: data.seat,
        },
      ]);
    });

    return () => {
      socket.off('gameStarted');
      socket.off('dealHand');
      socket.off('turnNotification');
      socket.off('actionPerformed');
      socket.off('newStreet');
      socket.off('showdown');
      socket.off('playerJoined');
    };
  }, [socket, roomId, gameState.playerId]);

  useEffect(() => {
    // 2人以上でゲーム開始可能
    setCanStart(gameState.players.length >= 2 && gameState.roundStage === 'waiting');
  }, [gameState.players, gameState.roundStage]);

  const handleStartGame = () => {
    if (!socket || !roomId) return;
    socket.emit('startGame', { roomId });
  };

  const handleAction = (action: string, amount?: number) => {
    if (!socket || !roomId || !gameState.playerId) return;

    socket.emit('action', {
      playerId: gameState.playerId,
      action: {
        type: action,
        amount,
      },
    });

    setRaiseAmount('');
  };

  const isMyTurn = gameState.currentBettorId === gameState.playerId;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Room: {roomId}</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>Players ({gameState.players.length})</h2>
        {gameState.players.map((player) => {
          const playerBet = gameState.playerBets[player.id] || 0;
          return (
            <div
              key={player.id}
              style={{
                padding: '10px',
                marginBottom: '5px',
                backgroundColor: player.id === gameState.playerId ? '#e3f2fd' : '#f5f5f5',
                border: player.id === gameState.currentBettorId ? '2px solid green' : '1px solid #ddd',
                color: '#333',
              }}
            >
              <strong>{player.name}</strong> - Seat {player.seat} - Chips: {player.chips}
              {playerBet > 0 && ` | Bet: ${playerBet}`}
              {player.id === gameState.playerId && ' (You)'}
              {player.id === gameState.currentBettorId && ' 🎯'}
            </div>
          );
        })}
      </div>

      {gameState.roundStage === 'waiting' && canStart && (
        <button
          onClick={handleStartGame}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Start Game
        </button>
      )}

      {gameState.roundStage !== 'waiting' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2>Game Info</h2>
            <p>Stage: {gameState.roundStage}</p>
            <p>Pot: {gameState.pot}</p>
            <p>Dealer Index: {gameState.dealerIndex}</p>
          </div>

          {gameState.myHand && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Your Hand</h3>
              <div style={{ fontSize: '24px' }}>
                {gameState.myHand[0]} {gameState.myHand[1]}
              </div>
            </div>
          )}

          {gameState.communityCards.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Community Cards</h3>
              <div style={{ fontSize: '24px' }}>
                {gameState.communityCards.join(' ')}
              </div>
            </div>
          )}

          {isMyTurn && gameState.roundStage !== 'showdown' && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Your Turn</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {gameState.validActions.includes('fold') && (
                  <button
                    onClick={() => handleAction('fold')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Fold
                  </button>
                )}
                {gameState.validActions.includes('check') && (
                  <button
                    onClick={() => handleAction('check')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Check
                  </button>
                )}
                {gameState.validActions.includes('call') && (
                  <button
                    onClick={() => handleAction('call')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Call
                  </button>
                )}
                {gameState.validActions.includes('raise') && (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                      type="number"
                      value={raiseAmount}
                      onChange={(e) => setRaiseAmount(e.target.value)}
                      placeholder="Amount"
                      style={{ padding: '10px', width: '100px' }}
                    />
                    <button
                      onClick={() => handleAction('raise', parseInt(raiseAmount))}
                      disabled={!raiseAmount}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: raiseAmount ? 'pointer' : 'not-allowed',
                        opacity: raiseAmount ? 1 : 0.5,
                      }}
                    >
                      Raise
                    </button>
                  </div>
                )}
                {gameState.validActions.includes('allin') && (
                  <button
                    onClick={() => handleAction('allin')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#9C27B0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    All-In
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
