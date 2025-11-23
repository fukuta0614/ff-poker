# テストガイド

FF Pokerプロジェクトでは、**3つのテストレベル**を組み合わせて品質を保証しています。

## テストの目的

| テストレベル | 目的 | スコープ | 実行速度 |
|------------|------|---------|---------|
| **ユニットテスト** | 個々の関数・クラスの正確性 | 1つのモジュール | ⚡ 高速（数秒） |
| **統合テスト** | コンポーネント間の連携 | 複数のモジュール | 🐢 中速（数十秒） |
| **E2Eテスト** | ユーザー視点での動作確認 | システム全体 | 🐌 低速（数分） |

---

## 1. ユニットテスト (Unit Test)

### 目的
**個々のクラス・関数が単体で正しく動作するか検証**

### 特徴
- **スコープ**: 1つの関数またはクラス
- **依存関係**: モック化して隔離
- **実行速度**: 非常に高速（1テスト数ミリ秒）
- **カバレッジ**: 80%以上を目標

### 対象コンポーネント

#### サーバー側（Jest）
```typescript
// 例: Deck.test.ts
describe('Deck', () => {
  test('should create 52 cards', () => {
    const deck = new Deck();
    expect(deck.cards).toHaveLength(52);
  });

  test('should shuffle cards', () => {
    const deck = new Deck();
    const originalOrder = [...deck.cards];
    deck.shuffle();
    expect(deck.cards).not.toEqual(originalOrder);
  });
});
```

**テスト対象**:
- `Deck.ts` - デッキ生成、シャッフル、カード配布
- `HandEvaluator.ts` - 役判定ロジック（全10役）
- `PotCalculator.ts` - ポット計算、サイドポット分割
- `Round.ts` - ステート遷移、ベッティングロジック
- `SessionManager.ts` - セッション管理（マイルストーンB）
- `TurnTimerManager.ts` - タイマー管理（マイルストーンB）
- `LoggerService.ts` - ロギング（マイルストーンB）

#### クライアント側（Vitest + React Testing Library）
```typescript
// 例: useSocket.test.ts
describe('useSocket', () => {
  test('should connect to server', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.connected).toBe(true);
  });
});
```

**テスト対象**:
- カスタムフック: `useSocket`, `useRoomState`, `useGameState`
- ユーティリティ関数: `card.ts`, `validation.ts`
- コンポーネントロジック: アクションボタンの活性化制御など

### 実行方法
```bash
# サーバー側
cd server
npm test

# クライアント側
cd client
npm test
```

### カバレッジ確認
```bash
# サーバー側
cd server
npm test -- --coverage

# 目標: 80%以上
```

---

## 2. 統合テスト (Integration Test)

### 目的
**複数のコンポーネントが連携して正しく動作するか検証**

### 特徴
- **スコープ**: 複数のモジュール（例: Socket.io + GameManager + Round）
- **依存関係**: 実際のコンポーネントを使用（一部モック可）
- **実行速度**: 中速（1テスト数秒〜数十秒）
- **環境**: 実際のHTTPサーバーとSocket.ioクライアントを起動

### 統合テストの範囲

```
┌─────────────────────────────────────────┐
│           統合テストの範囲                │
├─────────────────────────────────────────┤
│  Socket.io Client (Test)                │
│         ↕                                │
│  Socket.io Server                       │
│         ↕                                │
│  socketHandler.ts                       │
│         ↕                                │
│  GameManager → Round → Deck             │
│              → PotCalculator            │
│              → HandEvaluator            │
│              → SessionManager (B)       │
│              → TurnTimerManager (B)     │
└─────────────────────────────────────────┘
```

### テストシナリオ例

