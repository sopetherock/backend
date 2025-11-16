# main
# ⚡️ ZEUS ON  
“벼락치기의 신이 깨어난다”  
> **벼락치기 성공을 위한 실시간 페널티 타이머 백엔드**

---

## 💡 프로젝트 개요 (Overview)
**ZEUS ON**은 데드라인이 정해진 업무를 완수하기 위해 설계된 웹/앱 서비스입니다.  
단순한 타이머가 아니라, 유저가 세션 중 페이지를 이탈하거나 방치할 경우  
**'벼락(Thunder)'이라는 페널티를 실시간으로 누적**합니다.

서버는 이 페널티를 기반으로 **그룹 해체 시 자동으로 벌칙자를 선정**하고 통보하며,  
벌칙자의 친구들에게도 알림을 전송합니다.

---

## 🌟 주요 기능 및 핵심 로직 (Key Features)

| 기능 | 로직 | 기술적 특징 |
|------|------|--------------|
| Dual-Point System | 할 일 완료 시 **번개(Lightning)** 획득 (`User.lightingPoints`), 비활동 시 **벼락(Thunder)** 누적 (`GroupMembership.thunderCount`) | 인센티브 + 페널티 이원화로 행동 유도 |
| 강제 벌칙 스케줄러 | `node-cron`으로 **40분마다 비활동 그룹 자동 탐지** → 벼락 자동 부과 | 서버 시간 관리 **신뢰성 보장** |
| 실시간 페널티 누적 | notifications 모듈이 **S2S API**로 "페이지 이탈" 신호 전달 → 해당 멤버에 즉시 벼락 +1 | Axios 모듈 간 통신, FK 기반 실시간 업데이트 |
| 벌칙자 선정 | 그룹 해체 시 `GroupMembership`을 **thunderCount 내림차순 정렬**, 가장 높은 유저를 벌칙자로 선정 → `POST /notifications/penalty` 통보 | 복잡 쿼리 및 모듈 간 책임 분리 |
| 그룹 라이프사이클 | 그룹 생성 → 수락 → 완료 → 해체(deadline 만료 또는 전원 완료) 전 과정을 timer 모듈이 관리 | `Group`, `GroupMembership`의 `status` 필드 기반 상태 머신 |

---

## 🏗️ 아키텍처 및 기술 스택 (Architecture & Stack)

- **Backend Framework**: Node.js (Express), Nodemon, Axios  
- **Database Layer**: Prisma ORM (Schema-first)  
- **DB**: SQLite(개발), PostgreSQL(GCP 배포)  
- **Business Logic**: Zod(유효성 검사), node-cron(스케줄링)  
- **Auth**: JWT (jsonwebtoken, bcrypt)  
- **Architecture Pattern**: Modular Pattern  
  - Controller - Route - Service 분리  
  - timer(데이터/규칙) ↔ notifications(실시간 상태) **완전 분리(S.O.C.)**

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 설정
프로젝트 루트에 `.env` 파일 생성 후 다음 값 추가:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="YOUR_OWN_VERY_SECURE_RANDOM_SECRET_KEY"
PORT=3000

### 📌 Prisma Client Singleton 체크

`src/config/db.js`에서 Prisma Client가 **단일 인스턴스(singleton)**로 export되는지 확인하세요.

---

### 📦 2. 설치 & DB 마이그레이션

모든 패키지 설치:

```bash
npm install

Prisma Client 재생성 + DB 스키마 적용
npx prisma generate
npx prisma migrate dev --name init_zeus_on
    ```

---

## 🚀 3. 서버 실행 및 테스트

서버를 실행하면 node-cron 스케줄러가 자동으로 시작됩니다.

    ```bash
    npm run dev
    ```

---

## 📡 4. 핵심 API 엔드포인트  
**Base URL: http://localhost:3000/api/**

| 기능 | Method | URI | 역할 |
|------|--------|------|------|
| 로그인 | POST | `/auth/login` | 유효한 accessToken 획득 |
| 그룹 생성 | POST | `/timers/group` | 그룹 타이머 생성 및 notifications 모듈로 초대 발송 트리거 |
| 벼락 누적 (S2S) | POST | `/timers/strike` | (Internal API) notifications 모듈이 호출하여 유저의 벼락 횟수 +1 누적 |
| 할일 완료 | POST | `/timers/group/:groupId/complete` | 번개 획득 및 벌칙자 선정/통보 로직 실행 |

