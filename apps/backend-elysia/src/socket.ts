
import { Server } from 'socket.io';

let io: Server | null = null;

export const setIO = (instance: Server) => {
    io = instance;
};

export const getIO = () => {
    return io;
};
