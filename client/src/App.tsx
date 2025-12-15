/**
 * FF Poker App
 * メインアプリケーションコンポーネント
 */

import { GameProvider, useGame } from './contexts/GameContext';
import { Lobby } from './components/Lobby';
import { Room } from './components/Room';

function AppContent() {
  const { roomId, room } = useGame();

  // Show Lobby if not in a room yet
  if (!roomId || !room) {
    return <Lobby />;
  }

  // Show Room component when joined
  return <Room />;
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
