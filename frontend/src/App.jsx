import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.PROD ? "" : "http://localhost:10000";
const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnectionDelay: 1000,
  reconnectionDelayMax: 3000,
});

const AVATARS = ['🐱', '🐶', '🦊', '🐸', '🐼', '🐨', '🦁', '🐯', '🐰', '🐻', '🐷', '🦄'];

// ============================================================
// MEMOIZED: UnoCard
// ============================================================
const UnoCard = memo(({ color, value, type, onClick, isDrawDeck, drawStack, isHinted, index }) => {
  const colorClass = color.replace(' xanh', '').replace(' lá', '-lá').replace(' dương', '-dương');
  
  let displayValue = value;
  let cornerValue = value;
  
  if (value === 'Mất lượt') { displayValue = '⊘'; cornerValue = '⊘'; }
  if (value === 'Đổi chiều') { displayValue = '⇄'; cornerValue = '⇄'; }
  if (value === '+2') { displayValue = '+2'; cornerValue = '+2'; }
  if (value === '+4') { displayValue = '+4'; cornerValue = '+4'; }
  if (value === 'Đổi màu') { displayValue = 'WILD'; cornerValue = ''; }

  if (isDrawDeck) {
    return (
      <div className="uno-card-wrapper Đen" onClick={onClick}>
        <div className="uno-card-inner draw-deck-inner">
          <div className="uno-card-oval draw-deck-oval"></div>
          <div className="draw-deck-label">
            UNO
            {drawStack > 0 && <div className="draw-stack-num">+{drawStack}</div>}
          </div>
        </div>
      </div>
    );
  }

  const cls = `uno-card-wrapper ${colorClass}${isHinted ? ' card-hinted' : ''}`;

  return (
    <div className={cls} data-index={index}>
      <div className="uno-card-inner">
        <div className="uno-card-corner uno-card-top-left">{cornerValue}</div>
        <div className="uno-card-oval"></div>
        <div className="uno-card-center-value">{displayValue}</div>
        <div className="uno-card-corner uno-card-bottom-right">{cornerValue}</div>
        {type === 'wild' && color !== 'Đen' && <div className="wild-color-label">{color}</div>}
      </div>
    </div>
  );
});

// ============================================================
// MEMOIZED: Opponent back-card
// ============================================================
const OpponentCard = memo(() => (
  <div className="uno-card-wrapper Đỏ card-small">
    <div className="uno-card-inner draw-deck-inner">
      <div className="uno-card-oval draw-deck-oval"></div>
      <div className="draw-deck-label" style={{fontSize: '0.9rem'}}>UNO</div>
    </div>
  </div>
));

// ============================================================
// MEMOIZED: PlayerBadge
// ============================================================
const PlayerBadge = memo(({ info, cardCount, isActive, isSelf, timer, maxTime, canCatch, onCatch, compact }) => {
  const timerPct = maxTime > 0 ? Math.max(0, Math.min(100, (timer / maxTime) * 100)) : 0;
  const timerColor = timer <= 5 ? '#e11d48' : (timer <= 10 ? '#f59e0b' : '#10b981');

  return (
    <div className={`player-badge${isActive ? ' badge-active' : ''}${isSelf ? ' badge-self' : ''}${compact ? ' badge-compact' : ''}`}>
      {isActive && <div className="badge-turn-dot" />}
      <div className="badge-avatar-wrap">
        <div className="badge-avatar" style={isActive ? { boxShadow: `0 0 0 3px ${timerColor}, 0 0 12px ${timerColor}` } : undefined}>{info?.avatar || '🐱'}</div>
      </div>
      <div className="badge-info">
        <div className="badge-name">{info?.nickname || 'Player'}</div>
        <div className="badge-cards">{cardCount} lá</div>
        {isActive && !isSelf && <div className="badge-turn-label">Đang đánh...</div>}
      </div>
      {canCatch && (
        <button className="btn catch-btn" onClick={onCatch}>Bắt!</button>
      )}
      {isActive && (
        <div className="badge-timer-bar">
          <div className="badge-timer-fill" style={{ width: `${timerPct}%`, backgroundColor: timerColor }} />
          <span className="badge-timer-text">{timer}s</span>
        </div>
      )}
    </div>
  );
});

