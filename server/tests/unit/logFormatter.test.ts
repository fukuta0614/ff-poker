/**
 * logFormatter ユーティリティのユニットテスト
 *
 * TDD Red フェーズ: 失敗するテストケース
 */

import { formatLogEntry, formatTimestamp } from '../../src/utils/logFormatter';
import { LogEntry } from '../../src/types/debugLog';

describe('logFormatter', () => {
  describe('formatLogEntry()', () => {
    // TC-044: LogEntryを正しくフォーマットする 🔵
    test('LogEntryを正しくフォーマットする', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'INFO',
        message: 'Test message',
      };

      const result = formatLogEntry(entry);

      expect(result).toBe('[2025-11-22 14:30:45.123] [INFO] Test message');
    });

    // TC-045: ERRORレベルのログを正しくフォーマットする 🔵
    test('ERRORレベルのログを正しくフォーマットする', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'ERROR',
        message: 'Error occurred',
      };

      const result = formatLogEntry(entry);

      expect(result).toBe('[2025-11-22 14:30:45.123] [ERROR] Error occurred');
    });

    // TC-046: DEBUGレベルのログを正しくフォーマットする 🔵
    test('DEBUGレベルのログを正しくフォーマットする', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'DEBUG',
        message: 'Debug info',
      };

      const result = formatLogEntry(entry);

      expect(result).toBe('[2025-11-22 14:30:45.123] [DEBUG] Debug info');
    });

    // TC-053: 複数行のメッセージも1行にフォーマットされる 🟡
    test('複数行のメッセージも1行にフォーマットされる', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'INFO',
        message: 'Line 1\nLine 2\nLine 3',
      };

      const result = formatLogEntry(entry);

      // 改行が空白に置換される
      expect(result).toBe('[2025-11-22 14:30:45.123] [INFO] Line 1 Line 2 Line 3');
      // 改行が含まれていない
      expect(result).not.toContain('\n');
    });

    // TC-054: 特殊文字が含まれるメッセージも正しくフォーマットされる 🟡
    test('特殊文字が含まれるメッセージも正しくフォーマットされる', () => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: 'INFO',
        message: 'Message with "quotes" and \t tabs',
      };

      const result = formatLogEntry(entry);

      // 特殊文字が適切に処理される
      expect(result).toContain('quotes');
      expect(result).not.toContain('\t'); // タブは空白に変換
    });
  });

  describe('formatTimestamp()', () => {
    // TC-047: ISO 8601形式のタイムスタンプを正しく変換する 🔵
    test('ISO 8601形式のタイムスタンプを正しく変換する', () => {
      const isoTimestamp = '2025-11-22T14:30:45.123Z';

      const result = formatTimestamp(isoTimestamp);

      expect(result).toBe('2025-11-22 14:30:45.123');
    });

    // TC-048: ミリ秒が0の場合も正しくフォーマットされる 🔵
    test('ミリ秒が0の場合も正しくフォーマットされる', () => {
      const isoTimestamp = '2025-11-22T14:30:45.000Z';

      const result = formatTimestamp(isoTimestamp);

      expect(result).toBe('2025-11-22 14:30:45.000');
    });

    // TC-049: ミリ秒が999の場合も正しくフォーマットされる 🔵
    test('ミリ秒が999の場合も正しくフォーマットされる', () => {
      const isoTimestamp = '2025-11-22T14:30:45.999Z';

      const result = formatTimestamp(isoTimestamp);

      expect(result).toBe('2025-11-22 14:30:45.999');
    });

    // 境界値: 1桁のミリ秒も3桁でフォーマットされる
    test('1桁のミリ秒も3桁でフォーマットされる', () => {
      const isoTimestamp = '2025-11-22T14:30:45.001Z';

      const result = formatTimestamp(isoTimestamp);

      expect(result).toBe('2025-11-22 14:30:45.001');
    });

    // 境界値: 2桁のミリ秒も3桁でフォーマットされる
    test('2桁のミリ秒も3桁でフォーマットされる', () => {
      const isoTimestamp = '2025-11-22T14:30:45.012Z';

      const result = formatTimestamp(isoTimestamp);

      expect(result).toBe('2025-11-22 14:30:45.012');
    });
  });

  describe('ログレベルのフォーマット', () => {
    // TC-050, TC-051, TC-052: 各ログレベルが正しくフォーマットされる 🔵
    test.each([
      ['INFO', 'INFO'],
      ['ERROR', 'ERROR'],
      ['DEBUG', 'DEBUG'],
    ])('ログレベル %s が正しくフォーマットされる', (level, expected) => {
      const entry: LogEntry = {
        timestamp: '2025-11-22T14:30:45.123Z',
        level: level as 'INFO' | 'ERROR' | 'DEBUG',
        message: 'Test',
      };

      const result = formatLogEntry(entry);

      expect(result).toContain(`[${expected}]`);
    });
  });
});
