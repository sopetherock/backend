// src/modules/notifications/notification.routes.js
import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "✅ Notification route 연결 성공!" });
});

export default router;
