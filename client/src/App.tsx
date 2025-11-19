/**
 * メインアプリケーションコンポーネント
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { GameProvider } from './contexts/GameContext';
import { Lobby } from './components/Lobby';
import { Room } from './components/Room';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <GameProvider>
          <Routes>
            <Route path="/" element={<Lobby />} />
            <Route path="/room/:roomId" element={<Room />} />
          </Routes>
        </GameProvider>
      </SocketProvider>
    </BrowserRouter>
  );
}

export default App;
