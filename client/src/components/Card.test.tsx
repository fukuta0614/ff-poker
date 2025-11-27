/**
 * Cardコンポーネントのテスト
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('カード表記からSVG画像を表示する', () => {
    render(<Card notation="9d" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      'https://raw.githubusercontent.com/hayeah/playing-cards-assets/master/svg-cards/9_of_diamonds.svg'
    );
  });

  it('適切なalt textを設定する', () => {
    render(<Card notation="Ah" />);
    const img = screen.getByAltText('Ah');
    expect(img).toBeInTheDocument();
  });

  it('カスタムサイズを適用できる', () => {
    render(<Card notation="Kc" width={100} height={150} />);
    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ width: '100px', height: '150px' });
  });

  it('デフォルトサイズを使用する', () => {
    render(<Card notation="Qs" />);
    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ width: '60px' });
  });

  it('カスタムクラス名を適用できる', () => {
    render(<Card notation="10h" className="custom-card" />);
    const img = screen.getByRole('img');
    expect(img).toHaveClass('custom-card');
  });

  it('裏面表示モードを持つ', () => {
    render(<Card notation="2s" faceDown />);
    const img = screen.getByRole('img');
    // 裏面の場合は表記ではなく"Card back"などの汎用的なalt text
    expect(img).toHaveAttribute('alt', 'Card back');
  });

  it('複数のカードを並べて表示できる', () => {
    const { container } = render(
      <div>
        <Card notation="9d" />
        <Card notation="Ah" />
        <Card notation="Kc" />
      </div>
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(3);
  });
});
