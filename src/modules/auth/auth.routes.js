import express from 'express';
import { z } from 'zod';
import prisma from '../../config/db.js'; // 1. config의 공유 Prisma 인스턴스 사용
import { registerDbSchema } from './auth.validation.js'; // 2. 새 Zod 스키마
import authMiddleware from '../../middlewares/authMiddleware.js'; // 3. 새 Firebase 미들웨어
const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;
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
      const firstError = error.errors?.length ? error.errors[0].message : "입력값 검증 오류";
      return res.status(400).json({ message: firstError });
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


router.post("/kakao", async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: "accessToken 필요" });
    }

    const kakaoUser = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

    const kakaoId = String(kakaoUser.data.id);
    const kakaoEmail = kakaoUser.data.kakao_account?.email;
    const kakaoNickname = kakaoUser.data.properties?.nickname ?? "카카오유저";

    // ⛔ 이메일 동의 안 된 경우 처리
    if (!kakaoEmail) {
      return res.status(400).json({
        message: "카카오 이메일 제공에 동의해야 로그인할 수 있습니다.",
      });
    }

    // DB 조회
    let user = await prisma.user.findFirst({
      where: { kakaoId }
    });

    // 신규 사용자 생성
    if (!user) {
      // 이메일 중복도 체크
      const duplicateEmail = await prisma.user.findFirst({
        where: { email: kakaoEmail }
      });

      if (duplicateEmail) {
        return res.status(400).json({
          message: "이미 존재하는 이메일입니다. 일반 로그인 또는 비밀번호 찾기를 사용하세요."
        });
      }

      user = await prisma.user.create({
        data: {
          kakaoId,
          email: kakaoEmail,
          username: `kakao_${kakaoId}`,
          nickname: kakaoNickname,
        }
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "카카오 로그인 성공",
      token,
      user
    });

  } catch (error) {
    console.error("🔥 카카오 로그인 오류:", error);
    res.status(500).json({ message: "카카오 로그인 실패" });
  }
});

export default router;