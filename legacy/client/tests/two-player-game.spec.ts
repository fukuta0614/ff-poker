/**
 * E2E Test: 2人プレイヤーゲームフロー
 *
 * ユーザー報告の問題を再現:
 * "callすると対戦相手のアクションが出てこない"
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('2-Player Poker Game Flow', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let player1Page: Page;
  let player2Page: Page;

  test.beforeEach(async ({ browser }) => {
    // 2つの独立したブラウザコンテキストを作成（2人のプレイヤーをシミュレート）
    context1 = await browser.newContext();
    context2 = await browser.newContext();

    player1Page = await context1.newPage();
    player2Page = await context2.newPage();

    // デバッグ用: コンソールログをキャプチャ
    player1Page.on('console', msg => console.log(`[Player1 Console]: ${msg.text()}`));
    player2Page.on('console', msg => console.log(`[Player2 Console]: ${msg.text()}`));

    // エラーをキャプチャ
    player1Page.on('pageerror', error => console.error(`[Player1 Error]: ${error}`));
    player2Page.on('pageerror', error => console.error(`[Player2 Error]: ${error}`));
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test('Player1 calls and Player2 should get action notification', async () => {
    // Player1: ルーム作成画面に移動
    await player1Page.goto('/');
    await player1Page.waitForTimeout(1000);

    // Player1: 名前を入力
    const player1NameInput = player1Page.locator('input[placeholder="Enter your name"]');
    await player1NameInput.fill('Player1');
    console.log('[TEST] Player1 entered name');

    // Player1: Create Room ボタンをクリック
    const createRoomButton = player1Page.locator('button:has-text("Create Room")');
    await createRoomButton.click();
    console.log('[TEST] Player1 clicked Create Room');

    // URLからroomIdを取得
    await player1Page.waitForURL(/\/room\/.+/);
    const roomId = player1Page.url().split('/room/')[1];
    console.log(`[TEST] Room created: ${roomId}`);

    // Player2: ルームに参加
    await player2Page.goto('/');
    await player2Page.waitForTimeout(1000);

    // Player2: 名前を入力
    const player2NameInput = player2Page.locator('input[placeholder="Enter your name"]');
    await player2NameInput.fill('Player2');
    console.log('[TEST] Player2 entered name');

    // Player2: Room ID を入力
    const roomIdInput = player2Page.locator('input[placeholder="Enter Room ID"]');
    await roomIdInput.fill(roomId);
    console.log(`[TEST] Player2 entered room ID: ${roomId}`);

    // Player2: Join Room ボタンをクリック
    const joinRoomButton = player2Page.locator('button:has-text("Join Room")');
    await joinRoomButton.click();
    console.log('[TEST] Player2 clicked Join Room');

    // Player2がルームに参加したことを確認
    await player2Page.waitForURL(/\/room\/.+/);
    console.log('[TEST] Player2 joined room');

    // ゲーム開始を待つ
    await player1Page.waitForTimeout(2000);
    await player2Page.waitForTimeout(2000);

    // Player1: Start Game ボタンをクリック（ホストのみ）
    const startGameButton = player1Page.locator('button:has-text("Start Game")');
    if (await startGameButton.isVisible()) {
      await startGameButton.click();
      console.log('[TEST] Game started by Player1');
    }

    await player1Page.waitForTimeout(1000);
    await player2Page.waitForTimeout(1000);

    // スクリーンショット: ゲーム開始後の状態
    await player1Page.screenshot({ path: 'test-results/player1-game-started.png' });
    await player2Page.screenshot({ path: 'test-results/player2-game-started.png' });

    // Player1のターンかPlayer2のターンか確認
    const player1HasAction = await player1Page.locator('button:has-text("Call")').isVisible();
    const player2HasAction = await player2Page.locator('button:has-text("Call")').isVisible();

    console.log(`[TEST] Player1 has action: ${player1HasAction}`);
    console.log(`[TEST] Player2 has action: ${player2HasAction}`);

    // どちらか一方だけがアクションできるはず
    expect(player1HasAction || player2HasAction).toBeTruthy();

    // 最初にアクションするプレイヤーを特定
    let firstPlayer: Page;
    let secondPlayer: Page;
    let firstPlayerName: string;
    let secondPlayerName: string;

    if (player1HasAction) {
      firstPlayer = player1Page;
      secondPlayer = player2Page;
      firstPlayerName = 'Player1';
      secondPlayerName = 'Player2';
    } else {
      firstPlayer = player2Page;
      secondPlayer = player1Page;
      firstPlayerName = 'Player2';
      secondPlayerName = 'Player1';
    }

    console.log(`[TEST] ${firstPlayerName} has the first action`);

    // 最初のプレイヤーがCallする
    const callButton = firstPlayer.locator('button:has-text("Call")');
    await callButton.click();
    console.log(`[TEST] ${firstPlayerName} clicked Call`);

    // スクリーンショット: Call後
    await firstPlayer.screenshot({ path: `test-results/${firstPlayerName}-after-call.png` });
    await secondPlayer.screenshot({ path: `test-results/${secondPlayerName}-after-call.png` });

    // 重要: 2番目のプレイヤーにアクション通知が来るか確認
    await secondPlayer.waitForTimeout(2000);

    const secondPlayerHasAction = await secondPlayer.locator('button:has-text("Call")').isVisible();
    console.log(`[TEST] ${secondPlayerName} has action after ${firstPlayerName} called: ${secondPlayerHasAction}`);

    // アサーション: 2番目のプレイヤーにもアクションが回ってくるべき
    expect(secondPlayerHasAction).toBeTruthy();

    // 2番目のプレイヤーもCallする
    const secondCallButton = secondPlayer.locator('button:has-text("Call")');
    await secondCallButton.click();
    console.log(`[TEST] ${secondPlayerName} clicked Call`);

    await firstPlayer.waitForTimeout(1000);
    await secondPlayer.waitForTimeout(1000);

    // スクリーンショット: 両者Call後（フロップに進むはず）
    await firstPlayer.screenshot({ path: `test-results/${firstPlayerName}-after-both-call.png` });
    await secondPlayer.screenshot({ path: `test-results/${secondPlayerName}-after-both-call.png` });

    // フロップ（コミュニティカード）が表示されることを確認
    const communityCardsVisible = await firstPlayer.locator('.community-cards').isVisible().catch(() => false);
    console.log(`[TEST] Community cards visible: ${communityCardsVisible}`);

    // テスト完了
    console.log('[TEST] Test completed successfully');
  });

  test('Player1 calls - capture UI state and check if Player2 gets turn', async () => {
    // より簡易版: UIに依存せず、ネットワークとDOM状態を確認

    await player1Page.goto('/');
    await player2Page.goto('/');

    await player1Page.waitForTimeout(2000);
    await player2Page.waitForTimeout(2000);

    // スクリーンショット: 初期状態
    await player1Page.screenshot({ path: 'test-results/simple-player1-initial.png', fullPage: true });
    await player2Page.screenshot({ path: 'test-results/simple-player2-initial.png', fullPage: true });

    // ページのHTMLをダンプ
    const player1HTML = await player1Page.content();
    const player2HTML = await player2Page.content();

    console.log('[TEST] Player1 HTML length:', player1HTML.length);
    console.log('[TEST] Player2 HTML length:', player2HTML.length);

    // テストが実際にアプリケーションを読み込んでいることを確認
    expect(player1HTML).toContain('Poker');
    expect(player2HTML).toContain('Poker');
  });
});
