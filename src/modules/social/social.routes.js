// src/modules/social/social.routes.js
import express from "express";
const router = express.Router();

// 임시 테스트용 라우터
router.get("/", (req, res) => {
  res.json({ message: "✅ Social route 연결 성공!" });
});

export default router;
