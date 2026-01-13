import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { GamesService } from './games.service';
import { redisService } from '../../services/redis.service';
import { GameModel } from './game.model';

// Ensure mocks are applied
import '../../tests/setup';

describe('GamesService', () => {
  beforeEach(() => {
    // Reset mocks if needed or rely on manual override
  });

  it('should return cached games if available', async () => {
    const mockGames = [{ id: 'g1', name: 'Cached Game' }];

    redisService.get = mock(async () => JSON.stringify(mockGames)) as any;

    const games = await GamesService.getAllGames();
    expect(games).toEqual(mockGames);
  });

  it('should fetch from DB if cache miss', async () => {
    redisService.get = mock(async () => null) as any;

    const mockDbGames = [{ _id: 'g2', folder_name: 'db_game', name: 'DB Game' }];

    GameModel.find = mock(() => ({
      lean: mock(async () => mockDbGames),
    })) as any;

    const games = await GamesService.getAllGames();

    // Logic transforms DB games: { id: "g2", folder_name: "db_game", name: "DB Game", ... }
    expect(games).toHaveLength(1);
    expect(games[0].name).toBe('DB Game');
    expect(games[0].id).toBe('g2');
  });
});