// ============================================================
// APP
// ============================================================
function App() {
  const [gameState, setGameState] = useState({ status: 'login' });
  const [errorMsg, setErrorMsg] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCardIndex, setPendingCardIndex] = useState(null);
  const [roomInput, setRoomInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🐱');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [localTime, setLocalTime] = useState(0);
  const [showUnoEffect, setShowUnoEffect] = useState(false);

  // Socket listeners
  useEffect(() => {
    const onState = (data) => setGameState(data);
    const onError = (data) => {
      setErrorMsg(data.message);
      setTimeout(() => setErrorMsg(''), 3000);
    };
    const onUno = () => {
      setShowUnoEffect(true);
      setTimeout(() => setShowUnoEffect(false), 2000);
    };

    socket.on('game_state', onState);
    socket.on('error_msg', onError);
    socket.on('uno_shout', onUno);
    return () => { socket.off('game_state', onState); socket.off('error_msg', onError); socket.off('uno_shout', onUno); };
  }, []);

  // Sync server timer
  useEffect(() => {
    if (gameState.time_left !== undefined) setLocalTime(gameState.time_left);
  }, [gameState.time_left, gameState.is_my_turn]);

  // Client-side countdown
  useEffect(() => {
    if (gameState.status !== 'playing' || localTime <= 0) return;
    const id = setInterval(() => setLocalTime(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [gameState.status, localTime]);

  // Stable callbacks
  const handleJoinRoom = useCallback((e) => {
    e.preventDefault();
    const n = nickname.trim() || 'Player';
    if (roomInput.trim()) {
      socket.emit('join_room', { room_id: roomInput, nickname: n, avatar: selectedAvatar, max_players: maxPlayers });
      setGameState({ status: 'waiting', room_id: roomInput });
    }
  }, [roomInput, nickname, selectedAvatar, maxPlayers]);

  const handleHandClick = useCallback((e) => {
    if (!gameState.is_my_turn) return;
    const cardEl = e.target.closest('[data-index]');
    if (!cardEl) return;
    const index = parseInt(cardEl.dataset.index, 10);
    if (isNaN(index) || !gameState.hand?.[index]) return;
    const card = gameState.hand[index];
    if (card.type === 'wild' && card.value !== '+4') {
      setPendingCardIndex(index);
      setShowColorPicker(true);
    } else {
      socket.emit('play_card', { card_index: index });
    }
  }, [gameState.is_my_turn, gameState.hand]);

  const handleColorSelected = useCallback((color) => {
    socket.emit('play_card', { card_index: pendingCardIndex, chosen_color: color });
    setShowColorPicker(false);
    setPendingCardIndex(null);
  }, [pendingCardIndex]);

  const handleDrawCard = useCallback(() => {
    if (!gameState.is_my_turn) return;
    socket.emit('draw_card', {});
  }, [gameState.is_my_turn]);

  const handleCallUno = useCallback(() => socket.emit('call_uno', {}), []);
  const handleCatchUno = useCallback(() => socket.emit('catch_uno', {}), []);
  const handlePassTurn = useCallback(() => socket.emit('pass_turn', {}), []);

  const hintedSet = useMemo(() => new Set(gameState.playable_indices || []), [gameState.playable_indices]);

  const lastMessage = useMemo(() => {
    const msgs = gameState.messages;
    return msgs?.length > 0 ? msgs[msgs.length - 1] : null;
  }, [gameState.messages]);

  // Any opponent catchable?
  const anyCatchable = useMemo(() => {
    return gameState.opponents?.some(o => o.can_catch) || false;
  }, [gameState.opponents]);

  // ============ LOGIN ============
  if (gameState.status === 'login') {
    return (
      <div className="app-container">
        <div className="glass-panel lobby">
          <h1>UNO</h1>
          <p className="lobby-sub">Cùng bạn bè chơi UNO!</p>
          <div className="avatar-picker">
            <div className="avatar-selected">{selectedAvatar}</div>
            <div className="avatar-grid">
              {AVATARS.map(av => (
                <div key={av} className={`avatar-option${selectedAvatar === av ? ' avatar-active' : ''}`} onClick={() => setSelectedAvatar(av)}>{av}</div>
              ))}
            </div>
          </div>

          {/* Room size selector */}
          <div className="room-size-picker">
            <label className="room-size-label">Số người chơi</label>
            <div className="room-size-options">
              {[2, 3, 4].map(n => (
                <button
                  key={n}
                  className={`room-size-btn${maxPlayers === n ? ' room-size-active' : ''}`}
                  onClick={() => setMaxPlayers(n)}
                  type="button"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="lobby-form">
            <input type="text" placeholder="Biệt danh..." value={nickname} onChange={e => setNickname(e.target.value)} maxLength={12} className="input-field" />
            <input type="text" placeholder="Mã Phòng..." value={roomInput} onChange={e => setRoomInput(e.target.value)} className="input-field" />
            <button className="btn btn-primary" type="submit">Vào Phòng</button>
          </form>
        </div>
      </div>
    );
  }

  // ============ WAITING ============
  if (gameState.status === 'waiting') {
    const wp = gameState.waiting_players || [];
    const mp = gameState.max_players || maxPlayers;
    return (
      <div className="app-container">
        <div className="glass-panel lobby">
          <h2 style={{color: 'var(--pink-dark)'}}>Phòng chờ</h2>
          <p style={{marginTop: '6px'}}>Mã phòng: <strong className="room-code">{(gameState.room_id || roomInput)?.toUpperCase()}</strong></p>
          <p className="lobby-sub">Chế độ {mp} người chơi</p>

          {wp.length > 0 ? (
            <div className="waiting-players">
              {wp.map((p, i) => (
                <div key={i} className="waiting-player-chip">
                  <span className="waiting-avatar">{p.avatar}</span>
                  <span>{p.nickname}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="waiting-players">
              <div className="waiting-player-chip">
                <span className="waiting-avatar">{selectedAvatar}</span>
                <span>{nickname || 'Player'}</span>
              </div>
            </div>
          )}

          <p style={{opacity: 0.7, fontSize: '0.85rem', marginTop: '8px'}}>
            {wp.length > 0 ? `${wp.length}/${mp}` : `1/${mp}`} — Đang chờ thêm người...
          </p>
          <div className="spinner"></div>
          <button className="btn" style={{marginTop: '12px', background: '#6b7280'}} onClick={() => window.location.reload()}>Quay Lại</button>
        </div>
      </div>
    );
  }

  // ============ FINISHED ============
  if (gameState.status === 'finished') {
    const didWin = gameState.winner === true;
    return (
      <div className="app-container">
        <div className="glass-panel lobby">
          <div className="avatar-selected" style={{fontSize: '4rem'}}>{didWin ? '🎉' : '💔'}</div>
          <h1 style={{marginTop: '10px'}}>{didWin ? "BẠN THẮNG!" : "THUA RỒI!"}</h1>
          <p style={{opacity: 0.7, marginTop: '5px'}}>{didWin ? 'Xuất sắc lắm!' : 'Lần sau sẽ may mắn hơn!'}</p>
          <button className="btn btn-primary" style={{marginTop: '20px'}} onClick={() => window.location.reload()}>Chơi Lại</button>
        </div>
      </div>
    );
  }

  // ============ GAME (2-4 players) ============
  const opponents = gameState.opponents || [];

  // Assign positions based on player count
  // 2p: top only. 3p: left + right. 4p: left + top + right.
  const assignPositions = () => {
    if (opponents.length === 1) return ['top'];
    if (opponents.length === 2) return ['left', 'right'];
    if (opponents.length === 3) return ['left', 'top', 'right'];
    return [];
  };
  const positions = assignPositions();

  // Build slot map for grid areas
  const slotMap = { top: null, left: null, right: null };
  opponents.forEach((opp, i) => {
    const pos = positions[i];
    if (pos) slotMap[pos] = { ...opp, idx: i };
  });

  const renderOpponentSlot = (pos) => {
    const opp = slotMap[pos];
    if (!opp) return null;

    const maxCards = pos === 'top' ? 8 : 6;
    return (
      <div className={`table-pos-${pos}`}>
        <div className="opponent-slot">
          <PlayerBadge
            info={opp.info}
            cardCount={opp.card_count}
            isActive={opp.is_active}
            isSelf={false}
            timer={opp.is_active ? localTime : 0}
            maxTime={15}
            canCatch={opp.can_catch}
            onCatch={handleCatchUno}
            compact={true}
          />
          <div className={`cards-hand opponent-hand opp-hand-${pos}`}>
            {Array.from({ length: Math.min(opp.card_count, maxCards) }).map((_, j) => (
              <OpponentCard key={j} />
            ))}
            {opp.card_count > maxCards && <span className="opp-extra-count">+{opp.card_count - maxCards}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container game-active">
      {errorMsg && <div className="error-toast">{errorMsg}</div>}

      {showUnoEffect && (
        <div className="uno-overlay"><h1 className="uno-shout-text">UNO!</h1></div>
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
            <button className="btn" style={{background: '#6b7280'}} onClick={() => setShowColorPicker(false)}>Huỷ</button>
          </div>
        </div>
      )}

      {lastMessage && <div className="mini-toast">{lastMessage}</div>}

      <div className="game-table">
        {/* TOP opponent */}
        {renderOpponentSlot('top')}

        {/* LEFT opponent */}
        {renderOpponentSlot('left')}

        {/* CENTER — pile + deck */}
        <div className="center-area table-center">
          <div className="pile-container">
            <UnoCard isDrawDeck drawStack={gameState.draw_stack} onClick={handleDrawCard} color="Đỏ" value="UNO" type="number" />
            <div className="pile-label">Bộ bài</div>
          </div>
          <div className="pile-container">
            {gameState.last_played_card ? (
              <UnoCard color={gameState.last_played_card.color} value={gameState.last_played_card.value} type={gameState.last_played_card.type} />
            ) : (
              <div className="deck-placeholder">—</div>
            )}
            <div className="pile-label">Đã đánh</div>
          </div>
          {opponents.length >= 2 && (
            <div className="direction-indicator" title={gameState.play_direction === 1 ? 'Thuận' : 'Ngược'}>
              {gameState.play_direction === 1 ? '↻ Thuận' : '↺ Ngược'}
            </div>
          )}
        </div>

        {/* RIGHT opponent */}
        {renderOpponentSlot('right')}

        {/* BOTTOM — current player */}
        <div className={`player-area table-pos-bottom${gameState.is_my_turn ? ' my-turn-active' : ''}`}>
          {gameState.is_my_turn && (
            <div className="my-turn-banner">
              <span className="my-turn-icon">👆</span>
              <span>LƯỢT CỦA BẠN</span>
            </div>
          )}
          {!gameState.is_my_turn && (
            <div className="waiting-turn-label">Đang chờ đối thủ...</div>
          )}

          <div className="action-bar">
            {gameState.is_my_turn && gameState.draw_stack > 0 ? (
              <button className="btn btn-danger pulse-anim" onClick={handleDrawCard}>CHỊU PHẠT {gameState.draw_stack} LÁ</button>
            ) : gameState.has_drawn && gameState.is_my_turn ? (
              <button className="btn btn-secondary" onClick={handlePassTurn}>BỎ LƯỢT</button>
            ) : null}
            {gameState.hand?.length <= 2 && gameState.hand?.length >= 1 && !gameState.uno_called && (
              <button className="btn btn-uno pulse-anim" onClick={handleCallUno}>HÔ UNO!</button>
            )}
          </div>

          <div className="cards-hand" onClick={handleHandClick}>
            {gameState.hand?.map((card, index) => (
              <UnoCard
                key={`${card.color}-${card.value}-${index}`}
                color={card.color}
                value={card.value}
                type={card.type}
                index={index}
                isHinted={gameState.is_my_turn && hintedSet.has(index)}
              />
            ))}
          </div>

          <PlayerBadge
            info={gameState.my_info}
            cardCount={gameState.hand?.length || 0}
            isActive={gameState.is_my_turn}
            isSelf
            timer={gameState.is_my_turn ? localTime : 0}
            maxTime={15}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
