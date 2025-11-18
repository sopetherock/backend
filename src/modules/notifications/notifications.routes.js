// src/modules/notifications/notification.routes.js
// API 주소 정의
import express from "express";
import { notificationController } from './notifications.controller.js'; // (컨트롤러는 곧 만들 것)

const router = express.Router();

router.get('/test', notificationController.testApi); // 테스트용 API 엔드포인트
router.post('/invite', notificationController.handleGroupInvite); // 그룹 타이머 초대 알림 수신 API
router.post('/lightning', notificationController.handleLightningStrike); // 벼락(그룹타이머) 알림 수신 API

export default router;
