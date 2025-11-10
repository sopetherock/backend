// src/server.js
import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

import prisma from "./config/db.js";

async function testDB() {
  const users = await prisma.user.findMany();
  console.log("✅ DB 연결 성공! 현재 유저 수:", users.length);
}

testDB();
