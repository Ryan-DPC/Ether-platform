import axios from '../utils/axiosConfig';
import tauriAPI from '../tauri-adapter';

class StatsService {
  private currentSessionId: string | null = null;
  private currentGameId: string | null = null;
  private sessionStartTime: number = 0;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    tauriAPI.onGameExited(async (data: any) => {
      console.log('Game exited:', data);
      if (this.currentSessionId && this.currentGameId === data.gameId) {
        await this.endSession(this.currentSessionId);
      } else if (this.currentSessionId) {
        // Fallback: if gameId mismatch but session is open, close it anyway
        console.warn('Closing session with mismatched GameID');
        await this.endSession(this.currentSessionId);
      }
    });
  }

  async startSession(gameId: string): Promise<string | null> {
    try {
      this.sessionStartTime = Date.now(); // Track start time
      const response = await axios.post('/stats/session/start', { gameId });
      this.currentSessionId = response.data.sessionId;
      this.currentGameId = gameId;
      return this.currentSessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      // Even if server session fails, we track locally
      this.currentGameId = gameId;
      return null;
    }
  }

  async endSession(sessionId: string | null): Promise<void> {
    try {
      if (sessionId) {
        await axios.post('/stats/session/end', { sessionId });
      }

      // Calculate runtime
      if (this.sessionStartTime > 0 && this.currentGameId) {
        const durationMs = Date.now() - this.sessionStartTime;
        const minutes = Math.floor(durationMs / 60000); // Convert to minutes

        if (minutes > 0) {
          console.log(`Reporting playtime: ${minutes} minutes for game ${this.currentGameId}`);
          await axios.post('/users/playtime', {
            gameId: this.currentGameId,
            minutes: minutes,
          });
        }
      }

      this.currentSessionId = null;
      this.currentGameId = null;
      this.sessionStartTime = 0;
    } catch (error) {
      console.error('Failed to end session/playtime:', error);
    }
  }

  async getGlobalStats(): Promise<any> {
    try {
      const response = await axios.get('/stats/global');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch global stats:', error);
      return null;
    }
  }

  async getGameStats(gameId: string): Promise<any> {
    try {
      const response = await axios.get(`/stats/${gameId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch game stats:', error);
      return null;
    }
  }
}

export const statsService = new StatsService();
