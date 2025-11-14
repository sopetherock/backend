//실제 데이터베이스 로직만 들어감

// config/db.js에서 Prisma 인스턴스를 가져옵니다 (경로 확인 필요 -> 맞음)
import prisma from '../../config/db.js'; 
// lib/leveling.js에서 레벨 계산기를 가져옵니다 (경로 확인 필요 -> 맞음)
import { calculateLevel } from '../../lib/leveling.js';
// 퀘스트 완료 로직을 "export" (수출) 함수로 만듭니다. 
export const completeQuest = async (req, res) => { // authMiddleware가 req.user에 유저 정보를 넣어줬다고 가정 
const userId = req.user.userId;
const userId = req.user.userId;

try { const currentUser = await prisma.user.findUnique({ where: { id: userId }, });

if (!currentUser) {
  return res.status(404).json({ error: 'User not found' });
}
// (스키마에 맞게 'lightingPoints' 사용)
const newLightingPoints = currentUser.lightingPoints + 1;
const newLevel = calculateLevel(newLightingPoints);
const updatedUser = await prisma.user.update({
  where: { id: userId },
  data: {
    lightingPoints: newLightingPoints,
    level: newLevel,
  },
  select: {
    id: true,
    username: true,
    nickname: true,
    lightingPoints: true,
    level: true,
  },
});
// 반환합니다 (res.json)
res.status(200).json(updatedUser);
} catch (error) { console.error('Error completing quest:', error); 
    res.status(500).json({ error: 'Internal server error' }); } };