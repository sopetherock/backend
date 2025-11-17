import express from 'express';
import { z } from 'zod';
import prisma from '../../config/db.js'; // 1. config의 공유 Prisma 인스턴스 사용
import { registerDbSchema } from './auth.validation.js'; // 2. 새 Zod 스키마
import authMiddleware from '../../middlewares/authMiddleware.js'; // 3. 새 Firebase 미들웨어

const router = express.Router();

// [참고] 기존 /signup, /login (비밀번호/bcrypt/jwt.sign 로직)은 모두 삭제합니다.
// (인증은 이제 프론트엔드가 Firebase 클라이언트 SDK로 직접 처리합니다)

/**
 * API: POST /api/auth/register-db
 * 역할: Firebase Auth 회원가입 직후, 프론트엔드가 호출하여
 * Prisma DB에 유저 정보를 최종 등록합니다.
 */
router.post('/register-db', async (req, res) => {
  try {
    // 1. Zod로 유효성 검사
    const data = registerDbSchema.parse(req.body);

    // 2. 이메일 또는 유저이름 중복 검사
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: '이미 사용 중인 이메일 또는 아이디입니다.' });
    }

    // 3. Prisma DB에 새 유저 생성 (Firebase uid와 함께)
    const newUser = await prisma.user.create({
      data: {
        firebaseUid: data.firebaseUid,
        email: data.email,
        username: data.username,
        nickname: data.nickname,
      },
    });

    res.status(201).json(newUser);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('🔥 DB 등록 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});


/**
 * API: GET /api/auth/me
 * 역할: (테스트용) 내 Firebase ID Token이 유효한지,
 * Prisma DB와 잘 연결되었는지 확인합니다.
 */
router.get('/me', authMiddleware, (req, res) => {
  // authMiddleware가 req.user에 Prisma DB 정보를 넣어줬으므로,
  // 그냥 req.user를 반환합니다.
  res.status(200).json(req.user);
});


export default router;
