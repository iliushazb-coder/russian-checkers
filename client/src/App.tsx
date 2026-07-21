import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Исправление для Vercel: используем переменную окружения или localhost
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const socket = io(SERVER_URL);

type Piece = 0 | 1 | 2 | 3 | 4;
type Board = Piece[][];

interface Room {
  id: string;
  players: { id: string, color: 'white' | 'black' }[];
  board: Board;
  turn: 1 | 2;
  status: string;
  winner: string | null;
  timer: { white: number, black: number };
  lastMove: any;
  moveHistory: string[];
}

function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<{r: number, c: number} | null>(null);
  // Исправление: добавили префикс _, чтобы TypeScript не ругался на неиспользование
  const [_validMoves, setValidMoves] = useState<any[]>([]); 
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    // Инициализация Telegram WebApp (безопасная проверка)
    const tg = (window as any).Telegram?.WebApp;
    if (tg) { 
      tg.ready(); 
      tg.expand(); 
    }

    socket.on('room_created', (roomId: string) => {
      const link = `${window.location.origin}?room=${roomId}`;
      setInviteLink(link);
    });

    socket.on('game_start', (data: { room: Room }) => {
      setRoom(data.room);
      const player = data.room.players.find(p => p.id === socket.id);
      setMyColor(player?.color || null);
    });

    socket.on('move_made', (data: { room: Room }) => {
      setRoom(data.room);
      setSelectedPiece(null);
      setValidMoves([]);
    });

    socket.on('game_over', (data: { winner: string, reason?: string }) => {
      setRoom(prev => prev ? {...prev, status: 'finished', winner: data.winner} : null);
      alert(`Игра окончена! Победитель: ${data.winner === 'white' ? 'Белые' : 'Черные'} ${data.reason ? `(${data.reason})` : ''}`);
    });

    socket.on('timer_update', (data: { timer: {white: number, black: number} }) => {
      setRoom(prev => prev ? {...prev, timer: data.timer} : null);
    });

    return () => {
      socket.off('room_created');
      socket.off('game_start');
      socket.off('move_made');
      socket.off('game_over');
      socket.off('timer_update');
    };
  }, []);

  const createRoom = () => socket.emit('create_room');
  
  const joinRoomFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (roomId) socket.emit('join_room', roomId);
  };

  const handleSquareClick = (r: number, c: number) => {
    if (!room || room.status !== 'playing') return;
    const isMyTurn = (myColor === 'white' && room.turn === 1) || (myColor === 'black' && room.turn === 2);
    if (!isMyTurn) return;

    const piece = room.board[r][c];
    const isMyPiece = (myColor === 'white' && (piece === 1 || piece === 3)) || (myColor === 'black' && (piece === 2 || piece === 4));

    if (isMyPiece) {
      setSelectedPiece({r, c});
      // В полной версии здесь был бы запрос к серверу за validMoves
    } else if (selectedPiece) {
      const move = { from: selectedPiece, to: {r, c} };
      socket.emit('make_move', { roomId: room.id, move });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!room) {
    return (
      <div className="app-container">
        <h1>️ Русские Шашки</h1>
        <p>Играй с друзьями в Telegram бесплатно!</p>
        <div className="controls">
          <button onClick={createRoom}>Создать новую игру</button>
          <button onClick={joinRoomFromUrl}>Войти по ссылке</button>
        </div>
        {inviteLink && (
          <div style={{marginTop: 20, padding: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 8}}>
            <p>Пригласи друга:</p>
            <code style={{wordBreak: 'break-all'}}>{inviteLink}</code>
            <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{marginLeft: 10}}>Копировать</button>
          </div>
        )}
      </div>
    );
  }

  const isMyTurn = (myColor === 'white' && room.turn === 1) || (myColor === 'black' && room.turn === 2);

  return (
    <div className="app-container">
      <div className="info-panel">
        <div>
          <div>⚪ Белые: {formatTime(room.timer.white)}</div>
          <div>⚫ Черные: {formatTime(room.timer.black)}</div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div>Ход: {room.turn === 1 ? 'Белых' : 'Черных'}</div>
          <div style={{color: isMyTurn ? '#4ade80' : '#f87171'}}>
            {isMyTurn ? 'Твой ход!' : 'Ход соперника'}
          </div>
        </div>
      </div>

      <div className="board">
        {room.board.map((row, r) => 
          row.map((piece, c) => {
            const isDark = (r + c) % 2 === 1;
            const isLastMove = room.lastMove && ((room.lastMove.from.r === r && room.lastMove.from.c === c) || (room.lastMove.to.r === r && room.lastMove.to.c === c));
            const isSelected = selectedPiece?.r === r && selectedPiece?.c === c;
            
            return (
              <div 
                key={`${r}-${c}`} 
                className={`square ${isDark ? 'dark' : 'light'} ${isLastMove ? 'last-move' : ''}`}
                onClick={() => handleSquareClick(r, c)}
              >
                {piece !== 0 && (
                  <div className={`piece ${(piece === 1 || piece === 3) ? 'white' : 'black'} ${piece > 2 ? 'king' : ''} ${isSelected ? 'selected' : ''}`} />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="controls">
        <button className="danger" onClick={() => socket.emit('resign', room.id)}>Сдаться</button>
        <button onClick={() => {setRoom(null); window.history.pushState({}, '', window.location.pathname);}}>Выйти</button>
      </div>

      <div style={{marginTop: 15, fontSize: '0.8rem', opacity: 0.8, maxHeight: 100, overflowY: 'auto'}}>
        <strong>История ходов:</strong><br/>
        {room.moveHistory.map((m, i) => <span key={i}>{i+1}. {m} </span>)}
      </div>
    </div>
  );
}

export default App;