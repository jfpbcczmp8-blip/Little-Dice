/**
 * Yahtzee game logic & UI controller
 */

const Yahtzee = {
  CATEGORIES: [
    'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
    'threeOfKind', 'fourOfKind', 'fullHouse', 'smallStraight',
    'largeStraight', 'yahtzee', 'chance'
  ],

  CATEGORY_LABELS: {
    ones: 'Aces (1s)',
    twos: 'Twos',
    threes: 'Threes',
    fours: 'Fours',
    fives: 'Fives',
    sixes: 'Sixes',
    threeOfKind: '3 of a Kind',
    fourOfKind: '4 of a Kind',
    fullHouse: 'Full House',
    smallStraight: 'Sm. Straight',
    largeStraight: 'Lg. Straight',
    yahtzee: 'YAHTZEE',
    chance: 'Chance'
  },

  UPPER: ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'],
  LOWER: ['threeOfKind', 'fourOfKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'],

  // Game state
  state: null,

  init(mode) {
    this.state = {
      mode, // 'solo' | 'local'
      players: [
        { name: 'You', scorecard: this.emptyScorecard(), isAI: false, total: 0 },
        { name: mode === 'solo' ? 'Computer' : 'Friend', scorecard: this.emptyScorecard(), isAI: mode === 'solo', total: 0 }
      ],
      currentPlayer: 0,
      round: 1,
      dice: [1,1,1,1,1],
      locked: [false, false, false, false, false],
      rollsLeft: 3,
      phase: 'rolling', // rolling | scoring | ai-thinking
      gameOver: false
    };
    this.render();
    this.bindEvents();
    this.updateMessage(`${this.state.players[0].name}'s turn  Roll the dice!`);
  },

  emptyScorecard() {
    const sc = {};
    this.CATEGORIES.forEach(c => sc[c] = null);
    return sc;
  },

  calculateScore(cat, dice) {
    const counts = countFaces(dice);
    const sum = dice.reduce((a, b) => a + b, 0);

    switch (cat) {
      case 'ones': return counts[1] * 1;
      case 'twos': return counts[2] * 2;
      case 'threes': return counts[3] * 3;
      case 'fours': return counts[4] * 4;
      case 'fives': return counts[5] * 5;
      case 'sixes': return counts[6] * 6;
      case 'threeOfKind':
        for (let i = 1; i <= 6; i++) if (counts[i] >= 3) return sum;
        return 0;
      case 'fourOfKind':
        for (let i = 1; i <= 6; i++) if (counts[i] >= 4) return sum;
        return 0;
      case 'fullHouse': {
        let has3 = false, has2 = false;
        for (let i = 1; i <= 6; i++) {
          if (counts[i] === 3) has3 = true;
          if (counts[i] === 2) has2 = true;
          if (counts[i] === 5) return 25; // Yahtzee counts as full house in some rules, but standard is 25 only for exact
        }
        // Standard Yahtzee: full house is 25 only for 3+2
        return (has3 && has2) ? 25 : 0;
      }
      case 'smallStraight': {
        // 4 consecutive
        const s = new Set(dice);
        const strs = [[1,2,3,4],[2,3,4,5],[3,4,5,6]];
        for (const st of strs) {
          if (st.every(n => s.has(n))) return 30;
        }
        return 0;
      }
      case 'largeStraight': {
        const s = new Set(dice);
        if ([1,2,3,4,5].every(n => s.has(n)) || [2,3,4,5,6].every(n => s.has(n))) return 40;
        return 0;
      }
      case 'yahtzee':
        for (let i = 1; i <= 6; i++) if (counts[i] === 5) return 50;
        return 0;
      case 'chance': return sum;
      default: return 0;
    }
  },

  calculateAllScores(dice) {
    const res = {};
    this.CATEGORIES.forEach(c => res[c] = this.calculateScore(c, dice));
    return res;
  },

  upperTotal(scorecard) {
    return this.UPPER.reduce((sum, c) => sum + (scorecard[c] || 0), 0);
  },

  upperBonus(scorecard) {
    return this.upperTotal(scorecard) >= 63 ? 35 : 0;
  },

  grandTotal(scorecard) {
    const lower = this.LOWER.reduce((sum, c) => sum + (scorecard[c] || 0), 0);
    return this.upperTotal(scorecard) + this.upperBonus(scorecard) + lower;
  },

  // --- UI ---
  render() {
    this.renderPlayers();
    this.renderDice();
    this.renderScorecard();
    this.renderControls();
    document.getElementById('yahtzee-round').textContent = this.state.round;
  },

  renderPlayers() {
    const bar = document.getElementById('yahtzee-players');
    bar.innerHTML = '';
    this.state.players.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip' + (i === this.state.currentPlayer ? ' active' : '');
      chip.innerHTML = `
        <span class="name">${p.name}${p.isAI ? ' <span class="ai-tag">AI</span>' : ''}</span>
        <span class="score">${this.grandTotal(p.scorecard)}</span>
      `;
      bar.appendChild(chip);
    });
  },

  renderDice() {
    const row = document.getElementById('yahtzee-dice');
    row.innerHTML = '';
    this.state.dice.forEach((val, i) => {
      const die = createDieElement(val, {
        locked: this.state.locked[i],
        disabled: this.state.phase !== 'rolling' || this.state.rollsLeft === 3 && !this.state.locked.some(l => l),
        id: i,
        onClick: () => this.toggleLock(i)
      });
      // Allow locking only after first roll
      if (this.state.rollsLeft === 3) {
        die.classList.add('disabled');
        die.style.pointerEvents = 'none';
      }
      row.appendChild(die);
    });
  },

  renderScorecard() {
    const container = document.getElementById('yahtzee-scorecard');
    const player = this.state.players[this.state.currentPlayer];
    const scores = this.state.phase === 'scoring' || this.state.rollsLeft < 3
      ? this.calculateAllScores(this.state.dice)
      : {};

    const makeSection = (title, cats) => {
      const sec = document.createElement('div');
      sec.className = 'score-section';
      sec.innerHTML = `<h3>${title}</h3>`;
      cats.forEach(cat => {
        const filled = player.scorecard[cat] !== null;
        const row = document.createElement('div');
        row.className = 'score-row' + (filled ? ' filled' : '');
        if (!filled && this.state.phase === 'scoring' && !player.isAI) {
          row.classList.add('available');
          row.addEventListener('click', () => this.scoreCategory(cat));
        }
        const preview = !filled && (this.state.phase === 'scoring' || this.state.rollsLeft < 3)
          ? `<span class="preview">${scores[cat] ?? ''}</span>`
          : '';
        const val = filled
          ? `<span class="cat-score">${player.scorecard[cat]}</span>`
          : preview;
        row.innerHTML = `<span class="cat-name">${this.CATEGORY_LABELS[cat]}</span>${val}`;
        sec.appendChild(row);
      });
      return sec;
    };

    container.innerHTML = '';
    container.appendChild(makeSection('Upper Section', this.UPPER));

    // Bonus + totals
    const right = document.createElement('div');
    right.className = 'score-section';
    right.innerHTML = `<h3>Lower Section</h3>`;
    this.LOWER.forEach(cat => {
      const filled = player.scorecard[cat] !== null;
      const row = document.createElement('div');
      row.className = 'score-row' + (filled ? ' filled' : '');
      if (!filled && this.state.phase === 'scoring' && !player.isAI) {
        row.classList.add('available');
        row.addEventListener('click', () => this.scoreCategory(cat));
      }
      const preview = !filled && (this.state.phase === 'scoring' || this.state.rollsLeft < 3)
        ? `<span class="preview">${scores[cat] ?? ''}</span>`
        : '';
      const val = filled
        ? `<span class="cat-score">${player.scorecard[cat]}</span>`
        : preview;
      row.innerHTML = `<span class="cat-name">${this.CATEGORY_LABELS[cat]}</span>${val}`;
      right.appendChild(row);
    });

    // Totals
    const upper = this.upperTotal(player.scorecard);
    const bonus = this.upperBonus(player.scorecard);
    const total = this.grandTotal(player.scorecard);

    const totals = document.createElement('div');
    totals.className = 'score-section';
    totals.innerHTML = `
      <h3>Totals</h3>
      <div class="score-row total-row"><span class="cat-name">Upper Total</span><span class="cat-score">${upper}</span></div>
      <div class="score-row bonus-row"><span class="cat-name">Bonus (63+)</span><span class="cat-score">${bonus}</span></div>
      <div class="score-row total-row"><span class="cat-name">Grand Total</span><span class="cat-score">${total}</span></div>
    `;

    container.appendChild(right);
    container.appendChild(totals);
  },

  renderControls() {
    const btn = document.getElementById('yahtzee-roll');
    const left = document.getElementById('yahtzee-rolls-left');
    left.textContent = this.state.rollsLeft;

    const player = this.state.players[this.state.currentPlayer];
    if (player.isAI || this.state.phase !== 'rolling' || this.state.rollsLeft === 0) {
      btn.disabled = true;
      btn.textContent = this.state.phase === 'ai-thinking' ? 'AI thinking&' : 'Roll Dice';
    } else {
      btn.disabled = false;
      btn.textContent = this.state.rollsLeft === 3 ? 'Roll Dice' : 'Roll Again';
    }
  },

  updateMessage(text, type = '') {
    const el = document.getElementById('yahtzee-message');
    el.textContent = text;
    el.className = 'turn-message ' + type;
  },

  bindEvents() {
    const rollBtn = document.getElementById('yahtzee-roll');
    // Remove old listeners by cloning
    const newBtn = rollBtn.cloneNode(true);
    rollBtn.parentNode.replaceChild(newBtn, rollBtn);
    newBtn.addEventListener('click', () => this.roll());
  },

  toggleLock(index) {
    if (this.state.phase !== 'rolling' || this.state.rollsLeft === 3) return;
    if (this.state.players[this.state.currentPlayer].isAI) return;
    this.state.locked[index] = !this.state.locked[index];
    this.renderDice();
  },

  async roll() {
    if (this.state.rollsLeft <= 0 || this.state.phase !== 'rolling') return;
    const player = this.state.players[this.state.currentPlayer];
    if (player.isAI) return;

    // Unlock all if first roll of turn? No, locked persist until scored.
    const diceEls = [...document.querySelectorAll('#yahtzee-dice .die')];
    await animateRoll(diceEls);

    for (let i = 0; i < 5; i++) {
      if (!this.state.locked[i]) {
        this.state.dice[i] = rollDie();
      }
    }
    this.state.rollsLeft--;
    this.render();

    if (this.state.rollsLeft === 0) {
      this.state.phase = 'scoring';
      this.updateMessage('Choose a category to score', 'warning');
      this.render();
    } else {
      this.updateMessage(`Select dice to keep, then roll again (${this.state.rollsLeft} left)`);
    }
  },

  scoreCategory(cat) {
    const player = this.state.players[this.state.currentPlayer];
    if (player.scorecard[cat] !== null || this.state.phase !== 'scoring') return;

    const score = this.calculateScore(cat, this.state.dice);
    player.scorecard[cat] = score;
    player.total = this.grandTotal(player.scorecard);

    this.endTurn();
  },

  endTurn() {
    // Check if all categories filled for current player
    const player = this.state.players[this.state.currentPlayer];
    const filled = this.CATEGORIES.every(c => player.scorecard[c] !== null);

    // Advance
    this.state.currentPlayer = (this.state.currentPlayer + 1) % 2;
    const next = this.state.players[this.state.currentPlayer];

    // If both players finished the round (or after player 1 of last)
    if (this.state.currentPlayer === 0) {
      this.state.round++;
    }

    // Game over when both have all 13 filled
    const bothDone = this.state.players.every(p =>
      this.CATEGORIES.every(c => p.scorecard[c] !== null)
    );

    if (bothDone) {
      this.finishGame();
      return;
    }

    // Reset for next turn
    this.state.dice = [1,1,1,1,1];
    this.state.locked = [false,false,false,false,false];
    this.state.rollsLeft = 3;
    this.state.phase = 'rolling';
    this.render();

    if (next.isAI) {
      this.updateMessage('Computer is thinking&');
      this.state.phase = 'ai-thinking';
      this.renderControls();
      setTimeout(() => this.runAITurn(), 700);
    } else {
      this.updateMessage(`${next.name}'s turn  Roll the dice!`);
    }
  },

  async runAITurn() {
    const player = this.state.players[this.state.currentPlayer];
    if (!player.isAI) return;

    this.state.phase = 'rolling';
    this.state.rollsLeft = 3;
    this.state.locked = [false,false,false,false,false];
    this.state.dice = rollDice(5);
    this.render();

    // AI rolls up to 3 times
    for (let r = 0; r < 3; r++) {
      await new Promise(res => setTimeout(res, 600));
      const diceEls = [...document.querySelectorAll('#yahtzee-dice .die')];
      await animateRoll(diceEls);

      // Decide keeps for next roll (if any left)
      if (r < 2) {
        const keepIdx = AI.yahtzeeDecideKeep(this.state.dice, 2 - r, player.scorecard);
        this.state.locked = [false,false,false,false,false];
        keepIdx.forEach(i => this.state.locked[i] = true);
      }

      for (let i = 0; i < 5; i++) {
        if (!this.state.locked[i]) this.state.dice[i] = rollDie();
      }
      this.state.rollsLeft = 2 - r;
      this.render();
    }

    // Choose category
    await new Promise(res => setTimeout(res, 500));
    const cat = AI.yahtzeeChooseCategory(this.state.dice, player.scorecard);
    const score = this.calculateScore(cat, this.state.dice);
    player.scorecard[cat] = score;
    player.total = this.grandTotal(player.scorecard);

    this.updateMessage(`Computer scored ${score} in ${this.CATEGORY_LABELS[cat]}`, 'success');
    await new Promise(res => setTimeout(res, 900));
    this.endTurn();
  },

  finishGame() {
    this.state.gameOver = true;
    const p0 = this.state.players[0];
    const p1 = this.state.players[1];
    const t0 = this.grandTotal(p0.scorecard);
    const t1 = this.grandTotal(p1.scorecard);

    let title, text;
    if (t0 > t1) {
      title = 'You Win! <‰';
      text = `Final score: ${t0}  ${t1}`;
    } else if (t1 > t0) {
      title = p1.isAI ? 'Computer Wins' : 'Friend Wins!';
      text = `Final score: ${t0}  ${t1}`;
    } else {
      title = "It's a Tie!";
      text = `Both scored ${t0}`;
    }

    document.getElementById('winner-title').textContent = title;
    document.getElementById('winner-text').textContent = text;
    document.getElementById('final-scores').innerHTML = `
      <div class="final-score-row ${t0 >= t1 ? 'winner' : ''}"><span>${p0.name}</span><span>${t0}</span></div>
      <div class="final-score-row ${t1 > t0 ? 'winner' : ''}"><span>${p1.name}</span><span>${t1}</span></div>
    `;
    document.getElementById('game-over-modal').classList.remove('hidden');
  }
};
