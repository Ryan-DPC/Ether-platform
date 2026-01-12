class LobbyService {
  private lobbies: Map<string, any>;
  private socketToLobby: Map<string, string>;

  constructor() {
    this.lobbies = new Map();
    this.socketToLobby = new Map();
  }

  generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  createLobby(socketId: string) {
    const code = this.generateCode();
    this.lobbies.set(code, {
      players: [socketId],
      createdAt: Date.now(),
    });
    this.socketToLobby.set(socketId, code);
    return code;
  }

  joinLobby(code: string, socketId: string) {
    const lobby = this.lobbies.get(code);
    if (lobby && lobby.players.length < 2) {
      lobby.players.push(socketId);
      this.socketToLobby.set(socketId, code);
      return true;
    }
    return false;
  }

  leaveLobby(socketId: string) {
    const code = this.socketToLobby.get(socketId);
    if (code) {
      const lobby = this.lobbies.get(code);
      if (lobby) {
        lobby.players = lobby.players.filter((id: string) => id !== socketId);
        if (lobby.players.length === 0) {
          this.lobbies.delete(code);
        }
      }
      this.socketToLobby.delete(socketId);
      return code;
    }
    return null;
  }

  getPlayers(code: string) {
    const lobby = this.lobbies.get(code);
    return lobby ? lobby.players : [];
  }
}

export default new LobbyService();
