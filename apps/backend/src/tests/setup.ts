import { beforeAll, afterAll, mock } from 'bun:test';

// Mock Shared Database Package
mock.module('@vext/database', () => ({
  Users: {
    getUserById: mock(async () => null),
    getUserByUsername: mock(async () => null),
    getUserByEmail: mock(async () => null),
    updateUser: mock(async () => null),
    findUsersByUsername: mock(async () => []),
    updateUserProfilePic: mock(async () => null),
  },
  GameInstallationModel: {
    findOneAndUpdate: mock(() => ({ exec: async () => null })),
  },
}));

// Mock Local Models
mock.module('../game-ownership/game-ownership.model', () => ({
  GameOwnershipModel: {
    countDocuments: mock(async () => 0),
    find: mock(() => ({
      sort: mock(() => ({
        limit: mock(() => ({
          populate: mock(() => ({
            lean: mock(async () => []),
          })),
        })),
      })),
    })),
  },
}));

// Mock Games Model
mock.module('../features/games/game.model', () => ({
  default: {
    getGameByName: mock(async () => null),
    addGame: mock(async () => null),
    updateGameVersion: mock(async () => null),
  },
  GameModel: {
    find: mock(() => ({ lean: mock(async () => []) })),
  },
}));

// Mock External Services
mock.module('../services/cloudinary.service', () => ({
  CloudinaryService: class {
    isEnabled() {
      return false;
    }
    async getAllGames() {
      return [];
    }
  },
}));

mock.module('../services/github.service', () => ({
  GitHubService: class {
    parseUrl() {
      return null;
    }
    async getLatestRelease() {
      return null;
    }
  },
}));

// Mock Items Service
mock.module('../items/items.service', () => ({
  ItemsService: {
    getEquippedItem: mock(async () => null),
  },
}));

// Mock Redis Service (Keep existing)
mock.module('../services/redis.service', () => ({
  redisService: {
    get: mock(async () => null),
    set: mock(async () => 'OK'),
    setWithTTL: mock(async () => 'OK'),
    del: mock(async () => 1),
    deletePattern: mock(async () => 1),
  },
}));
