# Online Poker - 実装計画

## 目次

1. [開発マイルストーン](#開発マイルストーン)
2. [マイルストーンA: プロトタイプ](#マイルストーンa-プロトタイプ)
3. [マイルストーンB: 安定化](#マイルストーンb-安定化)
4. [マイルストーンC: UX改善](#マイルストーンc-ux改善)
5. [テスト計画](#テスト計画)
6. [リスクと対応策](#リスクと対応策)
7. [次のアクション](#次のアクション)

---

## 開発マイルストーン

各マイルストーンは明確な達成条件を持ち、段階的に機能を追加していきます。

### 概要

| マイルストーン | 目的 | 達成条件 | 期間目安 |
|-------------|------|---------|---------|
| **A** | プロトタイプ | ブラウザ2つでゲームが最後まで回る | 完了 |
| **B** | 安定化 | 切断→再接続してゲームが継続できる | 完了 |
| **C** | UX改善 | 友達に「遊べる」と言わせられる | - |

---

## マイルストーンA: プロトタイプ

### 目標
最低限動作するゲームを作成し、基本的なゲームフローを確立する。

### 達成条件
- ブラウザを2つ開いて、ゲームが最後まで完走できる
- カード配布、ベッティング、ショーダウンが動作する
- 勝者が正しく決定され、チップが配分される

### タスク一覧

#### 1. プロジェクト初期セットアップ
- [ ] リポジトリ作成（GitHub）
- [ ] プロジェクト構造のセットアップ
  - [ ] クライアント（React + Vite + TypeScript）
  - [ ] サーバ（Node.js + Express + Socket.io + TypeScript）
- [ ] ESLint/Prettier設定
- [ ] Git ignore設定
- [ ] README作成

**成果物**:
```
/ff-poker
  /client
    /src
    package.json
    tsconfig.json
    vite.config.ts
  /server
    /src
    package.json
    tsconfig.json
  README.md
```

#### 2. サーバ側基盤実装
- [ ] Express + Socket.ioサーバセットアップ
- [ ] 基本的なルーティング（/health）
- [ ] Socket.io接続確認
- [ ] CORSの設定

**成果物**:
- `server/src/app.ts` - Expressアプリ初期化
- `server/src/server.ts` - サーバ起動
- `server/src/socket/socketHandler.ts` - Socket.io設定

#### 3. データモデル定義
- [ ] TypeScript型定義
  - [ ] Player
  - [ ] Room
  - [ ] RoundState
  - [ ] Action
- [ ] 型定義ファイルの作成

**成果物**:
- `server/src/types/game.ts`
- `client/src/types/game.ts`

#### 4. ゲームロジック実装（サーバ）

##### 4-1. Deck実装
- [ ] カード定義（52枚）
- [ ] シャッフル（Fisher-Yates）
- [ ] カード配布機能
- [ ] ユニットテスト作成

**成果物**:
- `server/src/game/Deck.ts`
- `server/tests/unit/Deck.test.ts`

##### 4-2. HandEvaluator実装
- [ ] 役判定ライブラリの選定（pokersolver等）
- [ ] 役判定関数の実装
- [ ] ハンド比較関数の実装
- [ ] ユニットテスト作成

**成果物**:
- `server/src/game/HandEvaluator.ts`
- `server/tests/unit/HandEvaluator.test.ts`

##### 4-3. PotCalculator実装
- [ ] ベット額集計
- [ ] メインポット計算
- [ ] サイドポット計算
- [ ] ポット配分ロジック
- [ ] ユニットテスト作成

**成果物**:
- `server/src/game/PotCalculator.ts`
- `server/tests/unit/PotCalculator.test.ts`

##### 4-4. Round実装
- [ ] ラウンドステート管理
- [ ] ステージ遷移（preflop → flop → turn → river → showdown）
- [ ] ベッティングラウンド処理
- [ ] アクションバリデーション
- [ ] ユニットテスト作成

**成果物**:
- `server/src/game/Round.ts`
- `server/tests/unit/Round.test.ts`

##### 4-5. Room実装
- [ ] プレイヤー管理（追加/削除）
- [ ] ラウンド管理（開始/終了）
- [ ] ディーラーローテーション
- [ ] ブラインド徴収
- [ ] 公開状態の取得

**成果物**:
- `server/src/game/Room.ts`
- `server/tests/unit/Room.test.ts`

##### 4-6. GameManager実装
- [ ] ルーム作成
- [ ] ルーム検索
- [ ] ルーム削除
- [ ] 全ルームの管理

**成果物**:
- `server/src/game/GameManager.ts`

#### 5. Socket.ioイベント実装（サーバ）
- [ ] joinRoom - ルーム参加処理
- [ ] leaveRoom - ルーム退出処理
- [ ] startGame - ゲーム開始処理
- [ ] action - プレイヤーアクション処理
- [ ] disconnect - 切断処理（基本のみ）

**成果物**:
- `server/src/socket/eventHandlers.ts`

#### 6. RESTエンドポイント実装（サーバ）
- [ ] POST /create-room - ルーム作成
- [ ] GET /room/:id - ルーム情報取得
- [ ] GET /health - ヘルスチェック

**成果物**:
- `server/src/api/routes.ts`
- `server/src/api/roomController.ts`

#### 7. クライアント基盤実装

##### 7-1. Socket.io接続
- [ ] Socket.io Clientセットアップ
- [ ] カスタムフック（useSocket）
- [ ] 接続/切断処理

**成果物**:
- `client/src/hooks/useSocket.ts`
- `client/src/contexts/SocketContext.tsx`

##### 7-2. 状態管理
- [ ] GameContext作成
- [ ] Reducer実装
- [ ] カスタムフック（useRoomState, useGameState）

**成果物**:
- `client/src/contexts/GameContext.tsx`
- `client/src/hooks/useRoomState.ts`
- `client/src/hooks/useGameState.ts`

#### 8. UI実装（クライアント）

##### 8-1. ロビー画面
- [ ] ルーム作成フォーム
- [ ] ルーム参加フォーム
- [ ] プレイヤー名入力
- [ ] 基本的なスタイリング

**成果物**:
- `client/src/pages/Lobby.tsx`

##### 8-2. ゲームルーム画面
- [ ] テーブルレイアウト
- [ ] プレイヤー座席表示（6席）
- [ ] 基本的なスタイリング

**成果物**:
- `client/src/pages/Room.tsx`
- `client/src/components/game/Table.tsx`
- `client/src/components/game/PlayerSeat.tsx`

##### 8-3. カードコンポーネント
- [ ] カード表示コンポーネント
- [ ] スート・ランク表示
- [ ] 裏面表示

**成果物**:
- `client/src/components/common/Card.tsx`
- `client/src/utils/card.ts`

##### 8-4. アクションパネル
- [ ] アクションボタン（Fold/Check/Call/Bet/Raise）
- [ ] ベット額入力（スライダーまたは数値入力）
- [ ] ボタンの活性化制御

**成果物**:
- `client/src/components/game/ActionPanel.tsx`

##### 8-5. コミュニティカード表示
- [ ] コミュニティカード領域
- [ ] ステージごとの表示制御

**成果物**:
- `client/src/components/game/CommunityCards.tsx`

##### 8-6. ポット表示
- [ ] ポット総額表示
- [ ] サイドポット表示（簡易版）

**成果物**:
- `client/src/components/game/PotDisplay.tsx`

#### 9. 統合テスト
- [ ] サーバ起動確認
- [ ] クライアント起動確認
- [ ] Socket.io接続確認
- [ ] ルーム作成→参加フロー確認
- [ ] ゲーム開始→終了フロー確認
- [ ] 2人プレイでの完全なゲームプレイ

**テストシナリオ**:
1. ブラウザAでルーム作成、プレイヤー1として参加
2. ブラウザBでルーム参加、プレイヤー2として参加
3. プレイヤー1がゲーム開始
4. 各ステージでベッティング実施
5. ショーダウンで勝者決定
6. チップが正しく配分される

---

## マイルストーンB: 安定化

### 目標
再接続機能、タイムアウト処理、エラーハンドリングを実装し、実用的なゲームにする。

### 達成条件
- ネットワーク切断後、再接続してゲームが中断なく続行できる
- タイムアウトで自動的にフォールドする
- 不正な入力に対してエラーメッセージが表示される

### タスク一覧

#### 1. 再接続機能実装

##### 1-1. サーバ側
- [ ] プレイヤーセッション管理（playerId生成）
- [ ] 切断時のグレースピリオド設定
- [ ] reconnectRequestイベント処理
- [ ] セッション復元ロジック

**成果物**:
- `server/src/game/SessionManager.ts`
- `server/src/socket/eventHandlers.ts`（reconnect処理追加）

##### 1-2. クライアント側
- [ ] playerIdのローカルストレージ保存
- [ ] 切断検知
- [ ] 自動再接続処理
- [ ] 再接続UIモーダル

**成果物**:
- `client/src/hooks/useReconnect.ts`
- `client/src/components/common/ReconnectModal.tsx`

#### 2. タイムアウト実装

##### 2-1. サーバ側
- [ ] TurnTimerクラス実装
- [ ] タイムアウト時の自動処理（check/fold）
- [ ] タイムアウトイベント送信

**成果物**:
- `server/src/game/TurnTimer.ts`

##### 2-2. クライアント側
- [ ] カウントダウンタイマー表示
- [ ] タイムアウト警告UI

**成果物**:
- `client/src/components/game/Timer.tsx`

#### 3. エラーハンドリング

##### 3-1. サーバ側
- [ ] アクションバリデーションの強化
- [ ] エラーメッセージの詳細化
- [ ] エラーロギング

**成果物**:
- `server/src/utils/validation.ts`
- `server/src/services/LoggerService.ts`

##### 3-2. クライアント側
- [ ] エラーメッセージ表示UI
- [ ] トースト通知
- [ ] フォームバリデーション

**成果物**:
- `client/src/components/common/ErrorMessage.tsx`
- `client/src/components/common/Toast.tsx`

#### 4. チャット機能実装
- [ ] サーバ側: chatMessageイベント処理
- [ ] クライアント側: チャットコンポーネント
- [ ] メッセージログ表示
- [ ] メッセージ送信フォーム

**成果物**:
- `client/src/components/chat/Chat.tsx`
- `client/src/components/chat/ChatMessage.tsx`

#### 5. ロギング強化
- [ ] ゲームイベントログ（配布、ベット、勝者）
- [ ] エラーログ
- [ ] パフォーマンスログ
- [ ] ログレベル設定

**成果物**:
- `server/src/services/LoggerService.ts`

#### 6. 統合テスト
- [ ] 再接続シナリオテスト
- [ ] タイムアウトシナリオテスト
- [ ] 複数プレイヤー（3-6人）でのゲームテスト
- [ ] エラー発生時の挙動確認

---

## マイルストーンC: UX改善

### 目標
UI/UXを洗練させ、友達に自信を持って勧められるレベルに仕上げる。

### 達成条件
- スムーズなアニメーションとトランジション
- モバイルで快適にプレイできる
- プレイ体験が直感的で分かりやすい

### タスク一覧

#### 1. アニメーション実装
- [ ] framer-motionのセットアップ
- [ ] カード配布アニメーション
- [ ] チップ移動アニメーション
- [ ] ボタンホバー/クリックエフェクト
- [ ] ページトランジション

**成果物**:
- アニメーション付きコンポーネント

#### 2. モバイル最適化
- [ ] レスポンシブレイアウト調整
- [ ] タッチ操作の最適化
- [ ] モバイルでのテーブルレイアウト
- [ ] フォントサイズ調整
- [ ] ボタンサイズの最適化（最小44x44px）

**成果物**:
- モバイルフレンドリーなUI

#### 3. UIコンポーネント改善
- [ ] カラースキーム統一
- [ ] フォント選定
- [ ] ボタンスタイル統一
- [ ] カードデザイン改善
- [ ] テーブル背景デザイン

**成果物**:
- デザインシステムの確立

#### 4. サウンドエフェクト（オプション）
- [ ] カード配布音
- [ ] チップ音
- [ ] ターン通知音
- [ ] 勝利音
- [ ] ミュート機能

**成果物**:
- サウンドマネージャー

#### 5. ゲーム履歴表示
- [ ] アクション履歴ログ
- [ ] 過去のハンド履歴
- [ ] 統計情報（勝率等）

**成果物**:
- `client/src/components/game/GameHistory.tsx`

#### 6. 設定画面
- [ ] サウンド設定
- [ ] アニメーション速度設定
- [ ] テーブルカラー選択
- [ ] プレイヤー名変更

**成果物**:
- `client/src/pages/Settings.tsx`

#### 7. 監視・分析
- [ ] Sentryセットアップ（エラー追跡）
- [ ] 基本的なアナリティクス
- [ ] パフォーマンスモニタリング

**成果物**:
- 監視ダッシュボード

#### 8. ユーザビリティテスト
- [ ] 友人に実際にプレイしてもらう
- [ ] フィードバック収集
- [ ] 改善点の洗い出し
- [ ] バグ修正

---

## テスト計画

詳細な設計は [test-design.md](../test-design.md) を参照してください。

### テストレベルの概要

#### 1. ユニットテスト
**目的**: 個々のクラス・関数が単体で正しく動作するか検証

**サーバ側**:
- **Deck.ts**: シャッフル、カード配布
- **HandEvaluator.ts**: 全役パターンの判定
- **PotCalculator.ts**: サイドポット計算
- **Round.ts**: ステート遷移、ベッティングロジック（26テスト実装済み）

**クライアント側**:
- **カスタムフック**: useSocket, useRoomState, useGameState
- **ユーティリティ関数**: card.ts, validation.ts

**ツール**: Jest (サーバ), Vitest (クライアント)
**カバレッジ目標**: サーバ80%以上、クライアント70%以上

**実装状況**: ✅ サーバ側ユニットテスト完了（76テスト）

#### 2. 統合テスト
**目的**: 複数のコンポーネントが連携して正しく動作するか検証

**サーバ統合テスト**:
複数のSocket.ioクライアントを立ち上げてゲームフローをテスト

**テストシナリオ**:
1. 2プレイヤーでプリフロップベッティングが完了し、フロップに進む
2. 3プレイヤーでプリフロップ全員アクションが正しく実行される
3. プレイヤーがレイズした場合、全員が再度アクションする

**ツール**: Jest, socket.io-client

**実装状況**: ✅ 統合テストファイル作成済み（`tests/integration/game-flow.test.ts`）

**注意**: `socket.io-client`パッケージのインストールが必要
```bash
cd server
npm install --save-dev socket.io-client
```

**デバッグ方法**:
- `socketHandler.ts`に詳細ログ追加済み
- `[DEBUG]`, `[INFO]`, `[ERROR]`プレフィックスでログ分類
- アクション前後の状態、ターン通知、ストリート移行を追跡可能

#### 3. E2Eテスト（マイルストーンB）

**ブラウザE2Eテスト**:
実際のブラウザで複数ユーザーをシミュレート

**テストシナリオ**:
1. 2人プレイでの完全なゲーム
2. 6人プレイでの完全なゲーム
3. 再接続シナリオ
4. タイムアウトシナリオ
5. エラーハンドリング

**ツール**: Playwright

**実装予定**: マイルストーンB

**テストケース例**:
```typescript
test('2人でゲームが完走できる', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  // ルーム作成
  await page1.goto('http://localhost:5173');
  await page1.click('[data-testid="create-room"]');
  const roomId = await page1.textContent('[data-testid="room-id"]');

  // ルーム参加
  await page2.goto('http://localhost:5173');
  await page2.fill('[data-testid="room-id-input"]', roomId);
  await page2.click('[data-testid="join-room"]');

  // ゲーム開始
  await page1.click('[data-testid="start-game"]');

  // ゲームプレイ...
});
```

### 負荷テスト（オプション）

**目的**: 同時接続の限界を確認

**ツール**: Artillery, k6

**シナリオ**:
- 100ルーム同時接続
- 各ルームで6人プレイ
- ゲームを並行実行

---

## リスクと対応策

### リスク一覧

#### 1. ブラウザのWebSocket切断が多い

**影響**: ゲーム中断、ユーザー体験の低下

**対策**:
- 再接続ロジックの実装
- グレースピリオドの設定（30秒）
- バックグラウンド対策の説明をUIに表示
- ハートビート実装（定期的なping/pong）

#### 2. チート（クライアント改造）

**影響**: ゲームの公平性喪失

**対策**:
- サーバ側で全ての決定を行う
- クライアントは表示のみ
- アクションのバリデーション強化
- ログ監査機能

#### 3. スケール問題

**影響**: 多数のユーザーに対応できない

**対策**:
- 初期は単一インスタンスで十分
- 必要に応じてRedis adapter導入
- 水平スケール設計
- 負荷テストの実施

#### 4. ゲームルールの境界ケース

**影響**: サイドポット計算エラー、不正な勝者決定

**対策**:
- 基本ケースで安定させる
- 複雑ケースはユニットテストで網羅
- HandEvaluatorは実績あるライブラリを使用

#### 5. モバイルブラウザの制約

**影響**: パフォーマンス低下、レイアウト崩れ

**対策**:
- モバイルファースト設計
- レスポンシブテスト実施
- 実機テスト（iPhone Safari）
- パフォーマンス最適化

#### 6. WebRTCが必要なケース

**影響**: P2P通信が必要な場合、TURN サーバーのコスト

**対策**:
- 現状はサーバ・クライアント方式で十分
- P2Pは将来的な検討事項

---

## 次のアクション

### 推奨する最初のステップ

#### Phase 1: 環境構築（1-2日）
1. GitHubリポジトリ作成
2. プロジェクト構造のセットアップ
   - クライアント: `npm create vite@latest client -- --template react-ts`
   - サーバ: Node.js + TypeScript プロジェクト初期化
3. ESLint/Prettier設定
4. Git初期コミット

#### Phase 2: サーバ基盤（2-3日）
1. Express + Socket.ioセットアップ
2. 型定義作成（Player, Room, RoundState）
3. Deck実装 + テスト
4. HandEvaluator実装 + テスト
5. Socket.io接続確認

#### Phase 3: ゲームロジック（5-7日）
1. Round実装 + テスト
2. Room実装 + テスト
3. GameManager実装
4. Socket.ioイベントハンドラ実装
5. 統合テスト

#### Phase 4: クライアント基盤（3-4日）
1. Socket.io接続
2. 状態管理（Context + Reducer）
3. ロビー画面
4. ゲームルーム画面（基本レイアウト）

#### Phase 5: UI実装（5-7日）
1. カードコンポーネント
2. アクションパネル
3. プレイヤー座席
4. コミュニティカード表示
5. ポット表示

#### Phase 6: 統合テスト（2-3日）
1. 2人プレイでのテストプレイ
2. バグ修正
3. 基本的な調整

**マイルストーンA達成！**

---

### 開発の進め方

#### ブランチ戦略
```
main (本番)
  └─ develop (開発)
       ├─ feature/server-setup
       ├─ feature/game-logic
       ├─ feature/client-setup
       └─ feature/ui-components
```

#### コミットメッセージ規約
```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
test: テスト追加
docs: ドキュメント更新
chore: 雑務（依存関係更新等）

例: feat: Deck実装とシャッフル機能追加
```

#### レビュープロセス
1. 機能ブランチでの開発
2. プルリクエスト作成
3. セルフレビュー
4. マージ

#### 定期的な振り返り
- 週次で進捗確認
- 問題点の洗い出し
- 優先順位の調整

---

## 付録: 具体的な実装メモ

### Deckシャッフル

```typescript
// Fisher-Yates シャッフル
shuffle(): void {
  for (let i = this.cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
  }

  // 監査用にシャッフル後のデッキをログ（本番では暗号化/ハッシュ化）
  logger.debug('Deck shuffled', { deckHash: this.getHash() });
}
```

### Potの計算（サイドポット対応）

```typescript
// 各プレイヤーのベット額から複数のポットを生成
calculatePots(bets: Map<string, number>, folded: Set<string>): Pot[] {
  const pots: Pot[] = [];
  const activeBets = new Map(
    Array.from(bets.entries()).filter(([id]) => !folded.has(id))
  );

  while (activeBets.size > 0) {
    const minBet = Math.min(...activeBets.values());
    const eligiblePlayers = Array.from(activeBets.keys());

    let potAmount = 0;
    for (const [playerId, bet] of activeBets.entries()) {
      potAmount += minBet;
      const remaining = bet - minBet;
      if (remaining === 0) {
        activeBets.delete(playerId);
      } else {
        activeBets.set(playerId, remaining);
      }
    }

    pots.push({ amount: potAmount, eligiblePlayers });
  }

  return pots;
}
```

### HandEvaluator

既存ライブラリの使用を推奨:

```typescript
import { Hand } from 'pokersolver';

class HandEvaluator {
  static evaluate(holeCards: string[], communityCards: string[]): Hand {
    const allCards = [...holeCards, ...communityCards];
    return Hand.solve(allCards);
  }

  static compare(hand1: Hand, hand2: Hand): number {
    return hand1.compare(hand2);
  }
}
```

### 再接続設計

```typescript
// セッション管理
class SessionManager {
  private sessions = new Map<string, PlayerSession>();

  createSession(playerId: string, socketId: string): void {
    this.sessions.set(playerId, {
      playerId,
      socketId,
      lastSeen: Date.now(),
      reconnectToken: generateToken()
    });
  }

  reconnect(playerId: string, newSocketId: string): boolean {
    const session = this.sessions.get(playerId);
    if (!session) return false;

    const now = Date.now();
    if (now - session.lastSeen > GRACE_PERIOD) {
      this.sessions.delete(playerId);
      return false;
    }

    session.socketId = newSocketId;
    session.lastSeen = now;
    return true;
  }
}
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-18 | 1.0 | 初版作成 |
| 2025-11-21 | 1.1 | テスト計画セクションを更新、統合テスト実装状況を追記 |
