    // Игрок отключился
    socket.on('disconnect', () => {
      console.log(`❌ Игрок отключился: ${socket.id}`);
      
      // Ищем комнату, где был этот игрок
      for (const [id, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        
        if (playerIndex !== -1) {
          // Если игрок найден в комнате
          if (room.status === 'playing') {
            // Если игра шла, объявляем победу сопернику
            const winnerColor = room.players.find(p => p.id !== socket.id)?.color;
            room.status = 'finished';
            room.winner = winnerColor || 'draw';
            io.to(id).emit('game_over', { 
              winner: room.winner, 
              reason: 'opponent_disconnected' 
            });
          }
          
          // Удаляем игрока из списка (или удаляем комнату целиком, если хочешь)
          room.players.splice(playerIndex, 1);
          
          // Если комната пустая, удаляем её
          if (room.players.length === 0) {
            rooms.delete(id);
          }
        }
      }
    });