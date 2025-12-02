/**
 * 入力バリデーションユーティリティ
 */

/**
 * プレイヤー名をバリデーション＆サニタイズ
 * @param name プレイヤー名
 * @returns サニタイズされたプレイヤー名
 * @throws バリデーションエラー
 */
export const validatePlayerName = (name: string): string => {
  if (!name || typeof name !== 'string') {
    throw new Error('Player name is required');
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new Error('Player name cannot be empty');
  }

  if (trimmed.length > 20) {
    throw new Error('Player name too long (max 20 characters)');
  }

  // XSS対策: HTMLタグを除去
  const sanitized = trimmed.replace(/<[^>]*>/g, '');

  // サニタイズ後に空になった場合もエラー
  if (sanitized.length === 0) {
    throw new Error('Player name contains invalid characters');
  }

  return sanitized;
};

/**
 * ブラインド額をバリデーション
 * @param amount ブラインド額
 * @param name ブラインド名（エラーメッセージ用）
 * @returns 整数化されたブラインド額
 * @throws バリデーションエラー
 */
export const validateBlindAmount = (amount: number, name: string): number => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error(`${name} must be a number`);
  }

  if (amount <= 0) {
    throw new Error(`${name} must be positive`);
  }

  if (amount > 10000) {
    throw new Error(`${name} too large (max 10000)`);
  }

  // 整数化
  return Math.floor(amount);
};

/**
 * ルームIDをバリデーション
 * @param roomId ルームID
 * @returns バリデートされたルームID
 * @throws バリデーションエラー
 */
export const validateRoomId = (roomId: string): string => {
  if (!roomId || typeof roomId !== 'string') {
    throw new Error('Room ID is required');
  }

  const trimmed = roomId.trim();

  if (trimmed.length === 0) {
    throw new Error('Room ID cannot be empty');
  }

  // ルームIDは英数字とハイフンのみ
  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    throw new Error('Invalid room ID format');
  }

  return trimmed;
};
