/**
 * ゲーム状態管理コンテキスト
 */

import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Player {
  id: string;
  name: string;
  chips: number;
  seat: number;
}

export interface GameState {
  roomId: string | null;
  playerId: string | null;
  players: Player[];
  dealerIndex: number;
  currentBettorId: string | null;
  pot: number;
  communityCards: string[];
  myHand: [string, string] | null;
  roundStage: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
}

interface GameContextType {
  gameState: GameState;
  setRoomId: (roomId: string) => void;
  setPlayerId: (playerId: string) => void;
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  setDealerIndex: (index: number) => void;
  setCurrentBettorId: (id: string) => void;
  setPot: (pot: number) => void;
  setCommunityCards: (cards: string[]) => void;
  setMyHand: (hand: [string, string]) => void;
  setRoundStage: (stage: GameState['roundStage']) => void;
  resetGame: () => void;
}

const initialGameState: GameState = {
  roomId: null,
  playerId: null,
  players: [],
  dealerIndex: 0,
  currentBettorId: null,
  pot: 0,
  communityCards: [],
  myHand: null,
  roundStage: 'waiting',
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  const setRoomId = (roomId: string) => {
    setGameState((prev) => ({ ...prev, roomId }));
  };

  const setPlayerId = (playerId: string) => {
    setGameState((prev) => ({ ...prev, playerId }));
  };

  const setPlayers = (players: Player[] | ((prev: Player[]) => Player[])) => {
    if (typeof players === 'function') {
      setGameState((prev) => ({ ...prev, players: players(prev.players) }));
    } else {
      setGameState((prev) => ({ ...prev, players }));
    }
  };

  const setDealerIndex = (index: number) => {
    setGameState((prev) => ({ ...prev, dealerIndex: index }));
  };

  const setCurrentBettorId = (id: string) => {
    setGameState((prev) => ({ ...prev, currentBettorId: id }));
  };

  const setPot = (pot: number) => {
    setGameState((prev) => ({ ...prev, pot }));
  };

  const setCommunityCards = (cards: string[]) => {
    setGameState((prev) => ({ ...prev, communityCards: cards }));
  };

  const setMyHand = (hand: [string, string]) => {
    setGameState((prev) => ({ ...prev, myHand: hand }));
  };

  const setRoundStage = (stage: GameState['roundStage']) => {
    setGameState((prev) => ({ ...prev, roundStage: stage }));
  };

  const resetGame = () => {
    setGameState(initialGameState);
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        setRoomId,
        setPlayerId,
        setPlayers,
        setDealerIndex,
        setCurrentBettorId,
        setPot,
        setCommunityCards,
        setMyHand,
        setRoundStage,
        resetGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
