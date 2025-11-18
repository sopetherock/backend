// API 요청/응답 처리
// routes.js가 호출할 컨트롤러 함수
// 요청이 들어오면 데이터를 검사하고, service의 함수를 호출
import { notificationService } from './notifications.service.js';

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
  }
};