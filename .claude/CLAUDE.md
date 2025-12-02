# FF Poker - プロジェクトガイドライン (v2.0)

**更新日**: 2025-12-02
**バージョン**: 2.0

---

## プロジェクト概要

FF Pokerは、リアルタイムマルチプレイヤーテキサスホールデムポーカーゲームです。
モノレポ構成でReact + TypeScriptフロントエンドとNode.js + Expressバックエンドを開発します。

**設計方針**:
- **game_engine**: statelessな純粋関数でゲームロジックを実装
- **Client-Server IF**: シンプルなaction/response + stateUpdated broadcast
- **テスト重視**: 5層のテストレイヤー(server unit/integration, client unit/integration, e2e)

詳細は以下のドキュメントを参照:
- [requirements.md](../docs/requirements.md) - 要件定義書
- [design.md](../docs/design.md) - 設計書

---

## 開発プロセスの原則

### 1. テスト駆動開発 (TDD) の徹底

**すべての実装は必ずテストから始める**

#### TDDサイクル
1. **Red** - 失敗するテストを先に書く
2. **Green** - テストを通す最小限の実装
3. **Refactor** - コード品質を改善

#### テスト要件

| レイヤー | 対象 | ツール | カバレッジ目標 |
|---------|------|-------|--------------|
| **Server Unit** | game_engine, Room, services | Jest | 80% |
| **Server Integration** | socketHandler + Room + game_engine | Jest + socket.io-client | 70% |
| **Client Unit** | コンポーネント, フック | Vitest + React Testing Library | 70% |
| **Client Integration** | Socket通信 + State管理 | Vitest + WebSocketモック | 60% |
| **E2E** | 完全なゲームフロー | Playwright | 主要シナリオ網羅 |

#### 実装前のチェックリスト
- [ ] テストケースを洗い出したか？
- [ ] テストコードを先に書いたか？
- [ ] テストが失敗することを確認したか？
- [ ] 最小限の実装でテストを通したか？
- [ ] リファクタリング後もテストが通るか？

### 2. game_engineの設計原則

**game_engine** は、ゲームロジックを司る**純粋関数の集合**として実装する。

#### 設計原則
1. **Stateless**: 状態を保持しない
2. **Pure Functions**: `(currentState, action) → nextState`
3. **Testable**: 副作用がないため、unit testが容易
4. **Deterministic**: 同じ入力は常に同じ出力

#### game_engineの責務

**含む**:
- ベッティングロジック(fold, check, call, bet, raise, allin)
- ベッティング完了判定
- ストリート進行(preflop → flop → turn → river → showdown)
- 役判定(HandEvaluator)
- ポット・サイドポット計算(PotCalculator)
- デッキ管理・カード配布
- 勝者決定

**含まない**:
- Room管理(プレイヤー追加/削除、ルーム作成)
- Socket.io送信
- タイマー管理
- ロギング
- セッション管理

#### 実装例

```typescript
// game_engine/actions.ts
export function executeAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): GameEngineResult {
  // ターン検証
  if (playerId !== state.players[state.currentBettorIndex]?.id) {
    throw new Error('Not your turn');
  }

  // アクション実行...
  const nextState = { ...state };

  // イベント生成
  const events: GameEvent[] = [
    { type: 'actionPerformed', playerId, action },
    { type: 'turnChanged', playerId: getNextBettorId(nextState) },
  ];

  return { nextState, events };
}
```

### 3. Client-Server通信設計

#### アクション実行フロー

```
Client                          Server
  │                               │
  ├─ action送信 ─────────────────▶│
  │  (楽観的更新: 即座にUI反映)    │
  │                               ├─ game_engine実行
  │                               │
  │◀─ actionResponse ─────────────┤
  │  { success: true }            │
  │                               │
  │◀─ stateUpdated(broadcast) ────┤
  │  (全プレイヤーに送信)          │
  │                               │
  └─ 最終状態に同期              │
```

#### 重要な設計ポイント

1. **actionResponse**: `{ success: boolean, error?: string }` のシンプルなレスポンス
2. **stateUpdated**: 全プレイヤーにbroadcast、手札情報は含めない
3. **dealHand**: 個別送信で手札を配布(セキュリティ)
4. **楽観的更新**: アクション送信時に即座にUIを更新、サーバー応答で確定

### 4. ドキュメント整備の義務

**コードを書いたら必ずドキュメントを更新する**

#### ドキュメント種別
1. **コード内ドキュメント**
   - 複雑なロジックには必ずコメント
   - 公開APIには JSDoc/TSDoc
   - 型定義には説明コメント

2. **設計ドキュメント**
   - 設計変更時: [design.md](../docs/design.md) を更新
   - 新機能追加時: [requirements.md](../docs/requirements.md) の機能要件に追加

3. **README**
   - 環境構築手順の変更
   - 新しい依存関係の追加
   - 設定ファイルの変更

#### ドキュメント更新のタイミング
- 機能実装と同じPR内で必ず更新
- コミット前に関連ドキュメントをレビュー
- 古くなったドキュメントは削除または更新

