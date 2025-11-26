# 再接続機能 - E2Eテスト計画

## 概要
ブラウザでの実際のユーザー操作をシミュレートし、再接続機能が正しく動作することを確認するE2Eテスト。

## テスト環境
- **E2Eフレームワーク**: Playwright
- **ブラウザ**: Chromium (デフォルト)
- **サーバー**: `npm run dev` で起動（localhost:3000）
- **クライアント**: `npm run dev` で起動（localhost:5173）

## テストケース

### E2E-01: ネットワーク切断からの再接続
**目的**: ユーザーがゲーム中にネットワークが切断され、再接続されるシナリオ

**前提条件**:
- サーバーとクライアントが起動している
- 2人のプレイヤーがゲームに参加している

**手順**:
1. ブラウザでロビーを開く
2. 「Create Room」をクリック
3. ルームに参加（プレイヤー1）
4. 別のブラウザコンテキストでプレイヤー2が参加
5. ゲーム開始
6. **プレイヤー1のネットワークをオフラインに設定** (`page.context().setOffline(true)`)
7. 「再接続中...」モーダルが表示されることを確認
8. 3秒待機
9. **ネットワークをオンラインに戻す** (`page.context().setOffline(false)`)
10. モーダルが消えることを確認
11. ゲーム画面が正しく復元されることを確認

**期待結果**:
- ✅ ネットワーク切断時に「再接続中...」モーダルが表示される
- ✅ モーダルにローディングスピナーが表示される
- ✅ ネットワーク復旧後、モーダルが自動的に閉じる
- ✅ プレイヤー情報、チップ数、コミュニティカードが保持される
- ✅ 自分の手札が復元される

**Playwrightコード例**:
```typescript
test('ネットワーク切断からの再接続', async ({ page, context }) => {
  // ゲームに参加
  await page.goto('http://localhost:5173/lobby');
  await page.click('text=Create Room');

  // ネットワーク切断
  await context.setOffline(true);

  // モーダル表示確認
  await expect(page.locator('text=再接続中')).toBeVisible();
  await expect(page.locator('[role="status"]')).toBeVisible();

  // ネットワーク復旧
  await page.waitForTimeout(3000);
  await context.setOffline(false);

  // モーダル消失確認
  await expect(page.locator('text=再接続中')).not.toBeVisible();

  // ゲーム状態確認
  await expect(page.locator('text=Your Chips')).toBeVisible();
});
```

---

### E2E-02: ブラウザリフレッシュ後の自動復帰
**目的**: ゲーム中にブラウザをリフレッシュしても、セッションが復元される

**手順**:
1. ロビーでルーム作成・参加
2. ゲーム開始（カードが配られる）
3. **ブラウザをリフレッシュ** (`page.reload()`)
4. ページ読み込み完了
5. 自動的にゲーム画面に復帰することを確認
6. プレイヤー情報、手札、ポットが復元されることを確認

**期待結果**:
- ✅ リフレッシュ後、自動的にゲーム画面に戻る
- ✅ localStorageから playerId/roomId が読み取られる
- ✅ reconnectRequest が自動送信される
- ✅ ゲーム状態が完全に復元される

**Playwrightコード例**:
```typescript
test('ブラウザリフレッシュ後の自動復帰', async ({ page }) => {
  // ゲーム参加
  await page.goto('http://localhost:5173/lobby');
  await page.click('text=Create Room');

  // ゲーム開始まで待機
  await expect(page.locator('text=Community Cards')).toBeVisible();

  // 現在のチップ数を記録
  const chipsBeforeReload = await page.locator('text=Chips:').textContent();

  // リフレッシュ
  await page.reload();

  // ゲーム画面に自動復帰
  await expect(page.locator('text=Community Cards')).toBeVisible({ timeout: 5000 });

  // チップ数が同じことを確認
  const chipsAfterReload = await page.locator('text=Chips:').textContent();
  expect(chipsAfterReload).toBe(chipsBeforeReload);
});
```

---

### E2E-03: グレースピリオド超過後のロビー遷移
**目的**: 120秒以上切断された場合、ロビーに強制遷移される

