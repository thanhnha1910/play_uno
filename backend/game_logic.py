import random
import time

COLORS = ['Đỏ', 'Vàng', 'Xanh lá', 'Xanh dương']
VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Mất lượt', 'Đổi chiều', '+2']
WILD_VALUES = ['Đổi màu', '+4']

def create_deck():
    deck = []
    for color in COLORS:
        deck.append({'color': color, 'value': '0', 'type': 'number'})
        for value in VALUES[1:]:
            type_val = 'action' if value in ['Mất lượt', 'Đổi chiều', '+2'] else 'number'
            deck.append({'color': color, 'value': value, 'type': type_val})
            deck.append({'color': color, 'value': value, 'type': type_val})
            
    for _ in range(4):
        deck.append({'color': 'Đen', 'value': 'Đổi màu', 'type': 'wild'})
        deck.append({'color': 'Đen', 'value': '+4', 'type': 'wild'})
        
    random.shuffle(deck)
    return deck

class UnoGame:
    def __init__(self):
        self.players = [] # Danh sách id (tối đa 2)
        self.player_info = {} # key: player_id, value: {nickname, avatar}
        self.hands = {} # key: player_id, value: danh sách bài
        self.deck = []
        self.discard_pile = []
        self.current_turn_index = 0
        self.status = "waiting" # waiting, playing, finished
        self.winner = None
        self.draw_stack = 0 # Số lượng bài cộng dồn từ +2, +4
        self.last_played_card = None
        self.uno_status = {} # key: player_id, value: True/False đã hô Uno chưa
        self.messages = []
        self.turn_deadline = 0
        self.has_drawn_this_turn = False

    def log(self, msg):
        self.messages.append(msg)
        if len(self.messages) > 10:
            self.messages.pop(0)

    def add_player(self, player_id, nickname='Player', avatar='🐱'):
        if len(self.players) < 2 and player_id not in self.players:
            self.players.append(player_id)
            self.player_info[player_id] = {'nickname': nickname, 'avatar': avatar}
            self.uno_status[player_id] = False
            return True
        return False

    def remove_player(self, player_id):
        if player_id in self.players:
            self.players.remove(player_id)
            if self.status == "playing":
                self.status = "finished"
                self.winner = self.players[0] if self.players else None
                self.log("Đối thủ đã thoát.")

    def start_game(self):
        if len(self.players) == 2:
            self.deck = create_deck()
            for p in self.players:
                self.hands[p] = [self.deal_card() for _ in range(7)]
                self.uno_status[p] = False
                
            # Lật bài đầu tiên (không cho bài action để đơn giản)
            while True:
                card = self.deal_card()
                if card['type'] == 'number':
                    self.discard_pile.append(card)
                    self.last_played_card = card
                    break
                else:
                    self.deck.append(card)
                    random.shuffle(self.deck)
            
            self.current_turn_index = random.choice([0, 1])
            self.status = "playing"
            self.draw_stack = 0
            self.winner = None
            self.messages = []
            self.turn_deadline = time.time() + 15  # 15s cho lượt đầu
            self.has_drawn_this_turn = False
            self.log("Trận đấu bắt đầu!")
            return True
        return False

    def deal_card(self):
        if len(self.deck) == 0:
            top_card = self.discard_pile.pop()
            self.deck = self.discard_pile
            self.discard_pile = [top_card]
            for c in self.deck:
                if c['type'] == 'wild':
                    c['color'] = 'Đen'
            random.shuffle(self.deck)
        return self.deck.pop()

    def get_current_player(self):
        return self.players[self.current_turn_index]

    def switch_turn(self, skip=False):
        if not skip:
            self.current_turn_index = 1 - self.current_turn_index
        self.turn_deadline = time.time() + 15
        self.has_drawn_this_turn = False

    def check_timeout(self):
        # Hàm kiểm tra và xử lý timeout. Trả về True nếu bị timeout và đã tự xử lý
        if self.status == "playing" and time.time() >= self.turn_deadline:
            curr_player = self.get_current_player()
            if self.draw_stack > 0:
                self.log(f"Hết 15s! Bị ép phạt rút {self.draw_stack} lá.")
            else:
                self.log(f"Đã hết 15s! Hệ thống tự động bắt phạt rút bài.")
            self.draw_cards(curr_player, is_timeout=True)
            return True
        return False

    def can_play(self, card, is_stack_response=False):
        top_card = self.last_played_card
        if self.draw_stack > 0:
            # Luật tự do Stack: Có màu +2 hoặc +4 đều được phép đập xuống bất kể dưới là gì
            if card['value'] in ['+2', '+4']:
                return True
            return False

        if card['type'] == 'wild':
            return True
        
        return card['color'] == top_card['color'] or card['value'] == top_card['value']

    def pass_turn(self, player_id):
        if self.status == "playing" and player_id == self.get_current_player() and self.has_drawn_this_turn:
            self.log("Người chơi bỏ qua lượt mồi.")
            self.switch_turn(skip=False)
            return True
        return False

    def play_card(self, player_id, card_index, chosen_color=None):
        if self.status != "playing" or player_id != self.get_current_player():
            return False, "Không phải lượt của bạn!"

        hand = self.hands[player_id]
        if card_index < 0 or card_index >= len(hand):
            return False, "Lá bài không hợp lệ."

        card = hand[card_index]

        if not self.can_play(card):
            return False, "Không thể đánh lá bài này."

        hand.pop(card_index)
        
        if len(hand) != 1:
            self.uno_status[player_id] = False

        if card['type'] == 'wild':
            if card['value'] == '+4':
                # +4 không có quyền đổi màu, kế thừa màu của bộ bài bên dưới
                card['color'] = self.last_played_card['color']
            else:
                if chosen_color not in COLORS:
                    chosen_color = self.last_played_card['color']
                card['color'] = chosen_color

        self.discard_pile.append(card)
        self.last_played_card = card

        skip_next = False
        
        if card['value'] == '+2':
            self.draw_stack += 2
        elif card['value'] == '+4':
            self.draw_stack += 4
        elif card['value'] in ['Mất lượt', 'Đổi chiều']:
            skip_next = True

        self.log(f"Đánh lá {card['value']} {card['color']}")

        if len(hand) == 0:
            self.status = "finished"
            self.winner = player_id
            self.log("Trận đấu kết thúc!")
            return True, "Thắng!"

        self.switch_turn(skip=skip_next)
        return True, "Đánh bài thành công."

    def deal_card_smart(self):
        """50% rút được lá chơi được, 50% ngẫu nhiên — cân bằng game"""
        if random.random() < 0.5 and self.last_played_card:
            playable_indices = [i for i, c in enumerate(self.deck) if self.can_play(c)]
            if playable_indices:
                idx = random.choice(playable_indices)
                return self.deck.pop(idx)
        return self.deal_card()

    def draw_cards(self, player_id, is_timeout=False):
        if self.status != "playing" or player_id != self.get_current_player():
            return False, "Không phải lượt của bạn!"

        if self.has_drawn_this_turn and not is_timeout:
            return False, "Bạn nhận được 1 lượt mồi. Hãy đánh hoặc Bỏ lượt!"

        if self.draw_stack > 0:
            drawn_cards = []
            for _ in range(self.draw_stack):
                drawn_cards.append(self.deal_card())  # Phạt = random thuần
            self.hands[player_id].extend(drawn_cards)
            self.log(f"Bị phạt cộng dồn {self.draw_stack} lá.")
            self.draw_stack = 0
            self.switch_turn(skip=False) 
            self.uno_status[player_id] = False
            return True, drawn_cards
            
        else:
            # Rút thông minh — 50/50
            drawn_card = self.deal_card_smart()
            self.hands[player_id].append(drawn_card)
            
            if is_timeout:
                self.log("Hết giờ! Bị phạt rút 1 lá và mất lượt.")
                self.switch_turn(skip=False)
            else:
                if self.can_play(drawn_card):
                    self.log("Rút trúng bài hợp lệ! Thêm 15s suy nghĩ.")
                    self.has_drawn_this_turn = True
                    self.turn_deadline = time.time() + 15
                else:
                    self.log("Rút 1 lá không khớp. Chuyển lượt!")
                    self.switch_turn(skip=False)
            
            self.uno_status[player_id] = False
            return True, [drawn_card]

    def call_uno(self, player_id):
        if self.status == "playing" and player_id in self.players:
            if (len(self.hands[player_id]) == 1 or len(self.hands[player_id]) == 2) and not self.uno_status[player_id]:
                self.uno_status[player_id] = True
                self.log("Một người chơi đã hô UNO!")
                return True, "Bạn đã hô UNO!"
        return False, "Không thể hô UNO lúc này."

    def catch_uno(self, player_id):
        if self.status == "playing":
            opponent_idx = 1 - self.players.index(player_id)
            opponent = self.players[opponent_idx]
            if len(self.hands[opponent]) == 1 and not self.uno_status[opponent]:
                self.hands[opponent].append(self.deal_card())
                self.hands[opponent].append(self.deal_card())
                self.log("Bắt lỗi UNO thành công! Đối thủ bị phạt 2 lá.")
                return True, "Bắt lỗi thành công!"
        return False, "Không có ai quên hô UNO."

    def get_state_for_player(self, player_id):
        opponent_idx = 1 - self.players.index(player_id) if player_id in self.players and len(self.players) == 2 else None
        opponent = self.players[opponent_idx] if opponent_idx is not None else None
        
        # Tính toán turn_time_left để gửi về frontend
        time_left = max(0, int(self.turn_deadline - time.time())) if self.status == 'playing' else 0
        
        # Tính toán playable cards nếu là lượt của player
        is_my_turn = self.get_current_player() == player_id if self.status == 'playing' else False
        hand = self.hands.get(player_id, [])
        playable_indices = []
        if is_my_turn and self.status == 'playing':
            for i, card in enumerate(hand):
                if self.can_play(card):
                    playable_indices.append(i)
        
        # Fix winner logic
        if self.winner:
            winner_val = True if self.winner == player_id else False
        else:
            winner_val = None
        
        return {
            'status': self.status,
            'is_my_turn': is_my_turn,
            'has_drawn': self.has_drawn_this_turn if self.get_current_player() == player_id else False,
            'hand': hand,
            'opponent_card_count': len(self.hands.get(opponent, [])) if opponent else 0,
            'last_played_card': self.last_played_card,
            'draw_stack': self.draw_stack,
            'messages': self.messages[-3:],
            'winner': winner_val,
            'can_catch': opponent and len(self.hands.get(opponent, [])) == 1 and not self.uno_status.get(opponent, False),
            'time_left': time_left,
            'uno_called': self.uno_status.get(player_id, False),
            'playable_indices': playable_indices,
            'my_info': self.player_info.get(player_id, {'nickname': 'You', 'avatar': '🐱'}),
            'opponent_info': self.player_info.get(opponent, {'nickname': 'Opponent', 'avatar': '🐶'}) if opponent else None,
            'player_count': len(self.players)
        }
