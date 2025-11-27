/**
 * カード表記変換ユーティリティ
 */

/**
 * カード表記（例: "9d", "Ah"）をSVGファイル名に変換する
 * @param notation カード表記（ランク + スーツ）
 * @returns SVGファイル名（例: "9_of_diamonds.svg"）
 * @throws 無効な入力の場合にエラーをスロー
 */
export function cardNotationToSvgFileName(notation: string): string {
  if (!notation || notation.length < 2) {
    throw new Error(`Invalid card notation: ${notation}`);
  }

  const upper = notation.toUpperCase();

  // スーツは最後の1文字
  const suitChar = upper.slice(-1);
  // ランクはスーツ以外の部分
  const rankStr = upper.slice(0, -1);

  // スーツマッピング
  const suitMap: Record<string, string> = {
    'H': 'hearts',
    'D': 'diamonds',
    'C': 'clubs',
    'S': 'spades',
  };

  const suit = suitMap[suitChar];
  if (!suit) {
    throw new Error(`Invalid suit: ${suitChar}`);
  }

  // ランクマッピング
  const rankMap: Record<string, string> = {
    'A': 'ace',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    'J': 'jack',
    'Q': 'queen',
    'K': 'king',
  };

  const rank = rankMap[rankStr];
  if (!rank) {
    throw new Error(`Invalid rank: ${rankStr}`);
  }

  return `${rank}_of_${suit}.svg`;
}

/**
 * SVGファイルのGitHub raw URLを生成する
 * @param svgFileName SVGファイル名
 * @returns GitHub raw URL
 */
export function getCardSvgUrl(svgFileName: string): string {
  const baseUrl = 'https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/svg-cards';
  return `${baseUrl}/${svgFileName}`;
}

/**
 * カード表記からSVGのURLを直接取得する
 * @param notation カード表記（例: "9d", "Ah"）
 * @returns カードSVGのURL
 */
export function getCardUrl(notation: string): string {
  const fileName = cardNotationToSvgFileName(notation);
  return getCardSvgUrl(fileName);
}
