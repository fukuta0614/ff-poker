/**
 * マイルストーンB ロギングサービス
 * Winston を使用した構造化ログ出力
 */

import winston from 'winston';
import path from 'path';

/**
 * LoggerService
 * 構造化ログ出力、ログレベル管理
 */
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    const logDir = path.join(process.cwd(), 'logs');

    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        // コンソール出力
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          ),
        }),
        // エラーログファイル
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
        }),
        // 全ログファイル
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
        }),
      ],
    });
  }

  /**
   * DEBUGレベルログ
   */
  debug(message: string, meta?: object): void {
    this.logger.debug(message, meta);
  }

  /**
   * INFOレベルログ
   */
  info(message: string, meta?: object): void {
    this.logger.info(message, meta);
  }

  /**
   * WARNレベルログ
   */
  warn(message: string, meta?: object): void {
    this.logger.warn(message, meta);
  }

  /**
   * ERRORレベルログ
   */
  error(message: string, error?: Error, meta?: object): void {
    this.logger.error(message, {
      ...meta,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    });
  }

  /**
   * ゲーム開始ログ
   */
  logGameStart(
    roomId: string,
    players: string[],
    config: { smallBlind: number; bigBlind: number; dealerIndex: number }
  ): void {
    this.info('Game started', {
      roomId,
      players,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      dealerIndex: config.dealerIndex,
    });
  }

  /**
   * カード配布ログ
   */
  logCardDeal(roomId: string, deckHash: string, cardCount: number): void {
    this.debug('Cards dealt', {
      roomId,
      deckHash,
      cardCount,
    });
  }

  /**
   * プレイヤーアクションログ
   */
  logPlayerAction(
    roomId: string,
    playerId: string,
    action: string,
    amount: number | undefined,
    remainingChips: number,
    stage: string
  ): void {
    this.debug('Player action', {
      roomId,
      playerId,
      action,
      amount,
      remainingChips,
      stage,
    });
  }

  /**
   * ポット計算ログ
   */
  logPotCalculation(
    roomId: string,
    mainPot: number,
    sidePots: any[],
    totalPot: number
  ): void {
    this.debug('Pot calculated', {
      roomId,
      mainPot,
      sidePots,
      totalPot,
    });
  }

  /**
   * 接続/切断ログ
   */
  logConnection(
    socketId: string,
    playerId: string | undefined,
    playerName: string | undefined,
    connected: boolean
  ): void {
    const message = connected ? 'Client connected' : 'Client disconnected';
    this.info(message, {
      socketId,
      playerId,
      playerName,
    });
  }

  /**
   * Winstonロガーインスタンス取得（テスト用）
   */
  getLogger(): winston.Logger {
    return this.logger;
  }
}
