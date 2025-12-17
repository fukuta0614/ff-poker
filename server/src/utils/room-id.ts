/**
 * 短いRoom IDを生成するユーティリティ
 *
 * 6文字の英数字（大文字 + 数字）でRoom IDを生成
 * 例: ABC123, XYZ789
 */

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外 (I, O, 0, 1)
const ID_LENGTH = 6;

/**
 * ランダムな短いRoom IDを生成
 */
export function generateShortRoomId(): string {
  let result = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    result += CHARSET[randomIndex];
  }
  return result;
}

/**
 * Room IDが有効な形式かチェック
 */
export function isValidRoomId(roomId: string): boolean {
  if (roomId.length !== ID_LENGTH) {
    return false;
  }

  // すべての文字がCHARSETに含まれているかチェック
  return roomId.split('').every(char => CHARSET.includes(char));
}
