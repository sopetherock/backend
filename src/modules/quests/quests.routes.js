//번개모으기 구현
//퀘스트 깰 때마다(post) 유저의 번개개수누적
//단계별 기준 번개개수 도달 시 유저레벨올리기(db에 유저레벨추가함)
//퀘스트 완료 api엔드포인트 정의
import express from 'express';
import authMiddleware from '../../middlewares/authMiddleware.js';

// 1.(controller) 파일에서 "completeQuest" 함수를 "import" 합니다. 
import { completeQuest } from './quests.controller.js';

const router = express.Router();

// 2. "POST /complete" 요청이 오면, authMiddelware검사 통과시키고 completeQuest에게 처리넘김 
router.post('/complete', authMiddleware, completeQuest);

// (만약 다른 API가 필요하면 여기에 추가) 
// router.get('/', authMiddleware, getMyQuests); // 예: 내 퀘스트 목록

export default router;