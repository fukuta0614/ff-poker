/**
 * FF Poker Room Component
 * ゲームテーブル表示（OpenAPI型準拠、パフォーマンス最適化版）
 */

import { useMemo } from 'react';
import { useGame } from '../contexts/GameContext';
import { ActionButtons } from './ActionButtons';

export function Room() {
  const { room, roomId, playerId, gameState, startGame, isLoading } = useGame();

  // ルーム情報がない場合はローディング表示
  if (!room || !roomId || !playerId) {
    return <div>Loading room...</div>;
  }

  // 自分のプレイヤー情報を取得（メモ化）
  const currentPlayer = useMemo(
    () => room.players.find((p) => p.id === playerId),
    [room.players, playerId]
  );

  const isHost = room.hostId === playerId;

  // 自分の手札を取得（メモ化）
  const myHand = useMemo(
    () => gameState?.players.find((p) => p.id === playerId)?.hand,
    [gameState?.players, playerId]
  );

  const handleStartGame = async () => {
    try {
      await startGame();
    } catch (err) {
      console.error('Failed to start game:', err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1>Room: {roomId}</h1>
          <p style={{ color: '#666', margin: '5px 0' }}>
            Status: <strong>{room.state}</strong> | Players: {room.players.length}
          </p>
        </div>
        {currentPlayer && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '5px 0' }}>
              <strong>{currentPlayer.name}</strong> (You)
            </p>
            <p style={{ margin: '5px 0', fontSize: '18px' }}>
              Chips: <strong>{currentPlayer.chips}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Waiting Room */}
      {room.state === 'waiting' && (
        <div
          style={{
            padding: '30px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <h2>Waiting for Players...</h2>
          <p>
            Blinds: {room.smallBlind}/{room.bigBlind}
          </p>
          {isHost && (
            <>
              <button
                onClick={handleStartGame}
                disabled={isLoading || room.players.length < 2}
                style={{
                  marginTop: '20px',
                  padding: '12px 30px',
                  backgroundColor:
                    room.players.length < 2 ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor:
                    room.players.length < 2 ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Starting...' : 'Start Game'}
              </button>
              {room.players.length < 2 && (
                <p style={{ marginTop: '10px', color: '#999' }}>
                  Need at least 2 players to start
                </p>
              )}
            </>
          )}
          {!isHost && (
            <p style={{ marginTop: '10px', color: '#999' }}>
              Waiting for host to start the game...
            </p>
          )}
        </div>
      )}

      {/* Players List */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Players at the Table:</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '15px',
          }}
        >
          {room.players.map((player) => {
            const playerState = gameState?.players.find((p) => p.id === player.id);
            const isDealer =
              gameState && room.players[gameState.dealerIndex]?.id === player.id;
            const isCurrentBettor =
              gameState && room.players[gameState.currentBettorIndex]?.id === player.id;

            return (
              <div
                key={player.id}
                style={{
                  padding: '15px',
                  border: isCurrentBettor ? '3px solid #4CAF50' : '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: player.id === playerId ? '#e3f2fd' : 'white',
                  position: 'relative',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {isDealer && <span style={{ marginRight: '5px' }}>🎯</span>}
                  {player.name}
                  {player.id === playerId && ' (You)'}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Seat: {player.seat}
                </div>
                <div style={{ fontSize: '16px', marginTop: '5px' }}>
                  Chips: <strong>{playerState?.chips ?? player.chips}</strong>
                </div>
                {playerState && (
                  <>
                    {playerState.bet > 0 && (
                      <div
                        style={{
                          fontSize: '14px',
                          color: '#4CAF50',
                          marginTop: '5px',
                        }}
                      >
                        Bet: {playerState.bet}
                      </div>
                    )}
                    {playerState.isFolded && (
                      <div
                        style={{
                          fontSize: '14px',
                          color: '#f44336',
                          marginTop: '5px',
                        }}
                      >
                        FOLDED
                      </div>
                    )}
                    {playerState.chips === 0 && !playerState.isFolded && (
                      <div
                        style={{
                          fontSize: '14px',
                          color: '#ff9800',
                          marginTop: '5px',
                        }}
                      >
                        ALL-IN
                      </div>
                    )}
                  </>
                )}
                {isCurrentBettor && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                    }}
                  >
                    ▶
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Game State */}
      {gameState && room.state === 'in_progress' && (
        <>
          {/* Community Cards */}
          <div
            style={{
              padding: '30px',
              backgroundColor: '#2e7d32',
              borderRadius: '8px',
              marginBottom: '20px',
              color: 'white',
            }}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>
                Stage: <strong>{gameState.stage.toUpperCase()}</strong>
              </h3>
              <p style={{ margin: '5px 0', fontSize: '18px' }}>
                Pot: <strong>{gameState.totalPot}</strong> chips
              </p>
              <p style={{ margin: '5px 0' }}>
                Current Bet: <strong>{gameState.currentBet}</strong>
              </p>
            </div>

            <div>
              <h4 style={{ margin: '10px 0' }}>Community Cards:</h4>
              <div style={{ display: 'flex', gap: '10px', fontSize: '24px' }}>
                {gameState.communityCards.length > 0 ? (
                  gameState.communityCards.map((card, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 15px',
                        backgroundColor: 'white',
                        color: 'black',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                      }}
                    >
                      {card}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#ccc' }}>No cards yet</div>
                )}
              </div>
            </div>
          </div>

          {/* My Hand */}
          {myHand && myHand.length === 2 && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Your Hand:</h3>
              <div style={{ display: 'flex', gap: '10px', fontSize: '24px' }}>
                {myHand.map((card, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '15px 20px',
                      backgroundColor: '#1976d2',
                      color: 'white',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                    }}
                  >
                    {card}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acknowledgment Status */}
          {gameState.waitingForAck && gameState.ackState && (
            <div
              style={{
                padding: '15px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                marginBottom: '20px',
              }}
            >
              <p style={{ margin: 0, color: '#856404' }}>
                ⏳ Waiting for all players to acknowledge (
                {gameState.ackState.receivedAcks.length}/
                {gameState.ackState.expectedAcks.length})
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <ActionButtons />
        </>
      )}

      {/* Finished */}
      {room.state === 'ended' && (
        <div
          style={{
            padding: '30px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <h2>Game Finished</h2>
          <p>The game has ended.</p>
        </div>
      )}
    </div>
  );
}
