import { GameSessionModel } from './gameSession.model';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { execSync } from 'child_process';
import Games from '../games/game.model';

// In-memory lobby store
class LobbyStore {
  private lobbies: { [key: string]: any } = {};

  createLobby(socketId: string) {
    const lobbyId = Math.random().toString(36).substring(2, 8);
    this.lobbies[lobbyId] = {
      players: [socketId],
      createdAt: Date.now(),
      timeout: null,
    };
    return lobbyId;
  }

  joinLobby(lobbyId: string, socketId: string) {
    if (this.lobbies[lobbyId]) {
      this.lobbies[lobbyId].players.push(socketId);
      return true;
    }
    return false;
  }

  leaveLobby(socketId: string) {
    for (const lobbyId in this.lobbies) {
      const lobby = this.lobbies[lobbyId];
      const index = lobby.players.indexOf(socketId);

      if (index !== -1) {
        lobby.players.splice(index, 1);
        if (lobby.players.length === 0) {
          delete this.lobbies[lobbyId];
        }
        return lobbyId;
      }
    }
    return null;
  }

  getPlayers(lobbyId: string) {
    return this.lobbies[lobbyId]?.players || [];
  }

  removePlayer(socketId: string) {
    return this.leaveLobby(socketId);
  }

  getAllLobbies() {
    return this.lobbies;
  }

  getLobby(lobbyId: string) {
    return this.lobbies[lobbyId] || null;
  }
}

const lobbyStore = new LobbyStore();

export class LobbyService {
  // --- Lobby Management (In-Memory) ---
  static createLobby(socketId: string) {
    return lobbyStore.createLobby(socketId);
  }

  static joinLobby(lobbyId: string, socketId: string) {
    return lobbyStore.joinLobby(lobbyId, socketId);
  }

  static getPlayers(lobbyId: string) {
    return lobbyStore.getPlayers(lobbyId);
  }

  static removePlayer(socketId: string) {
    return lobbyStore.removePlayer(socketId);
  }

  static leaveLobby(socketId: string) {
    return lobbyStore.leaveLobby(socketId);
  }

  static getLobby(lobbyId: string) {
    return lobbyStore.getLobby(lobbyId);
  }

  static getAllLobbies() {
    return lobbyStore.getAllLobbies();
  }

  // --- Game Session Management (Database) ---

  static async getActiveSession(userId: string) {
    try {
      const session = await GameSessionModel.findOne({
        user_id: new mongoose.Types.ObjectId(userId),
        status: 'active',
      }).lean();

      if (session) {
        // Check if session is expired (no heartbeat for 5 mins)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (new Date(session.last_heartbeat).getTime() < fiveMinutesAgo) {
          await GameSessionModel.updateOne({ _id: session._id }, { $set: { status: 'timeout' } });
          return null;
        }

        if (session.process_id) {
          try {
            const isWindows = process.platform === 'win32';
            try {
              if (isWindows) {
                execSync(`tasklist /FI "PID eq ${session.process_id}" /FO CSV`, {
                  stdio: 'ignore',
                });
              } else {
                execSync(`ps -p ${session.process_id} -o pid=`, { stdio: 'ignore' });
              }
            } catch (checkError) {
              // Process dead
              await GameSessionModel.updateOne(
                { _id: session._id },
                { $set: { status: 'ended', ended_at: new Date() } } // ended_at not in schema but useful if added
              );
              return null;
            }
          } catch (processCheckError: any) {
            console.warn('[Lobby] Process check error:', processCheckError.message);
          }
        }
      }
      return session;
    } catch (error) {
      console.error('Error getting active session:', error);
      throw error;
    }
  }

  static async createSession(
    userId: string,
    gameId: string,
    gameFolderName: string,
    ownershipToken: string
  ) {
    try {
      const activeSession = await this.getActiveSession(userId);
      if (activeSession) {
        throw new Error(
          `Un jeu est déjà en cours: ${activeSession.game_folder_name}. Veuillez le fermer.`
        );
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');

      let gameObjectId: any = gameId;
      if (typeof gameId === 'string' && mongoose.Types.ObjectId.isValid(gameId)) {
        gameObjectId = new mongoose.Types.ObjectId(gameId);
      } else {
        // Try to find game by name if ID is not ObjectId
        const game = await Games.getGameByName(gameId);
        if (game) {
          gameObjectId = new mongoose.Types.ObjectId(game.id);
        } else {
          gameObjectId = null;
        }
      }

      const session = await GameSessionModel.create({
        user_id: new mongoose.Types.ObjectId(userId),
        game_id: gameObjectId,
        game_folder_name: gameFolderName,
        ownership_token: ownershipToken,
        session_token: sessionToken,
        status: 'active',
      });

      return {
        id: session._id.toString(),
        sessionToken: sessionToken,
        gameFolderName: gameFolderName,
        startedAt: session.started_at,
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  static async updateHeartbeat(sessionToken: string) {
    try {
      const result = await GameSessionModel.updateOne(
        { session_token: sessionToken, status: 'active' },
        { $set: { last_heartbeat: new Date() } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating heartbeat:', error);
      return false;
    }
  }

  static async endSession(sessionToken: string) {
    try {
      const result = await GameSessionModel.updateOne(
        { session_token: sessionToken },
        { $set: { status: 'ended' } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }

  static async endAllUserSessions(userId: string) {
    try {
      const result = await GameSessionModel.updateMany(
        { user_id: new mongoose.Types.ObjectId(userId), status: 'active' },
        { $set: { status: 'ended' } }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error ending all sessions:', error);
      throw error;
    }
  }

  static async getSession(sessionToken: string) {
    try {
      return await GameSessionModel.findOne({ session_token: sessionToken }).lean();
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }
}

export const lobbyService = LobbyService;
