// src/server.js
import dotenv from "dotenv";
import app from "./app.js";
import cors from "cors";

app.use(cors({
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
}));
dotenv.config();

// [1. 방금 만든 크론 파일에서 스케줄러 시작 함수를 import] 
import { startTimerCronJobs } from './modules/timers/timer.count.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // 서버리스(Lambda)에서는 상시 프로세스가 아니라 크론이 의미 없으므로 DISABLE_CRON=true 로 끄기
  if (process.env.DISABLE_CRON !== 'true') {
    startTimerCronJobs();
  }
});

import prisma from "./config/db.js";

async function testDB() {
  const users = await prisma.user.findMany();
  console.log("✅ DB 연결 성공! 현재 유저 수:", users.length);
}

// DB 연결 실패 시 unhandled rejection 으로 프로세스가 죽지 않도록 catch
testDB().catch((e) => console.error("❌ DB 연결 실패:", e.message));

