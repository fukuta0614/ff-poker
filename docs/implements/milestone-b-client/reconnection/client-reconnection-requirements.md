# クライアント側再接続機能 - TDD要件定義書

## 機能名
**クライアント側 WebSocket 再接続機能**

---

## 1. 機能の概要

### 1.1 何をする機能か
🟡 **黄信号** (サーバー側実装から推測)

プレイヤーのネットワーク切断時に、自動的にサーバーへ再接続を試み、ゲーム状態を復元する機能。

### 1.2 どのような問題を解決するか
🟡 **黄信号** (milestone-bの目的から推測)

- **問題**: ネットワーク不安定時にプレイヤーがゲームから強制退出される
- **解決**: グレースピリオド内であれば、切断前の状態に復帰できる
- **ユーザー価値**: ゲーム中断を防ぎ、安定したプレイ体験を提供

### 1.3 想定されるユーザー
🟡 **黄信号** (一般的なユースケースから推測)

- ゲームプレイ中のすべてのプレイヤー
- モバイル環境など、ネットワークが不安定な環境のユーザー
- 一時的な接続トラブルに遭遇したユーザー

### 1.4 システム内での位置づけ
🔵 **青信号** (既存コード構造から確認)

- **レイヤー**: クライアント側のSocket.io統合層
- **関連コンポーネント**:
  - `SocketContext.tsx` - Socket接続管理
  - `GameContext.tsx` - ゲーム状態管理
  - `Room.tsx` - ゲーム画面（再接続状態の表示）
- **サーバー側連携**:
  - `socketHandler.ts` の `reconnectRequest` イベント
  - `SessionManager.ts` によるセッション検証