**注意**: このテストは120秒待機が必要なため、**テスト環境でグレースピリオドを短縮**する必要があります。

**環境変数設定**:
```bash
TEST_GRACE_PERIOD=5000  # 5秒に短縮
```

**手順**:
1. ゲームに参加
2. ネットワークを切断
3. 「再接続中...」モーダル表示確認
4. **6秒待機**（グレースピリオド超過）
5. ネットワーク復旧
6. モーダルが閉じる
7. ロビー画面に遷移することを確認
8. localStorageがクリアされることを確認

**期待結果**:
- ✅ グレースピリオド超過後、自動的にロビーに遷移
- ✅ localStorage から playerId, roomId が削除される
- ✅ エラーメッセージなし（静かに遷移）

**Playwrightコード例**:
```typescript
test('グレースピリオド超過後のロビー遷移', async ({ page, context }) => {
  // ゲーム参加
  await page.goto('http://localhost:5173/lobby');
  await page.click('text=Create Room');

  // ネットワーク切断
  await context.setOffline(true);
  await expect(page.locator('text=再接続中')).toBeVisible();

  // グレースピリオド超過待機 (テスト環境: 6秒)
  await page.waitForTimeout(6000);

  // ネットワーク復旧
  await context.setOffline(false);

  // ロビーに遷移
  await expect(page).toHaveURL(/\/lobby/, { timeout: 5000 });

  // localStorage クリア確認
  const playerId = await page.evaluate(() => localStorage.getItem('playerId'));
  const roomId = await page.evaluate(() => localStorage.getItem('roomId'));
  expect(playerId).toBeNull();
  expect(roomId).toBeNull();
});
```

---

### E2E-04: 複数タブでの再接続競合
**目的**: 同じユーザーが複数タブで開いた場合の挙動確認

**手順**:
1. タブ1でゲームに参加
2. **新しいタブ2を開き、同じルームに参加しようとする**
3. タブ1のネットワークを切断
4. タブ2も切断
5. タブ1を再接続
6. タブ2を再接続
7. 挙動を確認

**期待結果**:
- 仕様により挙動は未定義だが、最低限エラーにならないこと
- （推奨）最後に接続したタブのみが有効になる

---

### E2E-05: モーダルUI確認
**目的**: 再接続モーダルのUI要件を満たしているか確認

**手順**:
1. ゲーム参加
2. ネットワーク切断
3. モーダルのスクリーンショットを取得
4. UI要素を検証

**期待結果**:
- ✅ 「再接続中...」テキストが表示される
- ✅ ローディングスピナーが表示される（`role="status"`）
- ✅ キャンセルボタンが**表示されない**
- ✅ モーダル背景が半透明の黒 (`bg-opacity-50`)
- ✅ モーダルが画面中央に配置される

**Playwrightコード例**:
```typescript
test('再接続モーダルのUI確認', async ({ page, context }) => {
  await page.goto('http://localhost:5173/lobby');
  await page.click('text=Create Room');

  // ネットワーク切断
  await context.setOffline(true);

  // モーダル表示待機
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // UI要素確認
  await expect(modal.locator('text=再接続中')).toBeVisible();
  await expect(modal.locator('[role="status"]')).toBeVisible();
  await expect(modal.locator('button')).toHaveCount(0); // ボタンなし

  // スクリーンショット
  await page.screenshot({ path: 'reconnection-modal.png' });
});
```

---

## テスト実装ファイル
- `e2e/reconnection.spec.ts`

## 事前準備
1. サーバーとクライアントを起動するスクリプト作成
2. テスト環境用の環境変数設定 (`.env.test`)
3. Playwright設定でグレースピリオドを短縮

## 実行コマンド
```bash
# E2Eテスト実行
npm run test:e2e

# ヘッドレスモードで実行
npm run test:e2e:headless

# UI モードで実行（デバッグ用）
npm run test:e2e:ui
```

## 成功基準
- ✅ 全5テストケースが成功
- ✅ テスト実行時間 < 60秒
- ✅ スクリーンショット/動画で挙動を記録
