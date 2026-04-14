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
    def __init__(self, max_players=2):
        self.max_players = max(2, min(4, max_players))  # Clamp 2-4
        self.players = []
        self.player_info = {}
        self.hands = {}
        self.deck = []
        self.discard_pile = []
        self.current_turn_index = 0
        self.play_direction = 1   # 1 = clockwise, -1 = counter-clockwise
        self.status = "waiting"
        self.winner = None
        self.final_rankings = []  # [{player_id, nickname, avatar, card_count, rank}]
        self.draw_stack = 0
        self.last_played_card = None
        self.uno_status = {}
        self.messages = []
        self.turn_deadline = 0
        self.has_drawn_this_turn = False

    def log(self, msg):
        self.messages.append(msg)
        if len(self.messages) > 10:
            self.messages.pop(0)

    def add_player(self, player_id, nickname='Player', avatar='🐱'):
        if len(self.players) < self.max_players and player_id not in self.players:
            self.players.append(player_id)
            self.player_info[player_id] = {'nickname': nickname, 'avatar': avatar}
            self.uno_status[player_id] = False
            return True
        return False

    def remove_player(self, player_id):
        if player_id in self.players:
            self.players.remove(player_id)
            if player_id in self.hands:
                del self.hands[player_id]
            if player_id in self.player_info:
                del self.player_info[player_id]
            if player_id in self.uno_status:
                del self.uno_status[player_id]
            
            if self.status == "playing":
                # Nếu chỉ còn 1 người → thắng
                if len(self.players) <= 1:
                    self.status = "finished"
                    self.winner = self.players[0] if self.players else None
                    self.log("Đối thủ đã thoát. Trận đấu kết thúc!")
                else:
                    # Fix turn index nếu cần
                    if self.current_turn_index >= len(self.players):
                        self.current_turn_index = 0
                    self.log("Một người chơi đã rời phòng.")

    def start_game(self):
        if len(self.players) >= 2:
            self.deck = create_deck()
            for p in self.players:
                self.hands[p] = [self.deal_card() for _ in range(7)]
                self.uno_status[p] = False
                
            # Lật bài đầu tiên (chỉ cho number)
            while True:
                card = self.deal_card()
                if card['type'] == 'number':
                    self.discard_pile.append(card)
                    self.last_played_card = card
                    break
                else:
                    self.deck.append(card)
                    random.shuffle(self.deck)
            
            self.current_turn_index = random.randint(0, len(self.players) - 1)
            self.play_direction = 1
            self.status = "playing"
            self.draw_stack = 0
            self.winner = None
            self.final_rankings = []
            self.messages = []
            self.turn_deadline = time.time() + 15
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
        n = len(self.players)
        if n <= 1:
            return
        steps = 2 if skip else 1
        self.current_turn_index = (self.current_turn_index + self.play_direction * steps) % n
        self.turn_deadline = time.time() + 15
        self.has_drawn_this_turn = False

    def check_timeout(self):
        if self.status == "playing" and time.time() >= self.turn_deadline:
            curr_player = self.get_current_player()
            if self.draw_stack > 0:
                self.log(f"Hết 15s! Bị ép phạt rút {self.draw_stack} lá.")
            else:
                self.log("Đã hết 15s! Hệ thống tự động bắt phạt rút bài.")
            self.draw_cards(curr_player, is_timeout=True)
            return True
        return False

    def can_play(self, card, is_stack_response=False):
        top_card = self.last_played_card
        if self.draw_stack > 0:
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
        elif card['value'] == 'Mất lượt':
            skip_next = True
        elif card['value'] == 'Đổi chiều':
            if len(self.players) == 2:
                # 2 người: Đổi chiều = Mất lượt
                skip_next = True
            else:
                # 3-4 người: đảo chiều kim đồng hồ
                self.play_direction *= -1

        info = self.player_info.get(player_id, {})
        name = info.get('nickname', 'Player')
        self.log(f"{name} đánh lá {card['value']} {card['color']}")

        if len(hand) == 0:
            self.status = "finished"
            self.winner = player_id
            self._compute_rankings(player_id)
            self.log(f"{name} đã thắng!")
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
                drawn_cards.append(self.deal_card())
            self.hands[player_id].extend(drawn_cards)
            self.log(f"Bị phạt cộng dồn {self.draw_stack} lá.")
            self.draw_stack = 0
            self.switch_turn(skip=False) 
            self.uno_status[player_id] = False
            return True, drawn_cards
            
        else:
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
                info = self.player_info.get(player_id, {})
                self.log(f"{info.get('nickname', 'Player')} đã hô UNO!")
                return True, "Bạn đã hô UNO!"
        return False, "Không thể hô UNO lúc này."

    def catch_uno(self, catcher_id):
        """Bắt bất kỳ ai quên hô UNO (có 1 lá mà chưa hô)"""
        if self.status != "playing":
            return False, "Game chưa bắt đầu."
        
        for pid in self.players:
            if pid == catcher_id:
                continue
            if len(self.hands.get(pid, [])) == 1 and not self.uno_status.get(pid, False):
                self.hands[pid].append(self.deal_card())
                self.hands[pid].append(self.deal_card())
                info_catcher = self.player_info.get(catcher_id, {})
                info_caught = self.player_info.get(pid, {})
                self.log(f"{info_catcher.get('nickname', '?')} bắt lỗi {info_caught.get('nickname', '?')}! Phạt 2 lá.")
                return True, "Bắt lỗi thành công!"
        
        return False, "Không có ai quên hô UNO."

    def _compute_rankings(self, winner_id):
        """Compute final rankings when game ends.
        Winner = 0 cards (rank 1). Loser = most cards (last rank)."""
        results = []
        for pid in self.players:
            info = self.player_info.get(pid, {})
            card_count = len(self.hands.get(pid, []))
            results.append({
                'player_id': pid,
                'nickname': info.get('nickname', 'Player'),
                'avatar': info.get('avatar', '🐱'),
                'card_count': card_count,
            })
        # Sort by card count ascending: winner first, loser last
        results.sort(key=lambda x: x['card_count'])
        for i, r in enumerate(results):
            r['rank'] = i + 1
        self.final_rankings = results

    def get_state_for_player(self, player_id):
        """Trả state cá nhân cho mỗi player"""
        time_left = max(0, int(self.turn_deadline - time.time())) if self.status == 'playing' else 0
        
        is_my_turn = (self.get_current_player() == player_id) if self.status == 'playing' else False
        hand = self.hands.get(player_id, [])
        
        playable_indices = []
        if is_my_turn and self.status == 'playing':
            for i, card in enumerate(hand):
                if self.can_play(card):
                    playable_indices.append(i)
        
        # Winner / Loser
        if self.winner:
            winner_val = True if self.winner == player_id else False
            # Am I the loser? (most cards = last in rankings)
            loser_id = self.final_rankings[-1]['player_id'] if self.final_rankings else None
            loser_val = True if loser_id == player_id else False
        else:
            winner_val = None
            loser_val = False

        # Build opponents list (theo thứ tự kim đồng hồ từ player)
        opponents = []
        if len(self.players) >= 2:
            my_idx = self.players.index(player_id) if player_id in self.players else 0
            n = len(self.players)
            for offset in range(1, n):
                opp_idx = (my_idx + offset) % n
                opp_id = self.players[opp_idx]
                opp_is_active = (self.get_current_player() == opp_id) if self.status == 'playing' else False
                can_catch_this = len(self.hands.get(opp_id, [])) == 1 and not self.uno_status.get(opp_id, False)
                opponents.append({
                    'info': self.player_info.get(opp_id, {'nickname': 'Player', 'avatar': '🐶'}),
                    'card_count': len(self.hands.get(opp_id, [])),
                    'is_active': opp_is_active,
                    'can_catch': can_catch_this,
                })

        # Waiting room: trả danh sách player info
        waiting_players = []
        if self.status == 'waiting':
            for pid in self.players:
                waiting_players.append(self.player_info.get(pid, {}))

        return {
            'status': self.status,
            'is_my_turn': is_my_turn,
            'has_drawn': self.has_drawn_this_turn if (self.status == 'playing' and self.get_current_player() == player_id) else False,
            'hand': hand,
            'opponents': opponents,
            'last_played_card': self.last_played_card,
            'draw_stack': self.draw_stack,
            'messages': self.messages[-3:],
            'winner': winner_val,
            'loser': loser_val,
            'final_rankings': self.final_rankings if self.status == 'finished' else [],
            'time_left': time_left,
            'uno_called': self.uno_status.get(player_id, False),
            'playable_indices': playable_indices,
            'my_info': self.player_info.get(player_id, {'nickname': 'You', 'avatar': '🐱'}),
            'player_count': len(self.players),
            'max_players': self.max_players,
            'waiting_players': waiting_players,
            'play_direction': self.play_direction,
        }
