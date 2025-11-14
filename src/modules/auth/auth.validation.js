import { email, z } from "zod";

// 회원가입 요청 데이터 유효성 검사
export const signupSchema = z.object({
    email: z.string().email({ message: "유효한 이메일 주소여야 합니다." }),
    password: z.string().min(8, { message: "비밀번호는 최소 8자 이상이어야 합니다." }),
    nickname: z.string().min(2, { message: "닉네임은 최소 2자 이상이어야 합니다." }),
    username : z.string().min(4, { message: "아이디는 최소 4자 이상이어야 합니다." }),
});

// 로그인 시 검증 
export const loginSchema = z.object({
    email : z.string().email(),
    password : z.string(),
});
