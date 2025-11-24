/**
 * logFormatter.ts
 * ログフォーマッタ
 *
 * ログエントリをテキスト形式に変換するユーティリティ関数
 */

import type { LogEntry, FormattedLogLine } from '../types/debugLog';

/**
 * ISO 8601形式のタイムスタンプを "YYYY-MM-DD HH:mm:ss.SSS" 形式に変換
 *
 * @param timestamp - ISO 8601形式のタイムスタンプ (例: 2025-11-22T14:30:45.123Z)
 * @returns フォーマット済みタイムスタンプ (例: 2025-11-22 14:30:45.123)
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * ログエントリをテキスト形式に変換
 *
 * フォーマット: [{timestamp}] [{level}] {message}
 * 例: [2025-11-22 14:30:45.123] [INFO] Test message
 *
 * @param entry - ログエントリ
 * @returns フォーマット済みログ行
 */
export function formatLogEntry(entry: LogEntry): FormattedLogLine {
  const formattedTimestamp = formatTimestamp(entry.timestamp);

  // 複数行メッセージを1行に変換し、特殊文字を処理
  const sanitizedMessage = entry.message
    .replace(/\n/g, ' ')  // 改行を空白に置換
    .replace(/\t/g, ' '); // タブを空白に置換

  return `[${formattedTimestamp}] [${entry.level}] ${sanitizedMessage}`;
}
