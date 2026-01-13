import { describe, expect, it, mock } from 'bun:test';
import { UsersService } from './users.service';
import { Users } from '@vext/database';
import { GameOwnershipModel } from '../game-ownership/game-ownership.model';

// Ensure mocks are applied
import '../../tests/setup';

describe('UsersService', () => {
  it('should return user profile with games owned count', async () => {
    // Setup Mock Return
    const mockUser = {
      id: 'u1',
      username: 'Ryan',
      email: 'ryan@vext.gg',
      toObject: () => ({ id: 'u1', username: 'Ryan', email: 'ryan@vext.gg' }),
    };

    // Valid override of the mock

    Users.getUserById = mock(async () => mockUser) as any;
    GameOwnershipModel.countDocuments = mock(async () => 5) as any;

    const profile = await UsersService.getUserProfile('u1');

    expect(profile).toBeDefined();
    expect(profile.username).toBe('Ryan');
    expect(profile.games_owned).toBe(5);
  });

  it('should throw error if user not found', async () => {
    Users.getUserById = mock(async () => null) as any;

    // Expect promise to reject
    expect(UsersService.getUserProfile('unknown')).rejects.toThrow('Utilisateur introuvable');
  });
});
