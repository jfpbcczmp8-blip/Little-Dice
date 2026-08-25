/**
 * Simple AI opponents for Yahtzee and Farkle
 */

const AI = {
  /**
   * Yahtzee AI: chooses which dice to keep and which category to score
   * Strategy: prioritize Yahtzee, large straight, then high scoring upper, etc.
   */
  yahtzeeDecideKeep(dice, rollsLeft, scorecard) {
    // dice: array of 5 values
    // returns array of indices to keep (lock)
    const counts = countFaces(dice);
    const keep = new Set();

    // Always keep Yahtzee if present
    for (let i = 1; i <= 6; i++) {
      if (counts[i] === 5) {
        return [0,1,2,3,4]; // keep all
      }
    }

    // Prefer keeping 3+ of a kind toward Yahtzee or full house
    let bestFace = 0;
    let bestCount = 0;
    for (let i = 1; i <= 6; i++) {
      if (counts[i] > bestCount || (counts[i] === bestCount && i > bestFace)) {
        bestCount = counts[i];
        bestFace = i;
      }
    }

    if (bestCount >= 3) {
      dice.forEach((v, idx) => {
        if (v === bestFace) keep.add(idx);
      });
      // Also keep a pair if going for full house and we have one
      if (bestCount === 3) {
        for (let i = 1; i <= 6; i++) {
          if (i !== bestFace && counts[i] >= 2) {
            dice.forEach((v, idx) => {
              if (v === i && keep.size < 5) keep.add(idx);
            });
            break;
          }
        }
      }
      return Array.from(keep);
    }

    // Look for straight potential
    const unique = [...new Set(dice)].sort((a,b) => a - b);
    if (unique.length >= 3) {
      // Keep consecutive numbers
      const toKeep = new Set();
      for (let i = 0; i < unique.length; i++) {
        // simple: keep all unique if looking like straight
        dice.forEach((v, idx) => {
          if (v === unique[i] && toKeep.size < 4) toKeep.add(idx);
        });
      }
      if (toKeep.size >= 3) return Array.from(toKeep);
    }

    // Keep highest pair or high singles for upper section
    if (bestCount === 2) {
      dice.forEach((v, idx) => {
        if (v === bestFace) keep.add(idx);
      });
      return Array.from(keep);
    }

    // Keep 1s and 5s lightly, or high values
    dice.forEach((v, idx) => {
      if (v >= 4 || v === 1) keep.add(idx);
    });
    // Limit keep to 2-3
    return Array.from(keep).slice(0, 3);
  },

  /**
   * Choose best available category for Yahtzee AI
   */
  yahtzeeChooseCategory(dice, scorecard) {
    const scores = Yahtzee.calculateAllScores(dice);
    let bestCat = null;
    let bestScore = -1;
    let bestPriority = -1;

    const priority = {
      yahtzee: 100,
      largeStraight: 90,
      fourOfKind: 80,
      fullHouse: 75,
      smallStraight: 70,
      threeOfKind: 60,
      sixes: 50,
      fives: 45,
      fours: 40,
      threes: 30,
      twos: 20,
      ones: 15,
      chance: 10
    };

    for (const cat of Yahtzee.CATEGORIES) {
      if (scorecard[cat] !== null) continue; // already filled
      const s = scores[cat];
      const p = priority[cat] || 0;
      // Prefer high score * priority
      const value = s * 10 + p;
      if (value > bestScore || (value === bestScore && p > bestPriority)) {
        bestScore = value;
        bestPriority = p;
        bestCat = cat;
      }
    }

    // If all remaining give 0, just pick any (prefer chance or lowest upper)
    if (bestCat === null || (scores[bestCat] === 0 && bestPriority < 50)) {
      for (const cat of ['chance', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'threeOfKind']) {
        if (scorecard[cat] === null) return cat;
      }
      // last resort
      for (const cat of Yahtzee.CATEGORIES) {
        if (scorecard[cat] === null) return cat;
      }
    }
    return bestCat;
  },

  /**
   * Farkle AI decision: which dice to set aside (score) and whether to bank or continue
   * Returns { setAside: indices[], bank: boolean }
   */
  farkleDecide(dice, currentTurnScore, totalScore, target, availableDiceCount) {
    const analysis = Farkle.analyzeDice(dice);
    // analysis: { scoringOptions: [{indices, points, description}], maxScore, canScore }

    if (!analysis.canScore) {
      return { setAside: [], bank: false, farkle: true };
    }

    // Greedy: take the highest scoring option that uses dice wisely
    // Prefer options that leave some dice for continuation if score is decent
    let best = analysis.scoringOptions[0];
    for (const opt of analysis.scoringOptions) {
      if (opt.points > best.points) best = opt;
      // Prefer using fewer dice if points similar (to continue rolling)
      else if (opt.points === best.points && opt.indices.length < best.indices.length) {
        best = opt;
      }
    }

    const newTurnScore = currentTurnScore + best.points;
    const remainingDice = dice.length - best.indices.length;
    // If all dice scored, you get them back (hot dice)
    const diceLeft = remainingDice === 0 ? 6 : remainingDice;

    // Decision to bank
    let shouldBank = false;

    // Always bank if we can win
    if (totalScore + newTurnScore >= target) {
      shouldBank = true;
    }
    // Bank if turn score is high relative to risk
    else if (newTurnScore >= 800) {
      shouldBank = true;
    }
    else if (newTurnScore >= 500 && diceLeft <= 2) {
      shouldBank = Math.random() > 0.3; // mostly bank
    }
    else if (newTurnScore >= 350 && diceLeft <= 3) {
      shouldBank = Math.random() > 0.5;
    }
    else if (diceLeft === 1 && newTurnScore >= 200) {
      shouldBank = Math.random() > 0.4;
    }
    // Early game more aggressive
    else if (totalScore < 2000 && newTurnScore < 300) {
      shouldBank = false;
    }

    // If only 1-2 dice left and score low, bank more often
    if (diceLeft <= 2 && newTurnScore >= 150) {
      shouldBank = shouldBank || Math.random() > 0.45;
    }

    return {
      setAside: best.indices,
      bank: shouldBank,
      points: best.points,
      farkle: false
    };
  }
};