### 1.5 参照情報
- **参照したサーバー側実装**:
  - [server/src/socket/socketHandler.ts:242-289](../../server/src/socket/socketHandler.ts#L242-L289) - 再接続ハンドラ
  - [server/src/services/SessionManager.ts](../../server/src/services/SessionManager.ts) - セッション管理
  - [server/src/utils/constants.ts:21-27](../../server/src/utils/constants.ts#L21-L27) - タイムアウト定数
- **参照したクライアント側実装**:
  - [client/src/contexts/SocketContext.tsx](../../../client/src/contexts/SocketContext.tsx) - 既存Socket管理
  - [client/src/contexts/GameContext.tsx](../../../client/src/contexts/GameContext.tsx) - ゲーム状態管理

---

## 2. 入力・出力の仕様

### 2.1 入力パラメータ
🔵 **青信号** (サーバー側イベント定義から確認)

#### サーバーから受信するイベント

1. **`disconnect`** (Socket.io組み込みイベント)
   - パラメータ: なし
   - トリガー: Socket切断時

2. **`playerDisconnected`**
   ```typescript
   {
     playerId: string;  // 切断したプレイヤーのID
   }
   ```

3. **`playerReconnected`**
   ```typescript
   {
     playerId: string;  // 再接続したプレイヤーのID
   }
   ```

4. **`gameState`** (再接続成功時)
   ```typescript
   {
     roomId: string;
     players: Array<{
       id: string;
       name: string;
       chips: number;
       seat: number;
     }>;
     communityCards: string[];
     pot: number;
     currentBettorId: string;
     playerBets: Record<string, number>;
     hand: [string, string] | null;  // 自分の手札
   }
   ```

5. **`error`** (再接続失敗時)
   ```typescript
   {
     message: string;
     code: 'RECONNECT_FAILED';
   }
   ```

### 2.2 出力値
🔵 **青信号** (サーバー側ハンドラから確認)

#### サーバーへ送信するイベント

1. **`reconnectRequest`**
   ```typescript
   {
     playerId: string;  // 再接続するプレイヤーのID
     roomId: string;    // 再接続先のルームID
   }
   ```

#### UI状態の変更

1. **再接続中表示**
   - ローディングインジケーター
   - 「再接続中...」メッセージ
   - 残り時間カウントダウン（グレースピリオド）

2. **再接続成功時**
   - ゲーム画面の復元
   - 「再接続しました」成功メッセージ（一時表示）

3. **再接続失敗時**
   - エラーメッセージ表示
   - ロビー画面へ遷移

### 2.3 データフロー
🟡 **黄信号** (サーバー側実装から推測)

```
[クライアント] Socket切断
     ↓
[クライアント] localStorage に playerId/roomId 保存 (未実装)
     ↓
[クライアント] 自動再接続試行（Socket.io）
     ↓
[クライアント] 再接続成功 → reconnectRequest イベント送信
     ↓
[サーバー] SessionManager でセッション検証
     ↓
[サーバー] グレースピリオド内？
     ↓ YES
[サーバー] gameState イベント送信
     ↓
[クライアント] ゲーム状態を復元・UI更新
```

### 2.4 参照情報
- **参照したサーバー側型定義**: [server/src/types/socket.ts](../../server/src/types/socket.ts)
- **参照したSocket.io設定**: [client/src/contexts/SocketContext.tsx:28-36](../../../client/src/contexts/SocketContext.tsx#L28-L36)

---

## 3. 制約条件

### 3.1 パフォーマンス要件
🟡 **黄信号** (一般的なUX要件から推測)

- **再接続試行**: 1秒ごとに最大10回まで
- **UI応答性**: 切断検知から100ms以内に再接続UI表示
- **状態復元**: gameStateイベント受信後500ms以内にUI更新

### 3.2 セキュリティ要件
🔵 **青信号** (サーバー側実装から確認)

- **セッション検証**: サーバー側のSessionManagerによる検証必須
- **グレースピリオド**: 120秒（`TIMEOUT_CONSTANTS.GRACE_PERIOD`）
- **認証情報の保存**: localStorage使用時はXSS対策必須

### 3.3 互換性要件
🔵 **青信号** (既存技術スタックから確認)

- **Socket.io**: 4.x系の自動再接続機能を利用
- **React**: Hooks (useEffect, useState) を使用
- **TypeScript**: 厳格な型チェック
- **ブラウザ**: localStorage API対応ブラウザ

### 3.4 アーキテクチャ制約
🔵 **青信号** (既存コード構造から確認)

- **Context API**: SocketContext と GameContext を使用
- **イベント駆動**: Socket.ioイベントベースの設計
- **状態管理**: React Context + useState

### 3.5 参照情報
- **参照した定数**: [server/src/utils/constants.ts:TIMEOUT_CONSTANTS](../../server/src/utils/constants.ts#L21-L27)
- **参照した技術スタック**: [docs/tech-stack.md](../../tech-stack.md)

---

## 4. 想定される使用例

### 4.1 基本的な使用パターン
🟡 **黄信号** (ユーザーストーリーから推測)

#### ケース1: ゲーム中にWi-Fi切断 → 自動復帰
```
1. プレイヤーAがゲーム中
2. Wi-Fi接続が一時的に切れる
3. クライアント: 「再接続中...」を表示
4. Wi-Fi復帰
5. Socket.io が自動再接続
6. クライアント: reconnectRequest を送信
7. サーバー: セッション有効 → gameState 送信
8. クライアント: ゲーム画面を復元
9. 「再接続しました」メッセージ表示（3秒後に消える）
```

#### ケース2: ブラウザリフレッシュ後の復帰
```
1. プレイヤーAがゲーム中に誤ってF5押下
2. ページリロード
3. SocketContext再初期化
4. localStorage から playerId/roomId 取得
5. Socket接続完了後、reconnectRequest 送信
6. サーバー: セッション有効 → gameState 送信
7. ゲーム画面を復元
```

### 4.2 エッジケース
🟡 **黄信号** (サーバー側実装から推測)

#### ケース3: グレースピリオド超過
```
1. プレイヤーAが切断
2. 120秒以上経過
3. クライアント: reconnectRequest 送信
4. サーバー: error イベント送信 (code: RECONNECT_FAILED)
5. クライアント: 「セッションが期限切れです」エラー表示
6. ロビー画面へ自動遷移
```

#### ケース4: 他プレイヤーの切断通知
```
1. プレイヤーBが切断
2. サーバー: 全員に playerDisconnected イベント送信
3. クライアント: プレイヤーBのアバターに「切断中」バッジ表示
4. プレイヤーBが再接続
5. サーバー: playerReconnected イベント送信
6. クライアント: 「切断中」バッジ削除
```

### 4.3 エラーケース
🟡 **黄信号** (一般的なエラーハンドリングから推測)

#### ケース5: 再接続試行回数超過
```
1. Socket切断
2. 10回再接続試行失敗
3. クライアント: 「サーバーに接続できません」エラー表示
4. ロビー画面へ遷移オプション表示
```

#### ケース6: 無効なセッション情報
```
1. localStorage から取得した playerId が無効
2. reconnectRequest 送信
3. サーバー: error イベント送信
4. クライアント: localStorage クリア
5. ロビー画面へ遷移
```

### 4.4 参照情報
- **参照したサーバー側エラーハンドリング**: [server/src/socket/socketHandler.ts:277-282](../../server/src/socket/socketHandler.ts#L277-L282)

---

## 5. サーバー側実装との対応関係

### 5.1 参照したサーバー側実装

#### イベントハンドラ
- **disconnect**: [socketHandler.ts:210-239](../../server/src/socket/socketHandler.ts#L210-L239)
  - グレースピリオド開始
  - playerDisconnected イベント送信

- **reconnectRequest**: [socketHandler.ts:242-289](../../server/src/socket/socketHandler.ts#L242-L289)
  - セッション検証
  - Socket情報復元
  - gameState 送信または error 送信

#### サービスクラス
- **SessionManager.reconnect()**: [SessionManager.ts:61-79](../../server/src/services/SessionManager.ts#L61-L79)
  - グレースピリオド内検証
  - socketId 更新

#### 定数
- **TIMEOUT_CONSTANTS**: [constants.ts:21-27](../../server/src/utils/constants.ts#L21-L27)
  - GRACE_PERIOD: 120000ms (120秒)

### 5.2 クライアント側で実装が必要な機能

#### 必須実装
1. **再接続イベントリスナー**
   - `disconnect` → 再接続UI表示
   - `connect` → reconnectRequest 送信
   - `gameState` → ゲーム状態復元
   - `error (RECONNECT_FAILED)` → エラー処理

2. **localStorage 統合**
   - playerId/roomId の保存
   - ページリロード時の自動復元

3. **UI コンポーネント**
   - 再接続中モーダル
   - カウントダウンタイマー
   - エラーメッセージ表示

#### オプション実装（マイルストーンC）
1. **他プレイヤー切断の視覚フィードバック**
   - playerDisconnected → アバターバッジ
   - playerReconnected → バッジ削除

2. **再接続履歴ログ**
   - デバッグ用のコンソールログ

---

## 6. 品質判定

### 判定結果: ⚠️ **要改善**

#### 理由
- 🔴 **赤信号項目あり**: EARS要件定義書が存在せず、サーバー側実装から逆算
- 🟡 **黄信号項目多数**: UI仕様やエラーメッセージの詳細が未定義
- ✅ **実装可能性**: サーバー側APIは明確で実装可能

### 改善が必要な点
1. **UI仕様の明確化**
   - 再接続中モーダルのデザイン
   - エラーメッセージの文言
   - カウントダウン表示の有無

2. **エッジケースの網羅性**
   - ネットワーク状態の遷移パターン
   - 複数タブを開いた場合の挙動

3. **テスト戦略**
   - モック化の方針
   - E2Eテストシナリオ

### ユーザー確認が必要な項目
- 再接続中のUI表示内容
- グレースピリオドをユーザーに通知するか
- 再接続失敗時の自動遷移 vs 手動遷移

---

## 次のステップ

要件整理が完了しました。次は以下のコマンドでテストケースの洗い出しを行います：

```
/tsumiki:tdd-testcases
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-23 | 1.0 | 初版作成（milestone-b クライアント側実装） |
