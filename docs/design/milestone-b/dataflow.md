# マイルストーンB データフロー図

## 概要

このドキュメントはマイルストーンBで追加される機能のデータフロー図を示します。

---

## 1. 再接続フロー 🔵 *REQ-005~007, REQ-104~106より*

### シーケンス図

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant SM as SessionManager
    participant GM as GameManager

    Note over C: 接続が切断される
    C->>C: Socket.io切断イベント検知
    C->>C: ReconnectModalを表示
    C->>C: localStorageからplayerIdを取得

    Note over C: 再接続を試みる（自動）
    C->>S: Socket.io再接続
    C->>S: reconnectRequest(roomId, playerId)

    S->>SM: isSessionValid(playerId)
    SM-->>S: session情報（lastSeen確認）

    alt セッションが有効（120秒以内）
        S->>SM: updateSession(playerId, newSocketId)
        SM-->>S: 更新完了

        S->>GM: getRoom(roomId)
        GM-->>S: room情報

        S->>GM: getActiveRound(roomId)
        GM-->>S: roundState

        S->>C: roomState（ルーム情報）
        S->>C: gameState（ゲーム状態）
        S->>C: privateHand（手札、個別送信）
        S->>C: reconnectSuccess

        C->>C: ReconnectModalを閉じる
        C->>C: ゲーム画面を復元

        Note over S: 他のプレイヤーに通知
        S->>C: playerReconnected(playerId)
    else セッション期限切れ（120秒超過）
        S->>C: error('RECONNECT_FAILED', '再接続に失敗しました')
        C->>C: エラートースト表示
        C->>C: ロビー画面に遷移
    end
```

---

## 2. 切断中の他プレイヤーへの通知フロー 🔵 *REQ-106, REQ-202より*

### シーケンス図

```mermaid
sequenceDiagram
    participant C1 as Client 1 (切断)
    participant C2 as Client 2 (他プレイヤー)
    participant S as Server
    participant TM as TurnTimerManager

    Note over C1: プレイヤー1が切断
    C1->>S: disconnect
    S->>S: lastSeenを更新

    Note over S: グレースピリオド開始（120秒）
    S->>TM: startGracePeriodTimer(playerId, 120秒)

    loop 1秒毎
        TM->>S: 残り時間を通知
        S->>C2: playerDisconnected(playerId, remainingSeconds)
        C2->>C2: 「プレイヤー1が再接続中... 残りN秒」表示
    end

    alt 120秒以内に再接続
        C1->>S: reconnectRequest
        S->>TM: cancelGracePeriodTimer
        S->>C2: playerReconnected(playerId)
        C2->>C2: 通常表示に戻る
    else 120秒経過
        TM->>S: gracePeriodTimeout(playerId)
        S->>S: プレイヤーを自動フォールド
        S->>C2: playerTimeout(playerId)
        C2->>C2: 「プレイヤー1がタイムアウトしました」表示
    end
```

---

## 3. ターンタイムアウトフロー 🔵 *REQ-008~010, REQ-107~109より*

### シーケンス図

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant TM as TurnTimerManager
    participant GM as GameManager

    Note over S: プレイヤーのターン開始
    S->>TM: startTimer(roomId, playerId, 60秒)
    S->>C: turnStart(playerId, timeLimit: 60)
    C->>C: タイマー表示開始（60秒）

    loop 1秒毎
        TM->>S: 残り時間を通知
        S->>C: timerUpdate(remainingSeconds)
        C->>C: タイマー更新表示

        alt 残り10秒
            C->>C: タイマーを赤色に変更（警告表示）
        end
    end

    alt プレイヤーがアクション実行（60秒以内）
        C->>S: action(playerId, type, amount)
        S->>TM: cancelTimer(roomId)
        TM-->>S: タイマー停止
        S->>GM: handleAction(...)
        GM-->>S: アクション結果
        S->>C: actionResult(...)
        C->>C: タイマー非表示
    else タイムアウト（60秒経過）
        TM->>S: timeout(roomId, playerId)
        S->>GM: getGameState(roomId)
        GM-->>S: gameState

        alt チェック可能な場合
            S->>GM: handleAction(playerId, 'check')
            S->>C: autoAction('check')
        else チェック不可能な場合
            S->>GM: handleAction(playerId, 'fold')
            S->>C: autoAction('fold')
        end

        C->>C: 「タイムアウトにより自動XXしました」表示
    end
```

---

## 4. エラーハンドリングフロー 🔵 *REQ-011~013, REQ-110~113より*

### シーケンス図

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant V as Validator
    participant GM as GameManager

    C->>S: action(playerId, type, amount)

    S->>V: validateAction(playerId, action, gameState)

    alt バリデーション成功
        V-->>S: { valid: true }
        S->>GM: handleAction(playerId, action)
        GM-->>S: アクション結果
        S->>C: actionResult(success, data)
        C->>C: UI更新
    else バリデーション失敗
        V-->>S: { valid: false, errorCode, errorMessage }

        alt 自分のターンでない
            S->>C: error('NOT_YOUR_TURN', '今はあなたのターンではありません')
        else 不正なアクション
            S->>C: error('INVALID_ACTION', 'そのアクションは実行できません')
        else 不正なベット額
            S->>C: error('INVALID_BET_AMOUNT', '所持チップを超えるベットはできません')
        else ルームが見つからない
            S->>C: error('ROOM_NOT_FOUND', 'ルームが見つかりません')
        end

        C->>C: エラートースト表示（3秒）
        C->>C: エラー内容を日本語で表示
    end
