/**
 * LoggerService ユニットテスト
 */

import { LoggerService } from '../../src/services/LoggerService';
import winston from 'winston';

// Winstonのモック
jest.mock('winston', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
      colorize: jest.fn(),
      printf: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let mockWinstonLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerService = new LoggerService();
    mockWinstonLogger = loggerService.getLogger();
  });

  describe('debug', () => {
    it('should log debug message', () => {
      loggerService.debug('Test debug message', { key: 'value' });

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Test debug message', { key: 'value' });
    });

    it('should log debug message without meta', () => {
      loggerService.debug('Test debug message');

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Test debug message', undefined);
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      loggerService.info('Test info message', { key: 'value' });

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test info message', { key: 'value' });
    });
  });

  describe('warn', () => {
    it('should log warn message', () => {
      loggerService.warn('Test warn message', { key: 'value' });

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Test warn message', { key: 'value' });
    });
  });

  describe('error', () => {
    it('should log error message with error object', () => {
      const error = new Error('Test error');
      loggerService.error('Error occurred', error, { context: 'test' });

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', {
        context: 'test',
        error: {
          message: 'Test error',
          stack: error.stack,
          name: 'Error',
        },
      });
    });

    it('should log error message without error object', () => {
      loggerService.error('Error occurred', undefined, { context: 'test' });

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', {
        context: 'test',
        error: undefined,
      });
    });
  });

  describe('logGameStart', () => {
    it('should log game start event', () => {
      const roomId = 'room-1';
      const players = ['player-1', 'player-2'];
      const config = { smallBlind: 10, bigBlind: 20, dealerIndex: 0 };

      loggerService.logGameStart(roomId, players, config);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Game started', {
        roomId,
        players,
        smallBlind: 10,
        bigBlind: 20,
        dealerIndex: 0,
      });
    });
  });

  describe('logCardDeal', () => {
    it('should log card deal event', () => {
      const roomId = 'room-1';
      const deckHash = 'abc123';
      const cardCount = 10;

      loggerService.logCardDeal(roomId, deckHash, cardCount);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Cards dealt', {
        roomId,
        deckHash,
        cardCount,
      });
    });
  });

  describe('logPlayerAction', () => {
    it('should log player action with amount', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';
      const action = 'raise';
      const amount = 50;
      const remainingChips = 950;
      const stage = 'preflop';

      loggerService.logPlayerAction(roomId, playerId, action, amount, remainingChips, stage);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Player action', {
        roomId,
        playerId,
        action,
        amount,
        remainingChips,
        stage,
      });
    });

    it('should log player action without amount', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';
      const action = 'fold';
      const remainingChips = 1000;
      const stage = 'flop';

      loggerService.logPlayerAction(roomId, playerId, action, undefined, remainingChips, stage);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Player action', {
        roomId,
        playerId,
        action,
        amount: undefined,
        remainingChips,
        stage,
      });
    });
  });

  describe('logPotCalculation', () => {
    it('should log pot calculation', () => {
      const roomId = 'room-1';
      const mainPot = 100;
      const sidePots = [{ amount: 50, eligiblePlayers: ['player-1', 'player-2'] }];
      const totalPot = 150;

      loggerService.logPotCalculation(roomId, mainPot, sidePots, totalPot);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Pot calculated', {
        roomId,
        mainPot,
        sidePots,
        totalPot,
      });
    });
  });

  describe('logConnection', () => {
    it('should log connection event', () => {
      const socketId = 'socket-1';
      const playerId = 'player-1';
      const playerName = 'Alice';

      loggerService.logConnection(socketId, playerId, playerName, true);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Client connected', {
        socketId,
        playerId,
        playerName,
      });
    });

    it('should log disconnection event', () => {
      const socketId = 'socket-1';
      const playerId = 'player-1';
      const playerName = 'Alice';

      loggerService.logConnection(socketId, playerId, playerName, false);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Client disconnected', {
        socketId,
        playerId,
        playerName,
      });
    });

    it('should log connection without player info', () => {
      const socketId = 'socket-1';

      loggerService.logConnection(socketId, undefined, undefined, true);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Client connected', {
        socketId,
        playerId: undefined,
        playerName: undefined,
      });
    });
  });

  describe('logger configuration', () => {
    it('should create logger with correct configuration', () => {
      expect(winston.createLogger).toHaveBeenCalled();
    });
  });
});
