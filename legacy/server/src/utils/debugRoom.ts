/**
 * デバッグ用のテストルーム自動作成
 * 開発環境でのみ有効
 */

import { GameManager } from '../game/GameManager';

export const setupDebugRoom = (gameManager: GameManager): void => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // 固定のテストルームを作成
  const TEST_ROOM_ID = 'test-room';
  
  try {
    // テストルームが既に存在する場合はスキップ
    const existingRoom = gameManager.getRoom(TEST_ROOM_ID);
    if (existingRoom) {
      console.log(`[DEBUG] Test room ${TEST_ROOM_ID} already exists`);
      return;
    }

    // テストルームを作成
    const room = gameManager.createRoom('TestPlayer1', 10, 20);
    // ルームIDを固定値に変更（内部的に）
    (room as any).id = TEST_ROOM_ID;
    
    console.log(`[DEBUG] Created test room: ${TEST_ROOM_ID}`);
    console.log(`[DEBUG] You can join this room with ID: ${TEST_ROOM_ID}`);
  } catch (error) {
    console.error('[DEBUG] Failed to create test room:', error);
  }
};
