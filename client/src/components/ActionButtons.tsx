/**
 * FF Poker Action Buttons Component
 * プレイヤーアクションボタン
 */

import { useState, useMemo } from 'react';
import { useGame } from '../contexts/GameContext';
import type { PlayerAction } from '../types/game';

export function ActionButtons() {
  const { gameState, playerId, executeAction } = useGame();
  const [raiseAmount, setRaiseAmount] = useState('');

  // 自分のプレイヤー状態を取得（メモ化）
  const playerState = useMemo(
    () => gameState?.players.find((p) => p.id === playerId),
    [gameState?.players, playerId]
  );

  // 自分のターンかどうか（メモ化）
  const isMyTurn = useMemo(
    () => gameState?.players[gameState.currentBettorIndex]?.id === playerId,
    [gameState?.players, gameState?.currentBettorIndex, playerId]
  );

  // ベット情報の計算（メモ化）
  const betInfo = useMemo(() => {
    if (!gameState || !playerState) {
      return null;
    }

    // 現在のストリートでのコール額を計算（betは各ストリートでリセットされる）
    const callAmount = gameState.currentBet - playerState.bet;
    const playerChips = playerState.chips;
    const canCheck = callAmount === 0;
    const canCall = callAmount > 0 && callAmount <= playerChips;
    const canRaise = playerChips > callAmount;
    const canAllIn = playerChips > 0;

    return {
      callAmount,
      playerChips,
      canCheck,
      canCall,
      canRaise,
      canAllIn,
    };
  }, [gameState, playerState]);

  // ゲーム状態またはプレイヤーIDがない場合は表示しない
  if (!gameState || !playerId) {
    return null;
  }

  if (!playerState) {
    return null;
  }

  // Acknowledgment待ちの場合は表示しない
  if (gameState.waitingForAck) {
    return null;
  }

  // 自分のターンでない場合
  if (!isMyTurn) {
    return (
      <div
        style={{
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, color: '#666' }}>Waiting for other players...</p>
      </div>
    );
  }

  // フォールドまたはオールインの場合は表示しない
  if (playerState.isFolded || playerState.chips === 0) {
    return null;
  }

  if (!betInfo) {
    return null;
  }

  // アクションハンドラー
  const handleAction = async (action: PlayerAction) => {
    try {
      await executeAction(action);
      if (action.type === 'raise') {
        setRaiseAmount('');
      }
    } catch (err) {
      console.error(`Failed to ${action.type}:`, err);
    }
  };

  const handleRaise = async () => {
    const amount = Number(raiseAmount);
    const minRaise = gameState.minRaiseAmount ?? 0;
    if (isNaN(amount) || amount < minRaise) {
      return;
    }
    await handleAction({ type: 'raise', amount });
  };

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        border: '2px solid #2196F3',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Your Turn - Choose Action:</h3>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        {/* Fold */}
        <button
          onClick={() => handleAction({ type: 'fold' })}
          style={{
            padding: '12px 24px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Fold
        </button>

        {/* Check */}
        {betInfo.canCheck && (
          <button
            onClick={() => handleAction({ type: 'check' })}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Check
          </button>
        )}

        {/* Call */}
        {betInfo.canCall && (
          <button
            onClick={() => handleAction({ type: 'call' })}
            style={{
              padding: '12px 24px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Call {betInfo.callAmount}
          </button>
        )}

        {/* Raise */}
        {betInfo.canRaise && (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input
              type="number"
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(e.target.value)}
              placeholder={`Min: ${gameState.minRaiseAmount ?? 0}`}
              min={gameState.minRaiseAmount ?? 0}
              max={betInfo.playerChips}
              style={{
                padding: '12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px',
                width: '150px',
              }}
            />
            <button
              onClick={handleRaise}
              disabled={
                !raiseAmount ||
                Number(raiseAmount) < (gameState.minRaiseAmount ?? 0)
              }
              style={{
                padding: '12px 24px',
                backgroundColor:
                  !raiseAmount ||
                  Number(raiseAmount) < (gameState.minRaiseAmount ?? 0)
                    ? '#ccc'
                    : '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor:
                  !raiseAmount ||
                  Number(raiseAmount) < (gameState.minRaiseAmount ?? 0)
                    ? 'not-allowed'
                    : 'pointer',
                fontWeight: 'bold',
              }}
            >
              Raise
            </button>
          </div>
        )}

        {/* All-in */}
        {betInfo.canAllIn && (
          <button
            onClick={() => handleAction({ type: 'allin' })}
            style={{
              padding: '12px 24px',
              backgroundColor: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            All-In ({betInfo.playerChips})
          </button>
        )}
      </div>

      <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
        <p style={{ margin: '5px 0' }}>
          Your chips: <strong>{betInfo.playerChips}</strong> | Current bet:{' '}
          <strong>{gameState.currentBet}</strong> | To call:{' '}
          <strong>{betInfo.callAmount}</strong>
        </p>
        {betInfo.canRaise && (
          <p style={{ margin: '5px 0' }}>
            Min raise: <strong>{gameState.minRaiseAmount ?? 0}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
