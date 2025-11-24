/**
 * logFormatter.test.ts
 * ログフォーマッタのテスト
 */

import { formatLogEntry, formatTimestamp } from '../logFormatter';
import type { LogEntry } from '../../types/debugLog';

describe('logFormatter', () => {
  describe('formatLogEntry', () => {
    it('TC-044: LogEntryを正しくフォーマットする', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'INFO',
        message: 'Test message',
      };

      const result = formatLogEntry(entry);

      expect(result).toBe('[2025-11-22 14:30:45.123] [INFO] Test message');
    });

    it('TC-045: ERRORレベルのログを正しくフォーマットする', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'ERROR',
        message: 'Error occurred',
      };

      const result = formatLogEntry(entry);

      expect(result).toBe('[2025-11-22 14:30:45.123] [ERROR] Error occurred');
    });

    it('TC-046: DEBUGレベルのログを正しくフォーマットする', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'DEBUG',
        message: 'Debug info',
      };

      const result = formatLogEntry(entry);

      expect(result).toBe('[2025-11-22 14:30:45.123] [DEBUG] Debug info');
    });
  });

  describe('formatTimestamp', () => {
    it('TC-047: ISO 8601形式のタイムスタンプを正しく変換する', () => {
      const timestamp = '2025-11-22T14:30:45.123Z';
      const result = formatTimestamp(timestamp);

      expect(result).toBe('2025-11-22 14:30:45.123');
    });

    it('TC-048: ミリ秒が0の場合も正しくフォーマットされる', () => {
      const timestamp = '2025-11-22T14:30:45.000Z';
      const result = formatTimestamp(timestamp);

      expect(result).toBe('2025-11-22 14:30:45.000');
    });

    it('TC-049: ミリ秒が999の場合も正しくフォーマットされる', () => {
      const timestamp = '2025-11-22T14:30:45.999Z';
      const result = formatTimestamp(timestamp);

      expect(result).toBe('2025-11-22 14:30:45.999');
    });
  });
});
