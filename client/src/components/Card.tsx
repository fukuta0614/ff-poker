/**
 * トランプカード表示コンポーネント
 */

import React from 'react';
import { getCardUrl } from '../utils/card-utils';

export interface CardProps {
  notation: string;
  width?: number;
  height?: number;
  className?: string;
  faceDown?: boolean;
}

/**
 * トランプカードをSVG画像で表示するコンポーネント
 */
export const Card: React.FC<CardProps> = ({
  notation,
  width = 60,
  height,
  className = '',
  faceDown = false,
}) => {
  // 裏面表示の場合
  if (faceDown) {
    const cardBackUrl =
      'https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/svg-cards/back.svg';
    return (
      <img
        src={cardBackUrl}
        alt="Card back"
        style={{ width: `${width}px`, height: height ? `${height}px` : 'auto' }}
        className={className}
      />
    );
  }

  // 表面表示の場合
  const cardUrl = getCardUrl(notation);

  return (
    <img
      src={cardUrl}
      alt={notation}
      style={{ width: `${width}px`, height: height ? `${height}px` : 'auto' }}
      className={className}
    />
  );
};
