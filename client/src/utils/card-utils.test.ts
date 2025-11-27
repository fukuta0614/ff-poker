/**
 * カード表記変換ユーティリティのテスト
 */

import { describe, it, expect } from 'vitest';
import { cardNotationToSvgFileName } from './card-utils';

describe('cardNotationToSvgFileName', () => {
  it('数字カード（2-9）とスーツを正しく変換する', () => {
    expect(cardNotationToSvgFileName('9d')).toBe('9_of_diamonds.svg');
    expect(cardNotationToSvgFileName('2h')).toBe('2_of_hearts.svg');
    expect(cardNotationToSvgFileName('5c')).toBe('5_of_clubs.svg');
    expect(cardNotationToSvgFileName('7s')).toBe('7_of_spades.svg');
  });

  it('10を正しく変換する', () => {
    expect(cardNotationToSvgFileName('10h')).toBe('10_of_hearts.svg');
    expect(cardNotationToSvgFileName('10d')).toBe('10_of_diamonds.svg');
    expect(cardNotationToSvgFileName('10c')).toBe('10_of_clubs.svg');
    expect(cardNotationToSvgFileName('10s')).toBe('10_of_spades.svg');
  });

  it('エースを正しく変換する', () => {
    expect(cardNotationToSvgFileName('Ah')).toBe('ace_of_hearts.svg');
    expect(cardNotationToSvgFileName('Ad')).toBe('ace_of_diamonds.svg');
    expect(cardNotationToSvgFileName('Ac')).toBe('ace_of_clubs.svg');
    expect(cardNotationToSvgFileName('As')).toBe('ace_of_spades.svg');
  });

  it('ジャックを正しく変換する', () => {
    expect(cardNotationToSvgFileName('Jh')).toBe('jack_of_hearts.svg');
    expect(cardNotationToSvgFileName('Jd')).toBe('jack_of_diamonds.svg');
    expect(cardNotationToSvgFileName('Jc')).toBe('jack_of_clubs.svg');
    expect(cardNotationToSvgFileName('Js')).toBe('jack_of_spades.svg');
  });

  it('クイーンを正しく変換する', () => {
    expect(cardNotationToSvgFileName('Qh')).toBe('queen_of_hearts.svg');
    expect(cardNotationToSvgFileName('Qd')).toBe('queen_of_diamonds.svg');
    expect(cardNotationToSvgFileName('Qc')).toBe('queen_of_clubs.svg');
    expect(cardNotationToSvgFileName('Qs')).toBe('queen_of_spades.svg');
  });

  it('キングを正しく変換する', () => {
    expect(cardNotationToSvgFileName('Kh')).toBe('king_of_hearts.svg');
    expect(cardNotationToSvgFileName('Kd')).toBe('king_of_diamonds.svg');
    expect(cardNotationToSvgFileName('Kc')).toBe('king_of_clubs.svg');
    expect(cardNotationToSvgFileName('Ks')).toBe('king_of_spades.svg');
  });

  it('小文字でも正しく変換する', () => {
    expect(cardNotationToSvgFileName('ah')).toBe('ace_of_hearts.svg');
    expect(cardNotationToSvgFileName('kd')).toBe('king_of_diamonds.svg');
  });

  it('無効な入力に対してエラーをスローする', () => {
    expect(() => cardNotationToSvgFileName('')).toThrow();
    expect(() => cardNotationToSvgFileName('X')).toThrow();
    expect(() => cardNotationToSvgFileName('1h')).toThrow();
    expect(() => cardNotationToSvgFileName('Az')).toThrow();
  });
});