### 5. コードレビューの実施

**自己レビューを含む多段階レビュー**

#### レビュー段階
1. **実装中レビュー** - リファクタリング時
2. **実装後レビュー** - 完成時にエージェントによる自動レビュー
3. **コミット前レビュー** - 最終確認

#### レビュー観点
- [ ] テストは十分か？（カバレッジ、境界値、エラーケース）
- [ ] game_engineは純粋関数として実装されているか？
- [ ] セキュリティ脆弱性はないか？（XSS, 手札漏洩、ターン検証）
- [ ] パフォーマンス問題はないか？
- [ ] TypeScript型定義は適切か？（any禁止）
- [ ] エラーハンドリングは適切か？
- [ ] コードの可読性は高いか？
- [ ] ドキュメントは更新されているか？

### 6. Git運用規約

#### ブランチ戦略
```
main (本番)
  └─ develop (開発)
       ├─ feature/機能名
       ├─ fix/バグ名
       └─ refactor/対象
```

#### コミットメッセージ規約
**Conventional Commits** を使用

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type一覧:**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードフォーマット（機能に影響しない）
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: ビルド、ツール設定など

**例:**
```
feat(game_engine): executeAction関数を実装

- ターン検証ロジック追加
- アクション種別に応じた処理を実装
- unit testでカバレッジ90%達成

Closes #123
```

---

## コーディング規約

### TypeScript

- `any` 型は原則禁止（やむを得ない場合は `unknown` を使用）
- すべての関数に戻り値の型を明示
- `interface` よりも `type` を優先（Union型が使いやすい）
- Null安全性を保つ（Optional Chaining `?.` を活用）

### game_engine実装規約

**純粋関数を保つための規約**:
- 引数を直接変更しない(immutable)
- 副作用を持たない(console.log, setTimeout等禁止)
- 外部状態に依存しない
- 同じ入力は常に同じ出力

```typescript
// ❌ Bad: 引数を直接変更
function executeAction(state: GameState, action: PlayerAction) {
  state.pot += 100;  // 破壊的変更
  return state;
}

// ✅ Good: 新しいオブジェクトを返す
function executeAction(state: GameState, action: PlayerAction): GameEngineResult {
  const nextState = {
    ...state,
    pot: state.pot + 100,
  };
  return { nextState, events: [...] };
}
```

### React

- 関数コンポーネントを使用（クラスコンポーネント禁止）
- カスタムフックで状態ロジックを分離
- PropTypesは使わず TypeScript の型定義を使用
- `useEffect` の依存配列は必ず指定
- 楽観的更新は `useReducer` で実装

### 命名規則

- **コンポーネント**: PascalCase（例: `GameTable`, `PlayerCard`）
- **関数/変数**: camelCase（例: `handleBet`, `playerList`）
- **定数**: UPPER_SNAKE_CASE（例: `MAX_PLAYERS`, `DEFAULT_CHIPS`）
- **ファイル名**: kebab-case（例: `game-table.tsx`, `player-card.tsx`）
- **型定義**: PascalCase（例: `Player`, `GameState`）

### ファイル構成

#### サーバー (server/)
```
src/
  game_engine/    # ゲームロジック(stateless)
    index.ts      # エクスポート
    state.ts      # GameState型定義
    actions.ts    # executeAction実装
    betting.ts    # ベッティングロジック
    street.ts     # ストリート進行
    showdown.ts   # ショーダウン処理
    hand-evaluator.ts
    pot-calculator.ts
    deck.ts
    utils.ts
  room/           # Room管理(stateful)
    RoomManager.ts
    Room.ts
  socket/         # WebSocket通信層
    socketHandler.ts
  services/       # サービス層
    SessionManager.ts
    TurnTimerManager.ts
    LoggerService.ts
  types/          # 型定義
    socket.ts
    errors.ts
  utils/          # ユーティリティ
    constants.ts
    validation.ts
  app.ts
  server.ts

test/
  unit/           # 単体テスト
    game_engine/
    room/
    services/
  integration/    # 統合テスト
    game-flow.test.ts
    reconnect.test.ts
```

#### クライアント (client/)
```
src/
  components/     # Reactコンポーネント
    Lobby.tsx
    Room.tsx
    Card.tsx
    PlayerInfo.tsx
    ActionButtons.tsx
  contexts/       # Context API
    SocketContext.tsx
    GameContext.tsx
  hooks/          # カスタムフック
    useOptimisticUpdate.ts
    useGameActions.ts
  types/          # 型定義
    game.ts
  utils/          # ユーティリティ
    card-utils.ts
  main.tsx
  App.tsx

test/
  unit/           # 単体テスト
    components/
    hooks/
  integration/    # 統合テスト
    game-flow.test.tsx
  e2e/            # E2Eテスト
    two-player-game.spec.ts
```

---

## セキュリティガイドライン

