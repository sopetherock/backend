// 중앙에서 관리하는 admin 객체 사용
import admin from '../config/firebase.js';

/**
 * 푸시 알림을 전송하는 함수
 * @param {string} fcmToken - 알림 받을 유저의 fcmToken
 * @param {string} title - 알림 제목
 * @param {string} body - 알림 내용
 * @param {object} data - (선택) Flutter가 받을 데이터
 */
export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  // 토큰이 없으면 전송 시도조차 하지 않음
  if (!fcmToken) return;

  const message = {
    notification: {
      title,
      body,
    },
    data: data, 
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ 성공적으로 푸시 알림 전송:', response);
  } catch (error) {
    console.error('🔥 푸시 알림 전송 오류:', error);
  }
};