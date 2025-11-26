/**
 * 再接続機能 - E2Eテスト
 *
 * Playwrightを使用したブラウザでの再接続シナリオテスト
 * 実際のユーザー操作をシミュレートして動作を確認
 */

import { test, expect } from '@playwright/test';

// テスト用のグレースピリオド設定
// 注意: サーバー側で TEST_GRACE_PERIOD=5000 に設定する必要がある
const TEST_GRACE_PERIOD = 5000; // 5秒

test.describe('再接続機能 - E2Eテスト', () => {
  test.beforeEach(async ({ page }) => {
    // 各テスト前に localStorage をクリア
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  // ヘルパー関数: ルーム作成
  async function createRoom(page: any, playerName: string) {
    await page.goto('/lobby');
    // 名前を入力（既にランダムな名前が入っているが、上書きする）
    await page.fill('input[placeholder*="name" i]', playerName);
    // "Create Room"ボタンをクリック
    await page.click('text=Create Room');
    // ルームページに遷移することを確認
    await expect(page).toHaveURL(/\/room\//, { timeout: 5000 });
  }

  test('E2E-01: ネットワーク切断からの再接続', async ({ page, context }) => {
    test.setTimeout(30000);

    // 1. ロビーでルーム作成
    await createRoom(page, 'TestPlayer1');

    // 2. ネットワークをオフラインに設定
    await context.setOffline(true);

    // 3. 「再接続中...」モーダルが表示されることを確認
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=再接続中')).toBeVisible({ timeout: 10000 });

    // 4. ローディングスピナーが存在することを確認（可視性ではなく存在チェック）
    await expect(modal.locator('[role="status"]')).toBeAttached({ timeout: 10000 });

    // 5. 3秒待機
    await page.waitForTimeout(3000);

    // 6. ネットワークをオンラインに戻す
    await context.setOffline(false);

    // 7. モーダルが消えることを確認
    await expect(page.locator('text=再接続中')).not.toBeVisible({ timeout: 10000 });

    // 8. ゲーム画面が表示されていることを確認
    await expect(page).toHaveURL(/\/room\//);
  });

  test('E2E-02: ブラウザリフレッシュ後の自動復帰', async ({ page }) => {
    test.setTimeout(30000);

    // 1. ロビーでルーム作成
    await createRoom(page, 'TestPlayer1');

    // 現在のURLを記録
    const roomUrl = page.url();

    // 2. localStorageに playerId と roomId が保存されているか確認
    const playerId = await page.evaluate(() => localStorage.getItem('playerId'));
    const roomId = await page.evaluate(() => localStorage.getItem('roomId'));

    expect(playerId).toBeTruthy();
    expect(roomId).toBeTruthy();

    // 3. ブラウザリフレッシュ
    await page.reload();

    // 4. 自動的にゲーム画面に復帰することを確認
    await expect(page).toHaveURL(roomUrl, { timeout: 10000 });

    // 5. localStorageが保持されていることを確認
    const playerIdAfter = await page.evaluate(() => localStorage.getItem('playerId'));
    const roomIdAfter = await page.evaluate(() => localStorage.getItem('roomId'));

    expect(playerIdAfter).toBe(playerId);
    expect(roomIdAfter).toBe(roomId);
  });

  test('E2E-03: グレースピリオド超過後のロビー遷移', async ({ page, context }) => {
    test.setTimeout(20000);
    test.skip(
      process.env.TEST_GRACE_PERIOD !== '5000',
      'このテストはサーバー側で TEST_GRACE_PERIOD=5000 が必要です'
    );

    // 1. ロビーでルーム作成
    await createRoom(page, 'TestPlayer1');

    // 2. ネットワークを切断
    await context.setOffline(true);

    // 3. 「再接続中...」モーダル表示確認
    await expect(page.locator('text=再接続中')).toBeVisible();

    // 4. グレースピリオド超過待機（6秒 > 5秒）
    await page.waitForTimeout(6000);

    // 5. ネットワーク復旧
    await context.setOffline(false);

    // 6. ロビーに遷移することを確認
    await expect(page).toHaveURL(/\/lobby/, { timeout: 10000 });

    // 7. localStorageがクリアされることを確認
    const playerId = await page.evaluate(() => localStorage.getItem('playerId'));
    const roomId = await page.evaluate(() => localStorage.getItem('roomId'));

    expect(playerId).toBeNull();
    expect(roomId).toBeNull();
  });

  test('E2E-04: 複数タブでの再接続競合', async ({ browser }) => {
    test.setTimeout(30000);

    // タブ1を開く
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    // タブ2を開く
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    try {
      // タブ1: ルーム作成
      await createRoom(page1, 'Player1');

      const roomId = await page1.evaluate(() => localStorage.getItem('roomId'));

      // タブ2: 同じユーザーが別タブで開く（同じlocalStorageを共有しない）
      // 注意: これは別ブラウザコンテキストなので、実際には別ユーザーとして動作
      await page2.goto('/lobby');

      // Socket接続が安定するまで少し待機
      await page1.waitForTimeout(1000);

      // 両方のタブのネットワークを切断
      await context1.setOffline(true);
      await context2.setOffline(true);

      // モーダル表示確認
      await expect(page1.locator('text=再接続中')).toBeVisible();

      // 少し待機してからネットワーク復旧
      await page1.waitForTimeout(2000);

      await context1.setOffline(false);
      await context2.setOffline(false);

      // タブ1が正常に復帰することを確認（タイムアウトを延長）
      await expect(page1.locator('text=再接続中')).not.toBeVisible({ timeout: 15000 });
    } finally {
      // クリーンアップ
      await context1.close();
      await context2.close();
    }
  });

  test('E2E-05: モーダルUI確認', async ({ page, context }) => {
    test.setTimeout(30000);

    // 1. ルーム作成
    await createRoom(page, 'TestPlayer1');

    // 2. ネットワーク切断
    await context.setOffline(true);

    // 3. モーダル表示待機
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 4. UI要素確認
    // 「再接続中...」テキストが表示される
    await expect(modal.locator('text=再接続中')).toBeVisible();

    // ローディングスピナーが存在することを確認（可視性ではなく存在チェック）
    await expect(modal.locator('[role="status"]')).toBeAttached({ timeout: 10000 });

    // キャンセルボタンが表示されない
    const buttons = await modal.locator('button').count();
    expect(buttons).toBe(0);

    // 5. スクリーンショット取得（視覚的確認用）
    await page.screenshot({ path: 'test-results/reconnection-modal.png' });

    // 6. ネットワーク復旧
    await context.setOffline(false);

    // 7. モーダルが閉じることを確認
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });
});
