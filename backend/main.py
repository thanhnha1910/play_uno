from fastapi import FastAPI
import socketio
from game_logic import UnoGame

app = FastAPI()

# Cấu hình Socket.IO với CORS cho phép kết nối từ React frontend
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

games = {} # room_id -> UnoGame
player_rooms = {} # sid -> room_id

@sio.event
async def connect(sid, environ):
    print(f"Người chơi {sid} đã kết nối.")

@sio.event
async def disconnect(sid):
    print(f"Người chơi {sid} đã ngắt kết nối.")
    if sid in player_rooms:
        room_id = player_rooms[sid]
        game = games[room_id]
        game.remove_player(sid)
        del player_rooms[sid]
        await broadcast_state(room_id)
        if len(game.players) == 0:
            del games[room_id]

@sio.event
async def join_room(sid, data):
    room_id = data.get('room_id')
    if not room_id:
        await sio.emit('error_msg', {'message': "Vui lòng nhập mã phòng!"}, to=sid)
        return
        
    room_id = room_id.strip().lower()
    
    if room_id not in games:
        games[room_id] = UnoGame()
        
    game = games[room_id]
    
    if len(game.players) >= 2:
        await sio.emit('error_msg', {'message': "Phòng đã đầy (tối đa 2 người)!"}, to=sid)
        return
        
    game.add_player(sid)
    player_rooms[sid] = room_id
    sio.enter_room(sid, room_id)
    
    print(f"Người chơi {sid} đã vào phòng {room_id}. Tổng: {len(game.players)}/2")
    
    if len(game.players) == 2:
        game.start_game()
        print(f"Game bắt đầu ở phòng {room_id}!")
    
    await broadcast_state(room_id)

@sio.event
async def play_card(sid, data):
    room_id = player_rooms.get(sid)
    if not room_id: return
    game = games[room_id]
    
    card_index = data.get('card_index')
    chosen_color = data.get('chosen_color')
    
    success, msg = game.play_card(sid, card_index, chosen_color)
    if not success:
        await sio.emit('error_msg', {'message': msg}, to=sid)
    else:
        await broadcast_state(room_id)

@sio.event
async def draw_card(sid, data):
    room_id = player_rooms.get(sid)
    if not room_id: return
    game = games[room_id]
    
    success, result = game.draw_cards(sid)
    if not success:
        await sio.emit('error_msg', {'message': result}, to=sid)
    else:
        await broadcast_state(room_id)

@sio.event
async def call_uno(sid, data):
    room_id = player_rooms.get(sid)
    if not room_id: return
    game = games[room_id]
    
    success, msg = game.call_uno(sid)
    if not success:
        await sio.emit('error_msg', {'message': msg}, to=sid)
    else:
        await sio.emit('uno_shout', {}, room=room_id)
        await broadcast_state(room_id)

@sio.event
async def catch_uno(sid, data):
    room_id = player_rooms.get(sid)
    if not room_id: return
    game = games[room_id]
    
    success, msg = game.catch_uno(sid)
    if not success:
        await sio.emit('error_msg', {'message': msg}, to=sid)
    else:
        await broadcast_state(room_id)

@sio.event
async def pass_turn(sid, data):
    room_id = player_rooms.get(sid)
    if not room_id: return
    game = games[room_id]
    
    success = game.pass_turn(sid)
    if success:
        await broadcast_state(room_id)

async def broadcast_state(room_id):
    if room_id in games:
        game = games[room_id]
        for player_id in game.players:
            state = game.get_state_for_player(player_id)
            state['room_id'] = room_id
            await sio.emit('game_state', state, to=player_id)

import os
import asyncio
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Loop background kiểm tra timeout liên tục
async def timer_loop():
    while True:
        await asyncio.sleep(1)
        rooms_to_broadcast = []
        for room_id, game in list(games.items()):
            if game.status == "playing":
                if game.check_timeout():
                    rooms_to_broadcast.append(room_id)
        for room_id in rooms_to_broadcast:
            await broadcast_state(room_id)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(timer_loop())

frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    def index():
        return {"message": "Thư mục frontend/dist không tồn tại. Vui lòng build React app."}

# Dùng socket_app là entrypoint thật sự cho Uvicorn. Nó wrap app FastAPI.
socket_app = socketio.ASGIApp(sio, app)
