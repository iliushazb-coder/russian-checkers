import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initializeDatabase } from './db/database';
import { createInitialBoard, getValidMoves, applyMove, checkWinCondition, Board, Move } from './game/checkersEngine';

const app = express();
app.use(cors());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

interface Room {
  id: string;
  players: { id: string, color: 'white' | 'black' }[];
  board: Board;
  turn: 1 | 2; // 1 = white, 2 = black
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  timer: { white: number, black: number };
  lastMove: Move | null;
  moveHistory: string[];
}

const rooms = new Map<string, Room>();
const PORT = process.env.PORT || 3001;

async function start() {
  await initializeDatabase();

  io.on('connection', (socket) => {
    console.log(`🔌 Подключился: ${socket.id}`);

    socket.on('create_room', () => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newRoom: Room = {
        id: roomId,
        players: [{ id: socket.id, color: 'white' }],
        board: createInitialBoard(),
        turn: 1,
        status: 'waiting',
        winner: null,
        timer: { white: 600, black: 600 }, // 10 минут на игрока
        lastMove: null,
        moveHistory: []
      };
      rooms.set(roomId, newRoom);
      socket.join(roomId);
      socket.emit('room_created', roomId);
      console.log(`🏠 Комната создана: ${roomId}`);
    });

    socket.on('join_room', (roomId: string) => {
      const room = rooms.get(roomId);
      if (room && room.status === 'waiting' && room.players.length < 2) {
        room.players.push({ id: socket.id, color: 'black' });
        room.status = 'playing';
        socket.join(roomId);
        io.to(roomId).emit('game_start', { room });
        startTimer(roomId);
      } else {
        socket.emit('error', 'Комната не найдена или заполнена');
      }
    });

    socket.on('make_move', (data: { roomId: string, move: Move }) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || (player.color === 'white' && room.turn !== 1) || (player.color === 'black' && room.turn !== 2)) {
        return; // Не твой ход
      }

      const validMoves = getValidMoves(room.board, room.turn);
      const isValid = validMoves.some(m => 
        m.from.r === data.move.from.r && m.from.c === data.move.from.c &&
        m.to.r === data.move.to.r && m.to.c === data.move.to.c
      );

      if (isValid) {
        room.board = applyMove(room.board, data.move);
        room.lastMove = data.move;
        room.moveHistory.push(`${player.color}: ${String.fromCharCode(97+data.move.from.c)}${8-data.move.from.r} -> ${String.fromCharCode(97+data.move.to.c)}${8-data.move.to.r}`);
        
        // Проверка на победу
        const nextTurn = room.turn === 1 ? 2 : 1;
        const winner = checkWinCondition(room.board, nextTurn);
        
        if (winner) {
          room.status = 'finished';
          room.winner = winner;
          io.to(roomId).emit('game_over', { winner, room });
        } else {
          room.turn = nextTurn;
          io.to(roomId).emit('move_made', { room });
        }
      }
    });

    socket.on('resign', (roomId: string) => {
      const room = rooms.get(roomId);
      if (room) {
        room.winner = room.players.find(p => p.id !== socket.id)?.color || 'draw';
        room.status = 'finished';
        io.to(roomId).emit('game_over', { winner: room.winner, room });
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Отключился: ${socket.id}`);
      // Упрощенно: если игрок ушел, игра заканчивается
      for (const [id, room] of rooms.entries()) {
        if (room.players.some(p => p.id === socket.id)) {
          room.status = 'finished';
          room.winner = room.players.find(p => p.id !== socket.id)?.color || 'draw';
          io.to(id).emit('game_over', { winner: room.winner, reason: 'opponent_disconnected' });
        }
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Сервер шашек запущен на порту ${PORT}`);
  });
}

function startTimer(roomId: string) {
  const interval = setInterval(() => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') {
      clearInterval(interval);
      return;
    }
    
    if (room.turn === 1) room.timer.white--;
    else room.timer.black--;

    if (room.timer.white <= 0 || room.timer.black <= 0) {
      room.status = 'finished';
      room.winner = room.timer.white <= 0 ? 'black' : 'white';
      io.to(roomId).emit('game_over', { winner: room.winner, reason: 'timeout' });
      clearInterval(interval);
    } else {
      io.to(roomId).emit('timer_update', { timer: room.timer });
    }
  }, 1000);
}

start();