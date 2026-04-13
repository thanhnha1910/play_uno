import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.PROD ? "" : "http://localhost:10000";
const socket = io(SERVER_URL);

// Hàm helper để render thẻ bài chân thực
const UnoCard = ({ color, value, type, onClick, isDrawDeck, drawStack }) => {
  const colorClass = color.replace(' xanh', '').replace(' lá', '-lá').replace(' dương', '-dương');
  
  // Mapping Icon
  let displayValue = value;
  let cornerValue = value;
  
  if (value === 'Mất lượt') { displayValue = '⊘'; cornerValue = '⊘'; }
  if (value === 'Đổi chiều') { displayValue = '⇄'; cornerValue = '⇄'; }
  if (value === '+2') { displayValue = '+2'; cornerValue = '+2'; }
  if (value === '+4') { displayValue = '+4'; cornerValue = '+4'; }
  if (value === 'Đổi màu') { displayValue = 'WILD'; cornerValue = ''; }

  const centerScale = displayValue.length > 2 ? '0.6' : '1'; 

  if (isDrawDeck) {
    return (
      <div className={`uno-card-wrapper Đen`} onClick={onClick} style={{ cursor: 'pointer' }}>
        <div className="uno-card-inner" style={{background: '#e11d48'}}>
          <div className="uno-card-oval" style={{background: '#be123c', boxShadow: 'none'}}></div>
          <div className="uno-card-center-value" style={{color: '#facc15', textShadow: '2px 2px 0px rgba(0,0,0,0.5)', fontSize: '2rem', transform: 'rotate(-25deg)', textAlign: 'center'}}>
            UNO
            {drawStack > 0 && <div style={{fontSize: '1rem', color: 'white'}}>+{drawStack}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`uno-card-wrapper ${colorClass}`} onClick={onClick}>
      <div className="uno-card-inner">
        <div className="uno-card-corner uno-card-top-left">{cornerValue}</div>
        <div className="uno-card-oval"></div>
        <div className="uno-card-center-value" style={{ transform: `rotate(0deg) scale(${centerScale})` }}>
          {displayValue}
        </div>
        <div className="uno-card-corner uno-card-bottom-right">{cornerValue}</div>
        {/* Helper text cho Wild card Color */}
        {type === 'wild' && color !== 'Đen' && (
           <div style={{position: 'absolute', bottom: '4px', fontSize: '0.65rem', color: 'white', zIndex: 10, fontWeight: 'bold', textShadow: '1px 1px 2px black'}}>
             {color}
           </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const [gameState, setGameState] = useState({ status: 'login' });
  const [errorMsg, setErrorMsg] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCardIndex, setPendingCardIndex] = useState(null);
  const [roomInput, setRoomInput] = useState('');
  const [localTime, setLocalTime] = useState(0);
  const [showUnoEffect, setShowUnoEffect] = useState(false);

  useEffect(() => {
    socket.on('game_state', (data) => {
      setGameState(data);
    });

    socket.on('error_msg', (data) => {
      setErrorMsg(data.message);
      setTimeout(() => setErrorMsg(''), 3000);
    });

    socket.on('uno_shout', () => {
      setShowUnoEffect(true);
      
      // Auto-Hide popup sau 2 giây
      setTimeout(() => setShowUnoEffect(false), 2000);
      
      // Phát tiếng nói bốc đồng
      try {
        const msg = new SpeechSynthesisUtterance('UNO!');
        msg.rate = 1.3;
        msg.pitch = 1.5;
        window.speechSynthesis.speak(msg);
      } catch (e) {}
    });

    return () => {
      socket.off('game_state');
      socket.off('error_msg');
      socket.off('uno_shout');
    };
  }, []);

  // Timer đồng bộ từ server và tự đếm client-side
  useEffect(() => {
    if (gameState.time_left !== undefined) {
      setLocalTime(gameState.time_left);
    }
  }, [gameState.time_left, gameState.is_my_turn]);

  useEffect(() => {
    let timerId;
    if (gameState.status === 'playing' && localTime > 0) {
      timerId = setInterval(() => {
        setLocalTime(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [gameState.status, localTime]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomInput.trim()) {
      socket.emit('join_room', { room_id: roomInput });
      setGameState({ status: 'waiting', room_id: roomInput });
    }
  };

  const handlePlayCard = (index) => {
    if (!gameState.is_my_turn) return;
    const card = gameState.hand[index];
    if (card.type === 'wild' && card.value !== '+4') {
      setPendingCardIndex(index);
      setShowColorPicker(true);
    } else {
      socket.emit('play_card', { card_index: index });
    }
  };

  const handleColorSelected = (color) => {
    socket.emit('play_card', { card_index: pendingCardIndex, chosen_color: color });
    setShowColorPicker(false);
    setPendingCardIndex(null);
  };

  const handleDrawCard = () => {
    if (!gameState.is_my_turn) return;
    socket.emit('draw_card', {});
  };

  const handleCallUno = () => {
    socket.emit('call_uno', {});
  };

  const handleCatchUno = () => {
    socket.emit('catch_uno', {});
  };

  // Helper render TimerBar chung
  const renderTimerBar = (isActive) => {
    if (!isActive || gameState.status !== 'playing') {
       return <div style={{height: '6px', width: '100%', marginBottom: '10px'}} />; // Placeholder
    }
    return (
       <div style={{ 
           width: '100%', height: '6px', background: 'var(--glass-bg)', 
           borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-border)',
           boxShadow: '0 0 10px rgba(225, 29, 72, 0.3)',
           marginBottom: '10px'
       }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, (localTime / 15) * 100))}%`,
            background: localTime <= 5 ? '#e11d48' : (localTime <= 10 ? '#f59e0b' : '#10b981'),
            transition: 'background-color 0.5s ease', // Bỏ transition width để thanh bị snap giật dứt khoát 1s/lần
            borderRadius: '10px'
          }}></div>
       </div>
    );
  };

  if (gameState.status === 'login') {
    return (
      <div className="app-container">
        <div className="glass-panel lobby">
          <h1>UNO</h1>
          <p style={{marginBottom: '20px', fontWeight: 600}}>Cùng người thương chơi UNO!</p>
          <form onSubmit={handleJoinRoom} style={{display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center'}}>
            <input 
              type="text" 
              placeholder="Nhập Mã Phòng..." 
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              style={{
                padding: '12px 20px', borderRadius: '99px', border: '2px solid var(--pink-primary)', 
                fontSize: '1.1rem', outline: 'none', width: '250px', textAlign: 'center',
                fontFamily: 'Outfit, sans-serif'
              }}
            />
            <button className="btn" type="submit">Vào Phòng</button>
          </form>
        </div>
      </div>
    );
  }

  if (gameState.status === 'waiting') {
    return (
      <div className="app-container">
        <div className="glass-panel lobby">
          <h1>UNO</h1>
          <p>Mã phòng: <strong style={{color: 'var(--pink-dark)', fontSize:'1.2rem'}}>{gameState.room_id}</strong></p>
          <p>Đang chờ đối thủ vào mã này...</p>
          <div className="spinner"></div>
          <button className="btn" style={{marginTop: '20px', background: '#6b7280'}} onClick={() => window.location.reload()}>Quay Lại</button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'finished') {
    return (
      <div className="app-container">
        <div className="glass-panel lobby">
          <h1>{gameState.winner === true ? "BẠN ĐÃ THẮNG! 🎉" : "ĐỐI THỦ THẮNG! 💔"}</h1>
          <button className="btn" onClick={() => window.location.reload()}>
            Chơi Lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {errorMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: 'white', padding: '10px 20px', borderRadius: '10px', zIndex: 1000, fontWeight: 600, fontSize: '0.9rem' }}>
          {errorMsg}
        </div>
      )}

      {showUnoEffect && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(225, 29, 72, 0.4)',
          pointerEvents: 'none'
        }}>
          <h1 style={{
            fontSize: 'min(15rem, 40vw)', color: '#facc15', textShadow: '0 0 50px #ef4444, 5px 5px 0 #ef4444',
            transform: 'rotate(-10deg)', animation: 'pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>UNO!</h1>
        </div>
      )}

      {showColorPicker && (
        <div className="color-picker">
          <div className="glass-panel color-picker-modal">
            <h2>Chọn màu mới</h2>
            <div className="color-options">
              <div className="color-btn bg-Đỏ" onClick={() => handleColorSelected('Đỏ')}></div>
              <div className="color-btn bg-Vàng" onClick={() => handleColorSelected('Vàng')}></div>
              <div className="color-btn bg-Xanh-lá" onClick={() => handleColorSelected('Xanh lá')}></div>
              <div className="color-btn bg-Xanh-dương" onClick={() => handleColorSelected('Xanh dương')}></div>
            </div>
            <button className="btn" style={{ background: '#6b7280' }} onClick={() => setShowColorPicker(false)}>Huỷ</button>
          </div>
        </div>
      )}

      <div className="game-board">
        {/* === ĐỐI THỦ === */}
        <div className="opponent-area">
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
            <div className="glass-panel status-badge" style={{ background: !gameState.is_my_turn ? '#fda4af' : 'white' }}>
              Đối thủ: {gameState.opponent_card_count} lá
            </div>
            {gameState.can_catch && (
              <button className="btn" style={{ background: '#10b981', padding: '6px 14px', fontSize: '0.85rem' }} onClick={handleCatchUno}>
                Bắt lỗi UNO!
              </button>
            )}
          </div>
          
          <div className="cards-hand opponent-hand" style={{ pointerEvents: 'none' }}>
            {Array.from({ length: gameState.opponent_card_count }).map((_, i) => (
              <div key={i} className="uno-card-wrapper Đỏ">
                 <div className="uno-card-inner" style={{background: '#e11d48'}}>
                    <div className="uno-card-oval" style={{background: '#be123c', boxShadow: 'none'}}></div>
                    <div className="uno-card-center-value" style={{color: '#facc15', textShadow: '2px 2px 0px rgba(0,0,0,0.5)', fontSize: '1.6rem', transform: 'rotate(-25deg)', textAlign: 'center'}}>UNO</div>
                 </div>
              </div>
            ))}
          </div>
          
          {/* Thanh thời gian đối thủ */}
          <div style={{ width: '100%', maxWidth: '400px' }}>
            {renderTimerBar(!gameState.is_my_turn)}
          </div>
        </div>

        {/* === KHU VỰC GIỮA === */}
        <div className="center-area">
          <div className="messages glass-panel">
            <h3 style={{ textTransform: 'uppercase', fontSize: '0.7rem', marginBottom: '5px', opacity: 0.7 }}>Nhật ký</h3>
            {gameState.messages?.slice(-5).map((m, i) => (
              <div key={i} className="message-item">- {m}</div>
            ))}
          </div>

          <div className="pile-container">
            <div style={{ fontWeight: 600, color: 'var(--pink-dark)', fontSize: '0.85rem' }}>Bộ bài</div>
            <UnoCard isDrawDeck={true} drawStack={gameState.draw_stack} onClick={handleDrawCard} color="Đỏ" value="UNO" type="number" />
          </div>

          <div className="pile-container">
            <div style={{ fontWeight: 600, color: 'var(--pink-dark)', fontSize: '0.85rem' }}>Đã đánh</div>
            {gameState.last_played_card ? (
              <UnoCard 
                color={gameState.last_played_card.color}
                value={gameState.last_played_card.value}
                type={gameState.last_played_card.type}
              />
            ) : (
              <div className="deck-placeholder">Empty</div>
            )}
          </div>
        </div>

        {/* === NGƯỜI CHƠI === */}
        <div className="player-area">
          {/* Thanh thời gian của mình */}
          <div style={{ width: '100%', maxWidth: '400px' }}>
            {renderTimerBar(gameState.is_my_turn)}
          </div>

          <div className="action-bar">
            {gameState.is_my_turn && gameState.draw_stack > 0 ? (
               <button className="btn" style={{ background: '#e11d48', animation: 'pulse 1s infinite' }} onClick={handleDrawCard}>
                 CHỊU PHẠT {gameState.draw_stack} LÁ
               </button>
            ) : gameState.has_drawn && gameState.is_my_turn ? (
               <button className="btn" style={{ background: '#6b7280' }} onClick={() => socket.emit('pass_turn', {})}>
                 BỎ LƯỢT
               </button>
            ) : null}
            
            <div className="glass-panel status-badge" style={{ background: gameState.is_my_turn ? '#fda4af' : 'white' }}>
              {gameState.is_my_turn ? "LƯỢT CỦA BẠN" : "Đợi đối thủ..."}
            </div>
            
            {(gameState.hand?.length === 1) && (
              <button className="btn" style={{ background: '#f59e0b', animation: 'pulse 0.5s infinite alternate' }} onClick={handleCallUno}>
                HÔ UNO!
              </button>
            )}
          </div>

          <div className="cards-hand">
            {gameState.hand?.map((card, index) => (
              <UnoCard 
                key={index}
                color={card.color}
                value={card.value}
                type={card.type}
                onClick={() => handlePlayCard(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
