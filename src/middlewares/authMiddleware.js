// src/middlewares/authMiddleware.js
//gcp에 배포 시 미들웨어는 GCP Cloud Run 서비스가 "인증(Authentication)" 기능을 활성화하고,
//"Firebase Authentication"을 사용하도록 설정되었다고 가정합니다.
//Cloud Run이 토큰 검증을 "대신" 해주고,
//검증된 유저의 UID를 'x-serverless-firebase-uid' 헤더에 주입해 주는 코드로 다시 작성합니다


import admin from '../config/firebase.js'; // 1. src/config/firebase.js에서 초기화된 admin 객체
import prisma from '../config/db.js'; // 2. src/config/db.js에서 초기화된 prisma 객체

/**
 * Firebase ID Token을 검증하고,
 * Prisma DB의 User 정보와 연결(Sync)하는 미들웨어
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. "Bearer [ID_TOKEN]" 형식인지 확인
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '인증 토큰이 없거나 형식이 올바르지 않습니다.' });
  }

  // 2. 헤더에서 'Bearer ' 부분을 제거하여 실제 ID Token만 추출
  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 3. [Firebase] 프론트엔드가 보낸 ID Token을 Firebase 서버에 검증합니다.
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // 4. [Prisma] 검증된 토큰의 uid (Firebase 고유 ID)를 사용해
    //    우리 DB(Prisma)에서 유저를 조회합니다.
    const user = await prisma.user.findUnique({
      where: {
        // 'schema.prisma'에 'firebaseUid' 필드를 @unique로 추가했다고 가정
        firebaseUid: decodedToken.uid,
      },
    });

    // 5. 우리 DB에 해당 유저가 존재하는지 확인합니다.
    if (!user) {
      // (이 경우는 프론트가 Firebase 회원가입 후, /api/auth/register-db 호출을 누락한 경우)
      return res.status(401).json({ message: '유저가 DB에 등록되지 않았습니다.' });
    }

    // 6. [Auth 연결] req.user 객체에 DB에서 조회한 'user' 정보를 주입합니다.
    req.user = user;

    // 7. 다음 로직(컨트롤러)으로 이동
    next();

  } catch (error) {
    // 토큰이 만료되었거나, 위조되었거나, 유효하지 않은 경우
    console.error('🔥 Firebase 토큰 검증 실패:', error);
    res.status(403).json({ message: '인증에 실패했습니다. (Invalid Token)' });
  }
};

export default authMiddleware;
