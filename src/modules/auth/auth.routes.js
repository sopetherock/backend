// API 엔드포인트 ( 로그인 & 회원가입 )


import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client"; // Prisma DB 접속 
import { de } from "zod/locales";
import { act } from "react";

const router = express.Router(); // 라우터 (경로 관리자) API 생성 
const prisma = new PrismaClient(); // Prisma DB 생성 



// POST /auth/signup    _회원가입_  

router.post("/signup", async (req, res) => {
  try {

    // 1. Zod로 req.body 유효성 검사 (데이터가 형식에 맞게 잘 왔는지?)
    const { email, password, nickname } = req.body;
    

    // 2. 이메일 / 닉네임 중복 검사 
    const existingUser = await prisma.user.findUnique({
      where: {  OR: [ {email : email} , {username : username} ] },
    });
    if (existingUser) {
      return res.status(400).json({ message: "이미 사용 중인 이메일 입니다." });
    } 
    
    // 3. 비밀번호 암호화 
    const passwordHash = await bcrypt.hash(password, 10); // 비밀번호 암호화 (해시화)


    // 4. DB에 사용자 생성
    const newUser = await prisma.user.create({
      data: {
        email,  
        passwordHash,
        nickname
      },
    });

    // 비밀번호 해시 제거 (보안상 이유로 응답에 포함하지 않음)
    delete newUser.passwordHash; 
    res.status(201).json(newUser); // 201: 생성됨
  } catch (error) {
    console.error("회원가입 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});
  


// POST /auth/login    _로그인_

router.post("/login", async (req, res) => {
  try {
    // 1. Zod로 req.body 유효성 검사 (데이터가 형식에 맞게 잘 왔는지?)
    const { email, password } = req.body;

    // 2. 이메일로 사용자 조회
    const user = await prisma.user.findUnique({
      where: { OR: [
          { email: email },
          { username: email } // ⬅️ 1. 입력된 값이 username과 일치하는지도 확인
        ] },
    });
    if (!user) {
      return res.status(400).json({ message: "이메일 혹은 아이디 또는 비밀번호가 올바르지 않습니다." });
    }

    // 3. 비밀번호 비교
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "이메일 혹은 아이디 또는 비밀번호가 올바르지 않습니다." });
    }

    // 4. JWT 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ actcessToken: token, tokenType: "Bearer" });
  }
    catch (error) {
      res.status(500).json({ message: "서버 오류" });
    }
});

export default router;
