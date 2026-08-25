/**
 * Dice Den  Main application controller
 */

const App = {
  currentGame: null, // 'yahtzee' | 'farkle'
  currentMode: null, // 'solo' | 'local'

  init() {
    this.bindHome();
    this.bindMode();
    this.bindModals();
    this.bindBacks();
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
  },

  bindHome() {
    document.querySelectorAll('.game-card[data-game]').forEach(card => {
      card.addEventListener('click', () => {
        const game = card.dataset.game;
        if (!game) return;
        this.currentGame = game;
        document.getElementById('mode-title').textContent =
          game === 'yahtzee' ? 'Yahtzee  Choose Mode' : 'Farkle  Choose Mode';
        this.showScreen('mode-screen');
      });
    });
  },

  bindMode() {
    document.getElementById('mode-back').addEventListener('click', () => {
      this.showScreen('home-screen');
    });

    document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
      card.addEventListener('click', () => {
        this.currentMode = card.dataset.mode;
        this.startGame();
      });
    });
  },

  bindBacks() {
    document.getElementById('yahtzee-back').addEventListener('click', () => {
      if (confirm('Leave the current game and return to menu?')) {
        this.showScreen('home-screen');
      }
    });
    document.getElementById('farkle-back').addEventListener('click', () => {
      if (confirm('Leave the current game and return to menu?')) {
        this.showScreen('home-screen');
      }
    });
  },

  bindModals() {
    document.getElementById('play-again').addEventListener('click', () => {
      document.getElementById('game-over-modal').classList.add('hidden');
      this.startGame();
    });
    document.getElementById('back-to-menu').addEventListener('click', () => {
      document.getElementById('game-over-modal').classList.add('hidden');
      this.showScreen('home-screen');
    });
  },

  startGame() {
    if (this.currentGame === 'yahtzee') {
      this.showScreen('yahtzee-screen');
      Yahtzee.init(this.currentMode);
    } else if (this.currentGame === 'farkle') {
      this.showScreen('farkle-screen');
      Farkle.init(this.currentMode);
    }
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
