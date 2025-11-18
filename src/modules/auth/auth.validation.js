import { z } from 'zod';

// [참고] loginSchema는 Firebase(클라이언트 SDK)가 처리하므로 삭제합니다.

/**
 * [변경]
 * Firebase Auth 회원가입 후,
 * Prisma DB에 유저 정보를 등록할 때 사용할 스키마
 */
export const registerDbSchema = z.object({
  // Firebase Auth가 발급한 고유 ID (localId)
  firebaseUid: z.string().min(1, { message: 'Firebase UID가 필요합니다.' }),
  
  // Firebase Auth에서 이미 검증된 이메일
  email: z.string().email({ message: '유효한 이메일 주소여야 합니다.' }),
  
  // ZEUS ON에서 사용할 아이디
  username: z.string().min(4, { message: '아이디는 최소 4자 이상이어야 합니다.' }),
  
  // ZEUS ON에서 사용할 닉네임
  nickname: z.string().min(2, { message: '닉네임은 최소 2자 이상이어야 합니다.' }),
});
