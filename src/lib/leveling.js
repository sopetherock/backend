// src/lib/leveling.js

// 레벨업에 필요한 "누적" 번개 개수
const LEVEL_THRESHOLDS = {
  1: 0,
  2: 10,  // 레벨 2가 되려면 총 10개 필요
  3: 30,  // 레벨 3가 되려면 총 30개 필요
  4: 60,
  5: 100,
  // ...
};

/**
 * 현재 번개 개수를 기반으로 유저의 레벨을 계산합니다.
 * @param {number} lightningCount - 현재 누적 번개 개수
 * @returns {number} - 계산된 레벨
 */
export const calculateLevel = (lightningCount) => {
  let currentLevel = 1;
  
  // 높은 레벨부터 거꾸로 순회
  const sortedLevels = Object.keys(LEVEL_THRESHOLDS).map(Number).sort((a, b) => b - a);

  for (const level of sortedLevels) {
    if (lightningCount >= LEVEL_THRESHOLDS[level]) {
      currentLevel = level;
      break; // 가장 높은 달성 가능 레벨을 찾으면 중단
    }
  }
  return currentLevel;
};