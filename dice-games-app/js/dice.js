/**
 * Shared dice utilities for Dice Den
 */

const DICE_FACES = ['€', '', '‚', 'ƒ', '„', '…'];

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(count) {
  return Array.from({ length: count }, () => rollDie());
}

function faceToEmoji(value) {
  return DICE_FACES[value - 1] || '?';
}

/**
 * Create a die DOM element
 * @param {number} value - 1-6
 * @param {object} opts - { locked, selected, disabled, onClick, id }
 */
function createDieElement(value, opts = {}) {
  const die = document.createElement('div');
  die.className = 'die';
  if (opts.locked) die.classList.add('locked');
  if (opts.selected) die.classList.add('selected');
  if (opts.disabled) die.classList.add('disabled');
  die.textContent = faceToEmoji(value);
  die.dataset.value = value;
  if (opts.id !== undefined) die.dataset.id = opts.id;
  if (opts.onClick && !opts.disabled) {
    die.addEventListener('click', opts.onClick);
  }
  return die;
}

/**
 * Animate rolling a set of dice elements
 */
function animateRoll(diceElements, duration = 500) {
  return new Promise(resolve => {
    diceElements.forEach(el => {
      if (!el.classList.contains('locked') && !el.classList.contains('disabled')) {
        el.classList.add('rolling');
        // Temporarily show random faces during animation
        const interval = setInterval(() => {
          el.textContent = faceToEmoji(rollDie());
        }, 60);
        setTimeout(() => clearInterval(interval), duration - 50);
      }
    });
    setTimeout(() => {
      diceElements.forEach(el => el.classList.remove('rolling'));
      resolve();
    }, duration);
  });
}

/**
 * Count occurrences of each face
 */
function countFaces(dice) {
  const counts = [0, 0, 0, 0, 0, 0, 0]; // index 1-6
  dice.forEach(d => counts[d]++);
  return counts;
}

/**
 * Check if array of dice values contains a straight 1-6
 */
function isStraight(dice) {
  if (dice.length !== 6) return false;
  const sorted = [...dice].sort((a, b) => a - b);
  return sorted.every((v, i) => v === i + 1);
}

/**
 * Check three pairs
 */
function hasThreePairs(counts) {
  let pairs = 0;
  for (let i = 1; i <= 6; i++) {
    if (counts[i] === 2) pairs++;
    if (counts[i] === 4) pairs += 2; // four-of-a-kind counts as two pairs sometimes, but standard is exact
    if (counts[i] === 6) pairs += 3;
  }
  return pairs === 3;
}

/**
 * Check full house (exactly one three + one two)
 */
function hasFullHouse(counts) {
  let hasThree = false;
  let hasTwo = false;
  for (let i = 1; i <= 6; i++) {
    if (counts[i] === 3) hasThree = true;
    if (counts[i] === 2) hasTwo = true;
  }
  return hasThree && hasTwo;
}

/**
 * Check two triplets
 */
function hasTwoTriplets(counts) {
  let triplets = 0;
  for (let i = 1; i <= 6; i++) {
    if (counts[i] >= 3) triplets++;
  }
  return triplets === 2;
}
