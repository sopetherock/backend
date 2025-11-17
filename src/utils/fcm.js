import admin from 'firebase-admin';
// ESM (import) 방식에서는 json 파일을 이렇게 불러옵니다.
import serviceAccount from '../../serviceAccountKey.json' with { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/**
 * 푸시 알림을 전송하는 함수
 * @param {string} fcmToken - 알림 받을 유저의 fcmToken
 * @param {string} title - 알림 제목
 * @param {string} body - 알림 내용
 * @param {object} data - (선택) Flutter가 받을 데이터 (예: { type: 'group_invite', groupId: '123' })
 */
export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  const message = {
    notification: {
      title,
      body,
    },
    data: data, // ⬅️ Flutter가 백그라운드에서 처리할 데이터
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ 성공적으로 푸시 알림 전송:', response);
  } catch (error) {
    console.error('🔥 푸시 알림 전송 오류:', error);
  }
};