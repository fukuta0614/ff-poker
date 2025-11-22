/**
 * REST API ルーティング
 */

import { Router, Request, Response } from 'express';
import { GameManager } from '../game/GameManager';

export const createRoutes = (gameManager: GameManager): Router => {
  const router = Router();

  // ルーム作成
  router.post('/create-room', (req: Request, res: Response) => {
    try {
      const { hostName, smallBlind, bigBlind } = req.body;

      if (!hostName || !smallBlind || !bigBlind) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const { room, host } = gameManager.createRoom(hostName, smallBlind, bigBlind);

      res.json({
        roomId: room.id,
        hostId: host.id,
      });
    } catch (error) {
      console.error('Error creating room:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ルーム情報取得
  router.get('/room/:id', (req: Request, res: Response) => {
    try {
      const room = gameManager.getRoom(req.params.id);

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      res.json({
        roomId: room.id,
        playerCount: room.players.length,
        state: room.state,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
      });
    } catch (error) {
      console.error('Error fetching room:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ルーム一覧取得
  router.get('/rooms', (_req: Request, res: Response) => {
    try {
      const rooms = gameManager.listRooms();
      res.json({ rooms });
    } catch (error) {
      console.error('Error listing rooms:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
