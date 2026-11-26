// src/modules/timers/timer.routes.js
import express from "express";
import authMiddleware from '../../middlewares/authMiddleware.js'; // 유저 인증
import {
  createPersonalTimer,
  createGroupTimer,  // [수정됨] Social 모듈을 이용해 그룹 생성
  completePersonalTimer,
  completeGroupTask,
  failPersonalTimer,
  addStrike,
  getUrgentTask,
  failGroupTask,
  getRunningTimers,
  acceptGroupInvite,
  declineGroupInvite
} from './timer.controller.js'; // 1. 컨트롤러 함수들 import

const router = express.Router();

// 진행 중인 개인/그룹 타이머 목록 (투두 화면)
router.get('/', authMiddleware, getRunningTimers);

// 기능 1: 개인 할일 및 타이머 생성
router.post('/personal', authMiddleware, createPersonalTimer);

router.post('/personal/:timerId/complete', authMiddleware, completePersonalTimer);

router.post('/personal/:timerId/fail', authMiddleware, failPersonalTimer);

// 기능 2: 그룹 타이머 생성 (Social 모듈 연동 + 초대 알림)
router.post('/group', authMiddleware, createGroupTimer);

// 그룹 초대 수락/거절
router.post('/group/:groupId/accept', authMiddleware, acceptGroupInvite);
router.post('/group/:groupId/decline', authMiddleware, declineGroupInvite);

// 그룹 할일 포기 (친구 알림) - 👈 [추가된 부분]
router.post('/group/:groupId/fail', authMiddleware, failGroupTask);

// 기능 2: 그룹 할일 완료 (번개 획득, 그룹 해체 로직 트리거)
router.post('/group/:groupId/complete', authMiddleware, completeGroupTask);

// 기능 3: (C번) 벼락 누적 API (Notifications 모듈이 호출)
// 님이 정의한 API: POST /api/timers/strike
// (서버 간 통신이므로 authMiddleware가 필요 없습니다)
router.post('/strike', addStrike);

// 기능 4: 위젯용 데이터 조회 API
router.get('/urgent', authMiddleware, getUrgentTask);

export default router;
