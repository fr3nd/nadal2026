// All the knobs of the game in one place. Distances are in "logical pixels"
// (the game is drawn on a tiny canvas, ~130px wide, then scaled up).
export const CONFIG = {
  lanes: 3,
  laneWidth: 40,        // logical px; the road is always 3 lanes wide

  // --- Speed & difficulty --------------------------------------------------
  pxPerMeter: 15,       // 15 logical px = 1 m
  speedStart: 90,       // px/s at the start of a run
  speedMax: 205,        // px/s once fully ramped up
  rampSeconds: 60,      // time to go from easy to "hard but fair"
  graceSeconds: 4,      // no obstacles at all during the first seconds
  rowGapStart: 1.05,    // seconds between rows of things (easy)
  rowGapEnd: 0.58,      // ... (hard); keep >= ~0.5 so a lane change is always possible
  obstacleChanceStart: 0.25,   // chance a row has obstacles
  obstacleChanceEnd: 0.8,
  doubleObstacleChanceEnd: 0.5, // chance a row has 2 obstacles (never 3)

  // --- Items ---------------------------------------------------------------
  giftChanceOnObstacleRow: 0.5, // gift next to obstacles, on the safe path
  giftChanceBetweenRows: 0.8,   // gift in the gaps between rows
  giftRiskChance: 0.25,         // chance that gap gift is NOT on the safe path
  giftPoints: 10,
  starChance: 0.015,
  starMinTime: 12,
  starCooldown: 25,
  starSeconds: 6,

  // --- Hit (one hit = game over, unless the star is active) ---
  hitShakeSeconds: 0.4,
  dyingStopSeconds: 0.7, // pause once stopped, before the game over screen

  // --- Milestones ----------------------------------------------------------
  milestoneEvery: 250,  // meters
  milestoneRows: 3,

  // --- Controls ------------------------------------------------------------
  slideMs: 85,          // duration of a lane change
  inputBuffer: 2,       // how many swipes are remembered while sliding
  swipePx: 22,          // finger distance (CSS px) that counts as a swipe

  // --- Hitboxes (half sizes, logical px) -----------------------------------
  kaiHitW: 9,
  kaiHitH: 11,
};