```

---

## 5. ロギングフロー 🔵 *REQ-014~023より*

### データフロー図

```mermaid
flowchart TD
    A[ゲームイベント発生] --> B{イベント種別}

    B -->|ゲーム開始| C[Logger.info]
    B -->|カード配布| D[Logger.debug]
    B -->|アクション実行| E[Logger.debug]
    B -->|ポット計算| F[Logger.debug]
    B -->|接続/切断| G[Logger.info]
    B -->|エラー| H[Logger.error]

    C --> I[winston Logger]
    D --> I
    E --> I
    F --> I
    G --> I
    H --> I

    I --> J{環境}

    J -->|開発環境| K[DEBUG以上を出力]
    J -->|本番環境| L[INFO以上を出力]

    K --> M[標準出力]
    K --> N[ファイル出力<br/>logs/combined.log]
    K --> O[エラーファイル出力<br/>logs/error.log]

    L --> M
    L --> N
    L --> O
```

### ログ出力タイミング

```mermaid
sequenceDiagram
    participant E as Event
    participant L as LoggerService
    participant F as File
    participant C as Console

    Note over E: ゲーム開始
    E->>L: logger.info('Game started', metadata)
    L->>F: logs/combined.log に書き込み
    L->>C: 標準出力

    Note over E: プレイヤーアクション
    E->>L: logger.debug('Player action', metadata)
    L->>F: logs/combined.log に書き込み
    L->>C: 標準出力（開発時のみ）

    Note over E: エラー発生
    E->>L: logger.error('Error occurred', error, metadata)
    L->>F: logs/error.log に書き込み
    L->>F: logs/combined.log に書き込み
    L->>C: 標準出力（スタックトレース含む）
```

---

## 6. セッション管理のライフサイクル 🔵 *REQ-001~004より*

### 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> SessionCreated: プレイヤー接続
    SessionCreated --> Active: ゲーム参加

    Active --> Disconnected: 切断
    Disconnected --> Active: 120秒以内に再接続
    Disconnected --> Expired: 120秒経過

    Active --> Expired: プレイヤー退出
    Expired --> [*]: セッション削除

    note right of Disconnected
        グレースピリオド: 120秒
        lastSeenを記録
    end note
```

### セッションクリーンアップフロー

```mermaid
flowchart TD
    A[定期実行<br/>setInterval 30秒] --> B[SessionManager.cleanupExpiredSessions]

    B --> C{セッション一覧を走査}

    C --> D{lastSeenが<br/>120秒以上前？}

    D -->|Yes| E[セッション削除<br/>sessions.delete]
    D -->|No| F[スキップ]

    E --> G[次のセッション]
    F --> G

    G --> H{すべて確認？}

    H -->|No| C
    H -->|Yes| I[クリーンアップ完了]

    I --> A
```

---

## 7. システム全体のイベントフロー 🔵 *architecture.md設計より*

### 包括的なイベント図

```mermaid
flowchart TB
    subgraph Client
        UI[UI Components]
        Socket[Socket.io Client]
        Storage[localStorage<br/>playerId保存]
    end

    subgraph Server
        SocketServer[Socket.io Server]
        SessionMgr[SessionManager]
        TimerMgr[TurnTimerManager]
        GameMgr[GameManager]
        Logger[LoggerService]
        Validator[Validator]
    end

    UI -->|ユーザーアクション| Socket
    Socket -->|Socket.io Events| SocketServer

    SocketServer -->|reconnect| SessionMgr
    SocketServer -->|action| Validator
    SocketServer -->|turnStart| TimerMgr
    SocketServer -->|gameEvent| GameMgr

    SessionMgr -->|セッション管理| Storage
    Validator -->|バリデーション結果| SocketServer
    TimerMgr -->|timeout| GameMgr
    GameMgr -->|状態更新| SocketServer

    SessionMgr -.->|ログ出力| Logger
    TimerMgr -.->|ログ出力| Logger
    GameMgr -.->|ログ出力| Logger
    Validator -.->|ログ出力| Logger

    SocketServer -->|イベント通知| Socket
    Socket -->|UI更新| UI
```

---

## 8. クライアント側状態管理フロー 🟡 *React Context設計の妥当な推測*

### 状態更新フロー

```mermaid
flowchart LR
    A[Socket.ioイベント受信] --> B[useSocket Hook]
    B --> C[GameContext Dispatch]
    C --> D[Reducer処理]

    D -->|roomState| E[room状態更新]
    D -->|gameState| F[roundState状態更新]
    D -->|timerUpdate| G[turnTimer状態更新]
    D -->|error| H[error状態更新]
    D -->|reconnecting| I[connectionStatus更新]

    E --> J[Component再レンダリング]
    F --> J
    G --> J
    H --> J
    I --> J

    J --> K[UI更新]
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-22 | 1.0 | 初版作成（マイルストーンBデータフロー図） |
