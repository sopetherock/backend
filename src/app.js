// src/app.js
import express from "express";
import cors from "cors";
import authRouter from "./modules/auth/auth.routes.js";
import socialRouter from "./modules/social/social.routes.js";
import timerRouter from "./modules/timers/timer.routes.js";
import notificationRouter from "./modules/notifications/notifications.routes.js";
import questRouter from './modules/quests/quests.routes.js';

const app = express(); //express()실행
//핵심 미들웨어들 설정
app.use(cors());
app.use(express.json());

// ✅ 공통 라우터 연결
app.use("/api/auth", authRouter);
app.use("/api/social", socialRouter);
app.use("/api/timers", timerRouter);
app.use("/api/notifications", notificationRouter);
app.use('/api/quests', questRouter);

app.get("/", (req, res) => {
  res.send("Server running ✅");
});

export default app;
