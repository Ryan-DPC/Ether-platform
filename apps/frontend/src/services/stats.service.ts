import axios from '../utils/axiosConfig';
import tauriAPI from '../tauri-adapter';

class StatsService {
  private currentSessionId: string | null = null;
  private currentGameId: string | null = null;

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
      const response = await axios.post('/stats/session/start', { gameId });
      this.currentSessionId = response.data.sessionId;
      this.currentGameId = gameId;
      return this.currentSessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      return null;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await axios.post('/stats/session/end', { sessionId });
      this.currentSessionId = null;
      this.currentGameId = null;
    } catch (error) {
      console.error('Failed to end session:', error);
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
