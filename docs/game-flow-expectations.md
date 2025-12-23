# ゲームフロー期待動作仕様

## 1. 全員フォールドした場合（1人残り）

### 期待動作
1. **即座にラウンド終了**: 最後のプレイヤーがフォールドした瞬間
2. **ポット獲得**: 残った1人のプレイヤーが全ポットを獲得
3. **手札非公開**: フォールドで勝った場合、手札は公開しない
4. **次のラウンド開始**: 3秒待機後、自動的に次のラウンド開始

### 実装における処理フロー
```
Player2 folds (Player1のみ残る)
  ↓
GameEngine: processAction(fold)
  ↓
アクティブプレイヤー数チェック → 1人のみ
  ↓
即座にラウンド終了（ショーダウンなし）
  ↓
残ったプレイヤーにポット配分
  ↓
3秒待機
  ↓
次のラウンド開始
```

## 2. オールイン時の動作

### ケース2-1: 1人がオールイン、他はフォールド
**期待動作**:
- オールインしたプレイヤーが即座にポット獲得
- 手札非公開
- 次のラウンド開始

### ケース2-2: 複数プレイヤーがオールイン
**期待動作**:
1. ベッティング完了後、自動的にショーダウンまで進行
2. コミュニティカードを全て開示（フロップ→ターン→リバー）
3. ショーダウンで役判定
4. 勝者にポット配分
5. 次のラウンド開始

### ケース2-3: 1人オールイン、1人以上がコール
**期待動作**:
1. オールインプレイヤーはそれ以上アクションできない
2. 他のプレイヤーは通常通りベッティング継続
3. ベッティング完了後、ショーダウンまで進行
4. サイドポット計算
5. 役判定とポット配分

## 3. 通常のショーダウン

### 期待動作
1. リバーまでベッティング完了
2. 2人以上が残っている
3. 自動的にショーダウン実行
4. 全プレイヤーの手札公開
5. 役判定とポット配分
6. 3秒待機後、次のラウンド開始

## 4. 設計上の判定ロジック

### game_engine層での判定
- **processAction後**: アクティブプレイヤー数をチェック
  - 1人のみ → 即座に終了フラグ
  - 2人以上 → 通常のベッティング継続判定

### GameService層での判定
```typescript
executeAction後:
  if (newState.activePlayers === 1) {
    // 即座に勝者決定（ショーダウンなし）
    return handleWinByFold(roomId, newState);
  } else if (newState.stage === 'showdown') {
    // ショーダウン処理
    return handleShowdown(roomId, newState);
  } else if (isBettingComplete(newState)) {
    // ステージ進行
    return handleStageAdvance(roomId, newState);
  }
```

## 5. テストケース

### E2Eテストで確認すべきシナリオ

1. **全員フォールドケース**
   - 3人プレイヤー、2人がフォールド
   - 残り1人が即座にポット獲得
   - 手札非公開
   - 次のラウンドが自動開始

2. **オールイン即座勝利ケース**
   - 2人プレイヤー、1人がオールイン、もう1人がフォールド
   - オールインプレイヤーが即座にポット獲得
   - 手札非公開

3. **オールイン対決ケース**
   - 2人プレイヤー、両方オールイン
   - 自動的に全カード開示
   - ショーダウンで勝者決定

4. **複数オールインケース**
   - 3人プレイヤー、全員オールイン（額が異なる）
   - サイドポット計算
   - 正しくポット配分

5. **通常ショーダウンケース**
   - リバーまで進行
   - ショーダウンで役判定
   - 勝者にポット配分

---

## 調査結果：現在の実装の問題点

### 問題1: Fold時の即座終了が機能していない

**原因**:
- `advanceStage()` ([server/src/engine/stage.ts:211](../server/src/engine/stage.ts#L211)) が単純にステージを進行するのみ
- 1人しか残っていないケースをチェックしていない
- 結果として、1人残りでも preflop → flop → turn → river → showdown と進んでしまう

**コード箇所**:
- `server/src/engine/stage.ts` の `advanceStage()` 関数
- `server/src/services/GameService.ts` の `executeAction()` メソッド（line 119-130）

**期待される修正**:
1. `advanceStage()` 内で `hasOnlyOneActivePlayer()` をチェック
2. 1人のみの場合は直接 `stage: 'ended'` に設定し、その1人に全ポットを付与
3. または GameService の `executeAction()` で fold 後に `hasOnlyOneActivePlayer()` をチェックし、専用のハンドラーで処理

### 問題2: オールイン後の自動進行

**現状確認**:
- `isBettingComplete()` ([server/src/engine/utils.ts:132](../server/src/engine/utils.ts#L132)) は正しくオールインを検知している
  - Line 136: activePlayers.length <= 1 のチェック
  - Line 169-171: 全員オールイン（chips === 0）のチェック
- GameService の `executeAction()` が `isBettingComplete()` を使ってステージ進行している

**問題点**:
- オールインで全員のアクションが完了した場合、`advanceStage()` が呼ばれる
- しかし `advanceStage()` は単純にステージを進めるだけで、「全員オールインなので即座にショーダウンまで進む」ロジックがない
- 結果として、各ステージでベッティングラウンドが発生し、ack待ちになってしまう可能性

**期待される修正**:
1. `advanceStage()` で全員オールイン（chips === 0）をチェック
2. 全員オールインの場合は、残りのコミュニティカードを一気に配り、stage を 'showdown' に設定
3. または GameService で専用の「オールインショーダウン」ハンドラーを用意

### 既存の有用な関数

- `hasOnlyOneActivePlayer(state)`: [server/src/engine/utils.ts:179](../server/src/engine/utils.ts#L179)
- `getActivePlayers(state)`: [server/src/engine/utils.ts:55](../server/src/engine/utils.ts#L55)
- `isBettingComplete(state)`: [server/src/engine/utils.ts:132](../server/src/engine/utils.ts#L132)
