/**
 * Farkle game logic & UI controller
 * Classic rules with common scoring combinations
 */

const Farkle = {
  TARGET: 10000,

  state: null,

  init(mode) {
    this.state = {
      mode,
      players: [
        { name: 'You', score: 0, isAI: false },
        { name: mode === 'solo' ? 'Computer' : 'Friend', score: 0, isAI: mode === 'solo' }
      ],
      currentPlayer: 0,
      dice: [],           // current available dice values
      selected: [],       // indices selected to score this sub-roll
      turnScore: 0,       // points accumulated this turn (not yet banked)
      bankedThisTurn: 0,  // points already set aside this turn
      phase: 'start',     // start | rolling | selecting | after-score | ai
      gameOver: false
    };
    this.render();
    this.bindEvents();
    this.updateMessage(`${this.state.players[0].name}'s turn  Roll to start!`);
    this.enableRoll(true);
    this.enableBank(false);
  },

  /**
   * Analyze current dice for all possible scoring combinations
   * Returns options sorted by points descending
   */
  analyzeDice(dice) {
    const n = dice.length;
    const counts = countFaces(dice);
    const options = [];
    const used = new Array(n).fill(false);

    // Helper to add an option
    const add = (indices, points, desc) => {
      if (points > 0 && indices.length > 0) {
        options.push({ indices: [...indices].sort((a,b)=>a-b), points, description: desc });
      }
    };

    // 1. Six of a kind / five / four / three
    for (let face = 1; face <= 6; face++) {
      if (counts[face] >= 3) {
        const idxs = [];
        dice.forEach((v, i) => { if (v === face) idxs.push(i); });
        const count = counts[face];
        let pts = 0;
        if (face === 1) {
          pts = count === 3 ? 1000 : count === 4 ? 2000 : count === 5 ? 3000 : 4000;
        } else {
          pts = face * 100 * (count === 3 ? 1 : count === 4 ? 2 : count === 5 ? 3 : 4);
        }
        add(idxs.slice(0, count), pts, `${count}× ${face}`);
      }
    }

    // 2. Straight 1-6
    if (n === 6 && isStraight(dice)) {
      add([0,1,2,3,4,5], 1500, 'Straight');
    }

    // 3. Three pairs
    if (n === 6 && hasThreePairs(counts)) {
      add([0,1,2,3,4,5], 1500, 'Three pairs');
    }

    // 4. Two triplets
    if (hasTwoTriplets(counts)) {
      add([0,1,2,3,4,5], 2500, 'Two triplets');
    }

    // 5. Full house (3+2)  common house rule 1500
    if (n === 5 && hasFullHouse(counts)) {
      add([0,1,2,3,4], 1500, 'Full house');
    }

    // 6. Single 1s and 5s (always available if present)
    dice.forEach((v, i) => {
      if (v === 1) add([i], 100, 'Single 1');
      if (v === 5) add([i], 50, 'Single 5');
    });

    // Also generate combinations of singles
    // For simplicity we already have singles; player can select multiple

    // Sort by points desc, then fewer dice
    options.sort((a, b) => b.points - a.points || a.indices.length - b.indices.length);

    // Deduplicate identical index sets
    const seen = new Set();
    const unique = [];
    for (const opt of options) {
      const key = opt.indices.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(opt);
      }
    }

    return {
      scoringOptions: unique,
      maxScore: unique.length ? unique[0].points : 0,
      canScore: unique.length > 0
    };
  },

  /**
   * Calculate points for a specific selection of indices
   */
  scoreSelection(dice, indices) {
    if (!indices.length) return 0;
    const selectedDice = indices.map(i => dice[i]);
    const analysis = this.analyzeDice(selectedDice);
    // We need the score if the selection itself forms valid scoring dice
    // Re-map indices relative to selected
    // Simpler: check if the selected set scores exactly its max without leftover non-scoring
    const counts = countFaces(selectedDice);
    let points = 0;
    let remaining = selectedDice.length;

    // Take highest combinations greedily from the selection
    // This is approximate; for UX we validate that every die in selection is scoring

    // Better validation: a selection is valid only if there exists a way to score ALL of them
    // Common rule: you must set aside only scoring dice; leftover non-scoring invalidates the selection.

    // Implement proper scoring of a set:
    const used = new Array(selectedDice.length).fill(false);
    let total = 0;

    // Check specials first (whole set)
    if (selectedDice.length === 6 && isStraight(selectedDice)) return 1500;
    if (selectedDice.length === 6 && hasThreePairs(counts)) return 1500;
    if (hasTwoTriplets(counts) && selectedDice.length === 6) return 2500;
    if (selectedDice.length === 5 && hasFullHouse(counts)) return 1500;

    // Three+ of a kinds
    for (let face = 1; face <= 6; face++) {
      if (counts[face] >= 3) {
        const c = counts[face];
        if (face === 1) {
          total += c === 3 ? 1000 : c === 4 ? 2000 : c === 5 ? 3000 : 4000;
        } else {
          total += face * 100 * (c === 3 ? 1 : c === 4 ? 2 : c === 5 ? 3 : 4);
        }
        // mark them used
        let marked = 0;
        for (let i = 0; i < selectedDice.length && marked < c; i++) {
          if (selectedDice[i] === face && !used[i]) {
            used[i] = true;
            marked++;
          }
        }
      }
    }

    // Remaining singles 1 and 5
    for (let i = 0; i < selectedDice.length; i++) {
      if (used[i]) continue;
      if (selectedDice[i] === 1) { total += 100; used[i] = true; }
      else if (selectedDice[i] === 5) { total += 50; used[i] = true; }
    }

    // If any die left unused, selection is invalid (contains non-scoring die)
    if (used.some(u => !u)) return 0;
    return total;
  },

  // --- UI ---
  render() {
    this.renderPlayers();
    this.renderDice();
    this.renderScores();
  },

  renderPlayers() {
    const bar = document.getElementById('farkle-players');
    bar.innerHTML = '';
    this.state.players.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip' + (i === this.state.currentPlayer ? ' active' : '');
      chip.innerHTML = `
        <span class="name">${p.name}${p.isAI ? ' <span class="ai-tag">AI</span>' : ''}</span>
        <span class="score">${p.score}</span>
      `;
      bar.appendChild(chip);
    });
  },

  renderDice() {
    const row = document.getElementById('farkle-dice');
    row.innerHTML = '';
    if (!this.state.dice.length) {
      // Show 6 placeholder dice
      for (let i = 0; i < 6; i++) {
        const die = createDieElement(1, { disabled: true });
        die.style.opacity = '0.3';
        row.appendChild(die);
      }
      return;
    }

    this.state.dice.forEach((val, i) => {
      const isSelected = this.state.selected.includes(i);
      const die = createDieElement(val, {
        selected: isSelected,
        id: i,
        onClick: () => this.toggleSelect(i)
      });
      row.appendChild(die);
    });
  },

  renderScores() {
    document.getElementById('farkle-turn-score').textContent = this.state.turnScore + this.state.bankedThisTurn;
    document.getElementById('farkle-banked').textContent = this.state.players[this.state.currentPlayer].score;
    document.getElementById('farkle-target').textContent = this.TARGET;
  },

  updateMessage(text, type = '') {
    const el = document.getElementById('farkle-message');
    el.textContent = text;
    el.className = 'turn-message ' + type;
  },

  enableRoll(on) {
    document.getElementById('farkle-roll').disabled = !on;
  },

  enableBank(on) {
    document.getElementById('farkle-bank').disabled = !on;
  },

  bindEvents() {
    const rollBtn = document.getElementById('farkle-roll');
    const bankBtn = document.getElementById('farkle-bank');

    const newRoll = rollBtn.cloneNode(true);
    rollBtn.parentNode.replaceChild(newRoll, rollBtn);
    newRoll.addEventListener('click', () => this.onRoll());

    const newBank = bankBtn.cloneNode(true);
    bankBtn.parentNode.replaceChild(newBank, bankBtn);
    newBank.addEventListener('click', () => this.onBank());
  },

  toggleSelect(index) {
    if (this.state.phase !== 'selecting' && this.state.phase !== 'after-score') return;
    if (this.state.players[this.state.currentPlayer].isAI) return;

    const idx = this.state.selected.indexOf(index);
    if (idx >= 0) {
      this.state.selected.splice(idx, 1);
    } else {
      this.state.selected.push(index);
    }
    this.renderDice();

    // Live preview of selection score
    if (this.state.selected.length) {
      const pts = this.scoreSelection(this.state.dice, this.state.selected);
      if (pts > 0) {
        this.updateMessage(`Selection scores ${pts} pts  click Bank or Roll remaining`, 'success');
        this.enableBank(true);
        this.enableRoll(true);
      } else {
        this.updateMessage('Invalid selection  only scoring dice allowed', 'danger');
        this.enableBank(false);
        this.enableRoll(false);
      }
    } else {
      this.updateMessage('Select scoring dice to set aside');
      this.enableBank(false);
      this.enableRoll(false);
    }
  },

  async onRoll() {
    const player = this.state.players[this.state.currentPlayer];
    if (player.isAI) return;

    // If we have a valid selection, first bank those points into turn score
    if (this.state.selected.length > 0) {
      const pts = this.scoreSelection(this.state.dice, this.state.selected);
      if (pts <= 0) {
        this.updateMessage('Invalid selection', 'danger');
        return;
      }
      this.state.bankedThisTurn += pts;
      this.state.turnScore = 0; // bankedThisTurn holds it now

      // Remove scored dice
      const remaining = this.state.dice.filter((_, i) => !this.state.selected.includes(i));
      this.state.selected = [];

      // Hot dice: if all scored, get 6 back
      if (remaining.length === 0) {
        this.state.dice = [];
        this.updateMessage(`Hot dice! +${pts}  rolling all 6 again`, 'success');
        await new Promise(r => setTimeout(r, 600));
        this.state.dice = rollDice(6);
      } else {
        this.state.dice = remaining;
        this.updateMessage(`+${pts} set aside. Rolling remaining ${remaining.length}&`);
      }
    } else if (this.state.phase === 'start' || this.state.dice.length === 0) {
      // First roll of turn
      this.state.dice = rollDice(6);
      this.state.bankedThisTurn = 0;
      this.state.turnScore = 0;
    } else {
      // Rolling remaining without new selection? Not allowed
      this.updateMessage('Select scoring dice first', 'warning');
      return;
    }

    // Animate
    this.render();
    const diceEls = [...document.querySelectorAll('#farkle-dice .die')];
    await animateRoll(diceEls);

    // Final values already set; just re-render after anim
    // (animation overwrote text, so restore)
    this.renderDice();

    // Check for Farkle
    const analysis = this.analyzeDice(this.state.dice);
    if (!analysis.canScore) {
      this.updateMessage('FARKLE! Turn score lost =¥', 'danger');
      this.state.bankedThisTurn = 0;
      this.state.turnScore = 0;
      this.enableRoll(false);
      this.enableBank(false);
      await new Promise(r => setTimeout(r, 1400));
      this.endTurn(false);
      return;
    }

    this.state.phase = 'selecting';
    this.state.selected = [];
    this.updateMessage('Select scoring dice to set aside, then Roll or Bank');
    this.enableRoll(false); // until valid selection
    this.enableBank(false);
    this.render();
  },

  onBank() {
    const player = this.state.players[this.state.currentPlayer];
    if (player.isAI) return;

    if (this.state.selected.length === 0 && this.state.bankedThisTurn === 0) {
      this.updateMessage('Nothing to bank yet', 'warning');
      return;
    }

    // Score current selection if any
    let pts = 0;
    if (this.state.selected.length) {
      pts = this.scoreSelection(this.state.dice, this.state.selected);
      if (pts <= 0) {
        this.updateMessage('Invalid selection', 'danger');
        return;
      }
    }

    const totalThisTurn = this.state.bankedThisTurn + pts;
    if (totalThisTurn === 0) {
      this.updateMessage('Need at least some points to bank', 'warning');
      return;
    }

    player.score += totalThisTurn;
    this.updateMessage(`Banked ${totalThisTurn} points!`, 'success');
    this.renderScores();
    this.enableRoll(false);
    this.enableBank(false);

    // Check win
    if (player.score >= this.TARGET) {
      setTimeout(() => this.finishGame(), 800);
      return;
    }

    setTimeout(() => this.endTurn(true), 900);
  },

  endTurn(banked) {
    this.state.currentPlayer = (this.state.currentPlayer + 1) % 2;
    this.state.dice = [];
    this.state.selected = [];
    this.state.turnScore = 0;
    this.state.bankedThisTurn = 0;
    this.state.phase = 'start';

    const next = this.state.players[this.state.currentPlayer];
    this.render();

    if (next.isAI) {
      this.updateMessage('Computer is playing&');
      this.enableRoll(false);
      this.enableBank(false);
      setTimeout(() => this.runAITurn(), 800);
    } else {
      this.updateMessage(`${next.name}'s turn  Roll to start!`);
      this.enableRoll(true);
      this.enableBank(false);
    }
  },

  async runAITurn() {
    const player = this.state.players[this.state.currentPlayer];
    if (!player.isAI) return;

    this.state.phase = 'ai';
    this.state.dice = rollDice(6);
    this.state.bankedThisTurn = 0;
    this.render();

    let safety = 0;
    while (safety++ < 12) {
      const diceEls = [...document.querySelectorAll('#farkle-dice .die')];
      await animateRoll(diceEls);
      // restore values after anim
      this.renderDice();

      const analysis = this.analyzeDice(this.state.dice);
      if (!analysis.canScore) {
        this.updateMessage('Computer FARKLED! =¥', 'danger');
        await new Promise(r => setTimeout(r, 1200));
        this.endTurn(false);
        return;
      }

      const decision = AI.farkleDecide(
        this.state.dice,
        this.state.bankedThisTurn,
        player.score,
        this.TARGET,
        this.state.dice.length
      );

      if (decision.farkle) {
        this.updateMessage('Computer FARKLED! =¥', 'danger');
        await new Promise(r => setTimeout(r, 1200));
        this.endTurn(false);
        return;
      }

      // Apply set aside
      const pts = decision.points;
      this.state.bankedThisTurn += pts;

      // Highlight selected briefly
      this.state.selected = decision.setAside;
      this.renderDice();
      this.updateMessage(`Computer sets aside ${pts} pts`, 'success');
      await new Promise(r => setTimeout(r, 900));

      // Remove scored
      const remaining = this.state.dice.filter((_, i) => !decision.setAside.includes(i));
      this.state.selected = [];

      if (decision.bank || player.score + this.state.bankedThisTurn >= this.TARGET) {
        player.score += this.state.bankedThisTurn;
        this.updateMessage(`Computer banks ${this.state.bankedThisTurn}!`, 'success');
        this.renderScores();
        await new Promise(r => setTimeout(r, 1000));
        if (player.score >= this.TARGET) {
          this.finishGame();
          return;
        }
        this.endTurn(true);
        return;
      }

      // Continue
      if (remaining.length === 0) {
        this.state.dice = rollDice(6);
        this.updateMessage('Computer gets hot dice!');
      } else {
        this.state.dice = remaining;
        this.updateMessage(`Computer rolls remaining ${remaining.length}&`);
      }
      this.render();
      await new Promise(r => setTimeout(r, 500));
    }

    // Safety bank
    player.score += this.state.bankedThisTurn;
    this.endTurn(true);
  },

  finishGame() {
    this.state.gameOver = true;
    const p0 = this.state.players[0];
    const p1 = this.state.players[1];

    let title, text;
    if (p0.score >= this.TARGET && p0.score >= p1.score) {
      title = 'You Win! <‰';
      text = `You reached ${p0.score} points!`;
    } else if (p1.score >= this.TARGET) {
      title = p1.isAI ? 'Computer Wins' : 'Friend Wins!';
      text = `${p1.name} reached ${p1.score} points.`;
    } else {
      title = 'Game Over';
      text = '';
    }

    document.getElementById('winner-title').textContent = title;
    document.getElementById('winner-text').textContent = text;
    document.getElementById('final-scores').innerHTML = `
      <div class="final-score-row ${p0.score >= p1.score ? 'winner' : ''}"><span>${p0.name}</span><span>${p0.score}</span></div>
      <div class="final-score-row ${p1.score > p0.score ? 'winner' : ''}"><span>${p1.name}</span><span>${p1.score}</span></div>
    `;
    document.getElementById('game-over-modal').classList.remove('hidden');
  }
};
