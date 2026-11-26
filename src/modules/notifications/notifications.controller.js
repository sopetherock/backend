// API 요청/응답 처리
// routes.js가 호출할 컨트롤러 함수
// 요청이 들어오면 데이터를 검사하고, service의 함수를 호출
import { notificationService } from './notifications.service.js';
import prisma from '../../config/db.js'; // alert 조회용
import { applyAutoStrike } from '../timers/timer.controller.js';

export const notificationController = {
  testApi: (req, res, next) => {
    res.status(200).json({ message: 'Notification API 연결 성공!' });
  },

  // 그룹 초대 처리
  handleGroupInvite: async (req, res, next) => {
    try {
      const { invitedUserIds, inviterName, groupName, groupId } = req.body;

      if (!invitedUserIds || !inviterName || !groupName) {
        throw new Error('필수 값이 누락되었습니다.');
      }

      // 서비스 로직 호출
      await notificationService.sendGroupInvites(invitedUserIds, inviterName, groupName, groupId);

      res.status(200).json({ message: '초대 알림 전송 성공' });
    } catch (error) {
      next(error);
    }
  },

  // 벼락 알림 처리
  handleLightningStrike: async (req, res, next) => {
    try {
      const { targetUserId, groupId } = req.body;
      
      // 서비스 로직 호출
      await notificationService.sendLightningAlert(targetUserId, groupId);

      res.status(200).json({ message: '벼락 알림 전송 완료' });
    } catch (error) {
      next(error);
    }
  },

  /**
   * API: POST /api/notifications/alert/:alertId/action
   * 기능: 친구가 벼락치기 실패 알림(FriendFailureAlert)에 대해 액션을 취함 (Strike/Later)
   */
  handleFriendAction: async (req, res, next) => {
    try {
      // req.user.id는 현재 액션을 취하는 '친구'의 ID (인증 필요)
      const notifiedFriendId = req.user.id; 
      const alertId = Number(req.params.alertId);
      const { action } = req.body; // "STRIKE" 또는 "LATER" (Enum 타입으로 들어옴)

      if (!action || (action !== 'STRIKE' && action !== 'LATER')) {
        return res.status(400).json({ message: '유효하지 않은 액션입니다. (STRIKE 또는 LATER)' });
      } 

      // 1. FriendFailureAlert 기록 조회 및 검증
      const alert = await prisma.friendFailureAlert.findUnique({
        where: { id: alertId },
        include: { failedUser: { select: { nickname: true } } } // 임시 제거
      });

      if (!alert || alert.notifiedFriendId !== notifiedFriendId) {
        return res.status(403).json({ message: '접근 권한이 없거나 유효하지 않은 알림입니다.' });
      } 
      
      // 이미 처리된 알림인지 확인
      if (alert.status === 'PROCESSED') {
          return res.status(409).json({ message: '이미 처리된 알림입니다.' });
      }
      
      // 2. FriendFailureAlert 상태 업데이트
      await prisma.friendFailureAlert.update({
        where: { id: alertId },
        data: { 
          status: 'PROCESSED', // Enum: PROCESSED
          actionTaken: action,  // Enum: STRIKE 또는 LATER
        }
      });
      
      let responseMessage = '액션 처리 완료.';

      // 3. 벼락 치기를 선택했다면, 벌칙 알림 발송
      if (action === 'STRIKE') {
          // req.user.nickname은 인증 미들웨어에서 넣어준다고 가정
          const friendNickname = req.user.nickname || '익명의 친구'; 

        await notificationService.sendStrikePenaltyAlert(alert.failedUserId, friendNickname);
        responseMessage = '벼락 치기가 완료되었습니다! (벌칙 발동)';
      }

      res.status(200).json({ message: responseMessage });
    } catch (error) {
      console.error('🔥 친구 액션 처리 오류:', error);
      next(error);
    }
  },

  // 자동 벼락 트리거 처리
  handleAutoStrikeTrigger: async (req, res, next) => {
    try {
      const { groupId } = req.body;
      if (!groupId) {
        throw new Error('groupId가 누락되었습니다.');
      }

      // Timer 모듈의 서비스 함수를 직접 호출 (완료 안 한 멤버 중 랜덤 1명에게 벼락 +1)
      await applyAutoStrike(groupId);

      res.status(200).json({ message: '자동 벼락 처리 위임 완료' });
    } catch (error) {
      console.error('🔥 자동 벼락 트리거 처리 실패:', error.message);
      next(error);
    }
  }
};