#### マイルストーンA: ゲームフロー
```typescript
// tests/integration/game-flow.test.ts
test('2プレイヤーでプリフロップベッティングが完了し、フロップに進む', (done) => {
  // 1. ルーム作成
  clientSocket1.emit('createRoom', { hostName: 'Player1', smallBlind: 10, bigBlind: 20 });

  // 2. プレイヤー2参加
  clientSocket2.emit('joinRoom', { roomId, playerName: 'Player2' });

  // 3. ゲーム開始
  clientSocket1.emit('startGame', { roomId });

  // 4. ベッティング
  clientSocket1.emit('action', { playerId: player1Id, action: { type: 'call' } });
  clientSocket2.emit('action', { playerId: player2Id, action: { type: 'check' } });

  // 5. フロップに進んだことを確認
  clientSocket1.on('newStreet', (data) => {
    expect(data.state).toBe('flop');
    expect(data.communityCards).toHaveLength(3);
    done();
  });
});
```

#### マイルストーンB: セッション管理・再接続
```typescript
// tests/integration/socketHandler.test.ts
test('should successfully reconnect within grace period', (done) => {
  // 1. ルーム作成＆参加
  clientSocket.emit('createRoom', { hostName: 'Player1', smallBlind: 10, bigBlind: 20 });

  clientSocket.on('roomCreated', (data) => {
    const { playerId, roomId } = data;

    // 2. 切断
    clientSocket.disconnect();

    // 3. グレースピリオド内に再接続
    setTimeout(() => {
      const reconnectSocket = ioClient(`http://localhost:${PORT}`);
      reconnectSocket.emit('reconnectRequest', { playerId, roomId });

      reconnectSocket.on('playerReconnected', () => {
        expect(true).toBe(true); // 再接続成功
        done();
      });
    }, 1000); // 1秒後（120秒以内）
  });
});
```

### 実行方法
```bash
cd server
npm test -- --testPathPattern=integration
```

### 実装状況
- ✅ `tests/integration/game-flow.test.ts` - ゲームフロー統合テスト（3テスト）
- ✅ `tests/integration/socketHandler.test.ts` - セッション管理・再接続テスト（6テスト）

---

## 3. E2Eテスト (End-to-End Test)

### 目的
**実際のユーザー操作をシミュレートし、システム全体が正しく動作するか検証**

### 特徴
- **スコープ**: システム全体（フロントエンド + バックエンド）
- **依存関係**: すべて実環境（モックなし）
- **実行速度**: 低速（1テスト数十秒〜数分）
- **ツール**: Playwright

### E2Eテストの範囲

```
┌─────────────────────────────────────────┐
│           E2Eテストの範囲                 │
├─────────────────────────────────────────┤
│  ブラウザA (Playwright)                  │
│         ↕                                │
│  React Client (UI)                      │
│         ↕                                │
│  Socket.io WebSocket                    │
│         ↕                                │
│  Node.js Server (Express + Socket.io)   │
│         ↕                                │
│  Game Logic (GameManager, Round, etc.)  │
└─────────────────────────────────────────┘
```

### テストシナリオ例

```typescript
// client/tests/two-player-game.spec.ts
test('2人プレイヤーでゲームを最後までプレイできる', async ({ page, context }) => {
  // ブラウザA: プレイヤー1
  await page.goto('http://localhost:5173');
  await page.fill('input[name="playerName"]', 'Player1');
  await page.click('button:has-text("Create Room")');

  // ルームIDを取得
  const roomId = await page.locator('[data-testid="room-id"]').textContent();

  // ブラウザB: プレイヤー2
  const page2 = await context.newPage();
  await page2.goto('http://localhost:5173');
  await page2.fill('input[name="playerName"]', 'Player2');
  await page2.fill('input[name="roomId"]', roomId);
  await page2.click('button:has-text("Join Room")');

  // プレイヤー1がゲーム開始
  await page.click('button:has-text("Start Game")');

  // 手札が配られたことを確認
  await expect(page.locator('[data-testid="player-hand"]')).toHaveCount(2);

  // ベッティング
  await page.click('button:has-text("Call")');
  await page2.click('button:has-text("Check")');

  // フロップに進んだことを確認
  await expect(page.locator('[data-testid="community-cards"]')).toHaveCount(3);
});
```

### 実行方法
```bash
# サーバー起動
cd server
npm run dev

