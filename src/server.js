// src/server.js
import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

// [1. 방금 만든 크론 파일에서 스케줄러 시작 함수를 import] 
import { startTimerCronJobs } from './modules/timers/timer.count.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // [2. 서버가 성공적으로 켜지면, 크론 작업도 시작] 
  startTimerCronJobs();
});

import prisma from "./config/db.js";

async function testDB() {
  const users = await prisma.user.findMany();
  console.log("✅ DB 연결 성공! 현재 유저 수:", users.length);
}

testDB();

