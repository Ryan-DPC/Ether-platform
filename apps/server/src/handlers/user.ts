import { UsersService } from '../services/users.service';

const isValidName = (name: string) => /^[a-zA-Z0-9_]{3,20}$/.test(name.trim());

export const handleUserMessage = async (ws: any, type: string, payload: any) => {
  switch (type) {
    case 'setName':
      const name = payload;
      if (!name || !isValidName(name)) {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: {
              message:
                'Invalid username. Only alphanumeric characters and underscores, 3-20 characters allowed.',
            },
          })
        );
        return;
      }

      ws.data.name = name.trim();
      // UsersService.saveSocketId handled in index.ts on connection
      console.log(`User set their name: ${ws.data.name}`);
      ws.send(JSON.stringify({ type: 'nameSet', data: { name: ws.data.name } }));
      break;
  }
};