### 環境変数管理
- `.env` ファイルは **絶対に** Git管理しない
- `.env.example` でテンプレートを提供
- 環境変数は必ず `process.env` から読み込み、デフォルト値を設定

### 入力バリデーション
- クライアントとサーバー両方で検証
- Socket.io イベントの全入力を検証
- 型ガードを使用して実行時型チェック

### XSS対策
- ユーザー入力は常にサニタイズ
- dangerouslySetInnerHTML は原則禁止
- Content-Security-Policy ヘッダーを設定

### カード情報の保護
- **dealHand イベント**: Socket.io の `socket.emit()` で**個別送信**
- **stateUpdated**: 手札情報を含めない
- ショーダウン時のみカード開示

### ターン検証
- すべてのアクションを**game_engine内**で検証
- クライアント側の検証は補助的なもの

---

## エージェントとコマンドの活用

### Tsumikiプラグイン活用

このプロジェクトでは Tsumiki プラグインを活用した開発フローを推奨します。

#### 大規模機能開発時: Kairoフロー
```bash
/tsumiki:kairo-requirements  # 要件定義
/tsumiki:kairo-design        # 技術設計
/tsumiki:kairo-tasks         # タスク分割
/tsumiki:kairo-implement     # TDD実装
```

#### 個別機能開発時: TDDコマンド
```bash
/tsumiki:tdd-requirements    # 要件整理
/tsumiki:tdd-testcases      # テストケース洗い出し
/tsumiki:tdd-red            # Redフェーズ（テスト作成）
/tsumiki:tdd-green          # Greenフェーズ（実装）
/tsumiki:tdd-refactor       # Refactorフェーズ
/tsumiki:tdd-verify-complete # 完了検証
```

### カスタムエージェント

- **code-reviewer**: 実装後の自動コードレビュー
- **test-writer**: テストケース作成支援
- **doc-generator**: ドキュメント生成・更新

### カスタムコマンド

- **/review**: コードレビュー実行
- **/commit**: レビュー済みコードのコミット作成
- **/doc**: ドキュメント更新

---

## 開発フェーズ

### Phase 1: コア実装(優先度: 高)
- [ ] game_engine モジュールの実装
- [ ] Room管理モジュールの実装
- [ ] WebSocket通信層の実装
- [ ] 基本UI(ルーム作成、参加、ゲーム画面)
- [ ] Unit/Integrationテスト

### Phase 2: UX改善(優先度: 中)
- [ ] 楽観的更新の実装
- [ ] 再接続機能
- [ ] ターンタイムアウト
- [ ] エラーハンドリング強化

### Phase 3: 本番対応(優先度: 中)
- [ ] Redis統合(マルチサーバー)
- [ ] ロギング・監視
- [ ] デプロイ設定(Netlify/Render)
- [ ] E2Eテスト

### Phase 4: 将来拡張(優先度: 低)
- [ ] ゲーム履歴保存(PostgreSQL)
- [ ] 統計情報表示
- [ ] アニメーション(framer-motion)
- [ ] モバイル対応

---

## 開発環境

### 必須ツール
- Node.js 20.x LTS
- npm
- Docker & Docker Compose（Redis用、Phase 3以降）

### 推奨VSCode拡張機能
- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense
- Error Lens
- Jest Runner

---

## テスト実行コマンド

### Server
```bash
cd server

# 全テスト実行
npm test

# unit testのみ
npm test -- test/unit

# integration testのみ
npm test -- test/integration

# カバレッジ確認
npm run test:coverage

# watch mode
npm test -- --watch
```

### Client
```bash
cd client

# unit test
npm run test

# E2E test
npm run test:e2e

# E2E test (UI mode)
npm run test:e2e:ui
```

---

## トラブルシューティング

### よくある問題
1. **型エラー**: `npm run type-check` で確認
2. **テスト失敗**: モックの設定を確認
3. **WebSocket接続エラー**: CORSとポート設定を確認
4. **game_engineのテスト失敗**: 状態を変更していないか確認(immutability)

### 質問・相談
- 実装方針の相談: まず [design.md](../docs/design.md) を参照
- エラー解決: スタックトレース全体を共有
- 新機能提案: [requirements.md](../docs/requirements.md) から開始

---

## 重要な心構え

1. **テストなしのコードは負債** - 必ずテストを書く
2. **game_engineは純粋関数** - 副作用を持たない
3. **ドキュメントは未来の自分への手紙** - 丁寧に書く
4. **レビューは学びの機会** - 建設的にフィードバック
5. **セキュリティは後回しにしない** - 設計段階から考慮
6. **楽観的更新でUX向上** - 体感速度を重視
7. **完璧を目指すより動くものを作る** - イテレーティブに改善

---

## 参考リンク

- [要件定義書](../docs/requirements.md)
- [設計書](../docs/design.md)
- [Legacy実装](../legacy/) - 参考用、新実装では使用しない

---

このガイドラインに従って、高品質で保守性の高いコードを書きましょう！

**Document Version**: 2.0
**Last Updated**: 2025-12-02