# 別ターミナルでクライアント起動
cd client
npm run dev

# 別ターミナルでE2Eテスト実行
cd client
npx playwright test
```

### 実装状況
- ✅ `client/tests/two-player-game.spec.ts` - 2人プレイゲームシナリオ
- ⏳ マイルストーンC: 追加シナリオ（切断・再接続、タイムアウトなど）

---

## テストピラミッド

FF Pokerでは、**テストピラミッド**の原則に従っています。

```
        △
       /E2E\         少数（遅い、壊れやすい）
      /─────\
     / 統合   \       中程度（中速、やや壊れやすい）
    /─────────\
   / ユニット  \     多数（速い、安定）
  /───────────\
```

### 推奨バランス
- **ユニットテスト**: 70%（多数）
- **統合テスト**: 20%（中程度）
- **E2Eテスト**: 10%（少数）

### 理由
1. **ユニットテストが基盤**: 高速で安定、デバッグが容易
2. **統合テストで連携確認**: コンポーネント間のインタフェースを検証
3. **E2Eテストで最終確認**: ユーザー視点での動作を保証

---

## テストのベストプラクティス

### 1. テストは「Red → Green → Refactor」で書く
```typescript
// 1. Red: 失敗するテストを書く
test('should calculate pot correctly', () => {
  const pot = calculatePot([100, 200]);
  expect(pot).toBe(300); // 実装前は失敗
});

// 2. Green: テストを通す最小限の実装
function calculatePot(bets: number[]): number {
  return bets.reduce((sum, bet) => sum + bet, 0);
}

// 3. Refactor: コード品質を改善
function calculatePot(bets: number[]): number {
  if (!Array.isArray(bets)) throw new Error('Invalid input');
  return bets.reduce((sum, bet) => sum + bet, 0);
}
```

### 2. テスト名は「何をテストするか」を明確に
```typescript
// ❌ 悪い例
test('test1', () => { /* ... */ });

// ✅ 良い例
test('should return royal flush when cards are A-K-Q-J-10 of same suit', () => {
  /* ... */
});
```

### 3. Given-When-Then パターンを使う
```typescript
test('should auto-fold player after timeout', () => {
  // Given: プレイヤーのターン開始
  const playerId = 'player-1';
  timerManager.startTimer(roomId, playerId, onTimeout);

  // When: 60秒経過
  jest.advanceTimersByTime(60000);

  // Then: タイムアウトコールバックが呼ばれる
  expect(onTimeout).toHaveBeenCalledTimes(1);
});
```

### 4. 統合テストではクリーンアップを忘れずに
```typescript
afterEach(() => {
  // ソケット切断
  if (clientSocket?.connected) clientSocket.disconnect();

  // タイマークリア
  turnTimerManager.clearAllTimers();

  // 状態リセット
  gameManager = new GameManager();
});
```

### 5. E2Eテストは安定性を重視
```typescript
// ❌ 悪い例: 固定待機時間
await page.waitForTimeout(3000); // 遅い＆不安定

// ✅ 良い例: 条件待機
await page.waitForSelector('[data-testid="game-started"]', { timeout: 5000 });
```

---

## トラブルシューティング

### ユニットテストが失敗する
```bash
# モックの確認
# Jest/Vitestでは依存関係をモック化する必要がある

# 例: socket.ioのモック
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
  })),
}));
```

### 統合テストがタイムアウトする
```typescript
// タイムアウト時間を延長
test('long running test', async () => {
  // ...
}, 30000); // 30秒
```

### E2Eテストが不安定
```typescript
// リトライ設定を追加（playwright.config.ts）
export default defineConfig({
  retries: 2, // 失敗時2回リトライ
  timeout: 30000, // 30秒タイムアウト
});
```

---

## 参考資料

- **Jest公式ドキュメント**: https://jestjs.io/
- **Vitest公式ドキュメント**: https://vitest.dev/
- **Playwright公式ドキュメント**: https://playwright.dev/
- **React Testing Library**: https://testing-library.com/react

---

最終更新: 2025-11-23
