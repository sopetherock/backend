// 실제 알림 로직
// DB(Notification 테이블)에 알림 내역 저장
// utils/fcm.js를 호출해서 푸시 알림 발송
import axios from 'axios';
import prisma from '../../config/db.js';
import { sendPushNotification } from '../../utils/fcm.js';

export const notificationService = {
  
  /**
   * 그룹 초대 알림 생성 및 발송
   * @param {number[]} invitedUserIds - 초대받은 유저 ID 배열
   * @param {string} inviterName - 초대한 사람 닉네임
   * @param {string} groupName - 그룹 이름
   * @param {number} groupId - 그룹 ID (알림 클릭 시 이동용)
   */
  async sendGroupInvites(invitedUserIds, inviterName, groupName, groupId) {
    
    // 알림 메시지 생성
    const message = `${inviterName}님이 '${groupName}' 그룹에 초대했습니다.`;

    // DB 작업: 초대받은 유저들(invitedUserIds)을 순회
    for (const userId of invitedUserIds) {
      
      // [FCM용] 초대받은 유저의 fcmToken 조회
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true }
      });

      // [DB Log] 알림 내역을 Notification 테이블에 저장
      await prisma.notification.create({
        data: {
          userId: userId,
          type: 'group_invite', // (알림 타입 정의)
          message: message,
          relatedId: groupId, // (알림 클릭 시 이동할 groupId 저장)
        }
      });

      // [FCM 전송] 유저가 fcmToken을 가지고 있다면 푸시 알림 발송
      if (user && user.fcmToken) {
        await sendPushNotification(
          user.fcmToken,
          '새로운 그룹 초대', // (푸시 알림 제목)
          message,           // (푸시 알림 내용)
          { groupId: String(groupId), type: 'group_invite' } // (Flutter가 받을 데이터)
        );
      }
    }
    
    // (Socket.io 전송: 만약 유저가 앱에 접속 중이라면 실시간 팝업용)
    // ... (이건 2순위로 구현)
  },

  /**
   * 벼락 알림 발송
   */
  async sendLightningAlert(targetUserId, groupId) {
    // 1. 벼락 맞은 유저 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { fcmToken: true, nickname: true } // 닉네임도 필요하면 조회
    });

    if (!user) return;

    const message = "찌릿! ⚡ 누군가 당신에게 벼락을 내렸습니다! (할 일을 빨리 끝내세요)";

    // 2. DB에 알림 기록
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'lightning_strike',
        message: message,
        relatedId: groupId,
      }
    });

    // 3. FCM 푸시 전송
    if (user.fcmToken) {
      await sendPushNotification(
        user.fcmToken,
        '⚡ 벼락이 떨어졌습니다!',
        message,
        { type: 'lightning_strike', groupId: String(groupId) } // (Flutter가 받을 데이터 -> 이펙트 띄움)
      );
    }
  }
};