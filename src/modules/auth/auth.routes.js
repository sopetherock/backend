import express from "express";
const router = express.Router();

router.post("/login", (req, res) => {
  res.json({ message: "로그인 기능 예정" });
});

export default router;
