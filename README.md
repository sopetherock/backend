# ⚡️ ZEUS ON
“벼락치기의 신이 깨어난다”
> **벼락치기 성공을 위한 실시간 페널티 타이머 백엔드**

---

## 💡 프로젝트 개요 (Overview)
**ZEUS ON**은 데드라인이 정해진 업무를 완수하기 위해 설계된 웹/앱 서비스입니다.
단순한 타이머가 아니라, 유저가 세션 중 페이지를 이탈하거나 방치할 경우
**'벼락(Thunder)'이라는 페널티를 실시간으로 누적**합니다.

서버는 이 페널티를 기반으로 **그룹 해체 시 벌칙자를 선정**하고 통보하며,
벌칙자의 친구들에게도 알림을 전송합니다.

- 백엔드(이 저장소): Node.js / Express / Prisma
- 프런트엔드: [sopetherock/frontend](https://github.com/sopetherock/frontend) (Flutter)

---

## 🌟 주요 기능 및 핵심 로직 (Key Features)

| 기능 | 로직 | 기술적 특징 |
|------|------|--------------|
| Dual-Point System | 할 일 완료 시 **번개(Lightning)** 획득 (`User.lightingPoints`), 비활동 시 **벼락(Thunder)** 누적 (`GroupMembership.thunderCount`) | 인센티브 + 페널티 이원화로 행동 유도 |
| 개인 타이머 | 마감 시각(deadline)을 받아 남은 시간(초)을 서버에서 계산해 저장, 완료/실패 처리 | 실패 시 본인 알림 + 친구에게 실패 알림(`FriendFailureAlert`) |
| 그룹 라이프사이클 | 그룹 생성 → 초대 수락 → 완료 → 해체(마감 경과 또는 전원 완료) 전 과정을 timer 모듈이 관리 | `Group`, `GroupMembership`의 `status` 필드 기반 상태 관리 |
| 실시간 페널티 누적 | notifications 모듈이 **S2S API**(`/timers/strike`)로 "페이지 이탈" 신호 전달 → 해당 멤버에 벼락 +1 | 모듈 간 책임 분리, FK 기반 업데이트 |
| 벌칙자 선정 | 그룹 해체 시 `GroupMembership`을 **thunderCount 내림차순 정렬**, 가장 높은 유저를 벌칙자로 선정해 알림 기록·푸시 발송 | 복잡 쿼리 및 모듈 간 책임 분리 |
| 강제 벌칙 스케줄러 | `node-cron`으로 **40분마다 비활동 그룹을 탐지**해 완료 안 한 멤버 중 1명에게 벼락 부과 | 상시 서버에서만 동작(서버리스 배포에서는 비활성, 아래 "알려진 한계" 참고) |
| 소셜 | 유저 검색, 친구 요청/수락/삭제, 친구 목록, 친구를 초대한 그룹 생성 | social 모듈 |
| 퀘스트 | 퀘스트 완료 시 번개 포인트 +1 | quests 모듈 |

---

## 🏗️ 아키텍처 및 기술 스택 (Architecture & Stack)

- **Backend Framework**: Node.js (Express 5), Nodemon, Axios
- **Database Layer**: Prisma ORM (Schema-first)
- **DB**: PostgreSQL (배포: Neon). 스키마가 PostgreSQL 기준이므로 로컬 개발에도 PostgreSQL이 필요합니다.
- **Business Logic**: Zod(유효성 검사), node-cron(스케줄링)
- **Auth**: **Firebase Authentication** — 클라이언트가 받은 Firebase **ID 토큰**을 `Authorization: Bearer` 로 보내면 서버가 Firebase Admin SDK로 검증합니다. 이메일 인증(`email_verified`)을 마치지 않은 요청은 403으로 거절합니다.
- **Push**: Firebase Cloud Messaging (Firebase Admin SDK)
- **Deploy**: AWS Lambda (컨테이너 이미지, AWS Lambda Web Adapter) + Neon PostgreSQL. 프런트(Flutter Web)는 Firebase Hosting.
- **Architecture Pattern**: Modular Pattern
  - Controller - Route - Service 분리
  - timer(데이터/규칙) ↔ notifications(알림) 모듈 분리(S.O.C.)

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 설정
프로젝트 루트에 `.env` 파일 생성 후 다음 값 추가:

```env
# PostgreSQL 연결 문자열 (예: Neon, 로컬 Postgres)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
PORT=3000
# Firebase Admin 키 — 둘 중 하나
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
# (또는 프로젝트 루트에 serviceAccountKey.json 을 두기. 절대 커밋 금지)
# (선택) 크론 스케줄러 끄기 — Lambda 등 서버리스 환경
# DISABLE_CRON=true
```

> `.env`와 `serviceAccountKey.json`은 `.gitignore`에 포함되어 있습니다. 실제 값은 절대 커밋하지 마세요.

### 📌 Prisma Client Singleton 체크
`src/config/db.js`에서 Prisma Client가 **단일 인스턴스(singleton)**로 export되는지 확인하세요.

### 2. 설치 & DB 스키마 적용

```bash
npm install
npx prisma generate
npx prisma db push
```

> `prisma/migrations`는 SQLite 기준이라 PostgreSQL에는 `migrate`를 쓰지 않고 `db push`로 스키마를 반영합니다. 스키마를 바꿀 때마다 다시 실행하세요.

### 3. 서버 실행

```bash
npm run dev
```

서버를 실행하면 node-cron 스케줄러가 자동으로 시작됩니다(`DISABLE_CRON=true` 이면 시작하지 않음).
DB 상태는 Prisma Studio로 확인할 수 있습니다.

```bash
npx prisma studio
```

---

## 📡 4. 핵심 API 엔드포인트
**Base URL: `http://localhost:3000/api/`** (배포 환경에서는 배포된 서버 주소로 교체)

인증이 필요한 API(✅)는 `Authorization: Bearer <Firebase ID 토큰>` 헤더를 사용합니다.
로그인은 클라이언트가 Firebase Auth로 직접 수행하고, 받은 ID 토큰으로 서버를 호출합니다.

### Auth — `/auth`
| 기능 | Method | URI | 인증 | 역할 |
|------|--------|------|------|------|
| DB 유저 등록 | POST | `/auth/register-db` | - | Firebase 가입 직후 `firebaseUid`로 서버 DB에 유저 생성 |
| 내 정보 | GET | `/auth/me` | ✅ | ID 토큰 검증 후 DB의 유저 정보 반환 |
| 아이디 중복 확인 | GET | `/auth/check-username/:username` | - | username 사용 가능 여부 |

### Timers — `/timers`
| 기능 | Method | URI | 인증 | 역할 |
|------|--------|------|------|------|
| 진행 중 타이머 목록 | GET | `/timers` | ✅ | 내 개인 타이머 + 참여 중인 그룹 |
| 개인 타이머 생성 | POST | `/timers/personal` | ✅ | `todo`, `deadline` |
| 개인 타이머 완료 | POST | `/timers/personal/:timerId/complete` | ✅ | 번개 획득 |
| 개인 타이머 실패 | POST | `/timers/personal/:timerId/fail` | ✅ | 본인·친구에게 실패 알림 |
| 그룹 생성 | POST | `/timers/group` | ✅ | `todo`, `deadline`, `invitedUserIds` / 초대 알림 발송 |
| 그룹 초대 수락 | POST | `/timers/group/:groupId/accept` | ✅ | 초대 상태 → 참여 중 |
| 그룹 초대 거절 | POST | `/timers/group/:groupId/decline` | ✅ | |
| 그룹 할 일 완료 | POST | `/timers/group/:groupId/complete` | ✅ | 번개 획득, 전원 완료 시 그룹 해체 + 벌칙자 선정 |
| 그룹 할 일 포기 | POST | `/timers/group/:groupId/fail` | ✅ | |
| 벼락 누적 (S2S) | POST | `/timers/strike` | - | (Internal API) 유저의 벼락 횟수 +1 |
| 임박한 할 일 조회 | GET | `/timers/urgent` | ✅ | 24시간 이내 마감 1건(위젯용) |

### Social — `/social`
| 기능 | Method | URI |
|------|--------|------|
| 유저 검색 | GET | `/social/search/:username` |
| 친구 요청 | POST | `/social/add/:targetId` |
| 친구 요청 수락 | POST | `/social/accept/:friendId` (Friend 행 ID) |
| 친구 목록 | GET | `/social/friends` |
| 받은 요청 목록 | GET | `/social/requests` |
| 요청 삭제 | DELETE | `/social/request/:friendId` |
| 친구 초대 그룹 생성 | POST | `/social/groups` |

### Quests / Notifications
| 기능 | Method | URI | 인증 |
|------|--------|------|------|
| 퀘스트 완료 | POST | `/quests/complete` | ✅ |
| 친구 실패 알림 액션 | POST | `/notifications/alert/:alertId/action` | ✅ |
| 초대/벼락/자동벼락 알림 (Internal) | POST | `/notifications/invite`, `/lightning`, `/trigger-auto-strike` | - |

---

## 🧪 5. 검증 (Postman)

앱이 완성되기 전에 서버를 **Postman으로 먼저 검증**했습니다. 사용자 2명이 그룹을 만들고 완료하기까지의 시나리오를 문서로 정리해 실행했고, 이 과정에서 찾은 라우트·로직 오류를 수정했습니다.

**시나리오**
`가입·이메일 인증 → 로그인(Firebase ID 토큰) → 친구 맺기 → 개인 타이머 생성·완료·실패 → 그룹 생성(유저2 초대) → 초대 수락 → 벼락 5회 → 두 유저 완료 → 벌칙자 선정`

**검증 중 수정한 오류**
- [`e6689ab`](https://github.com/sopetherock/backend/commit/e6689ab) 라우트 오류 수정
- [`761da5b`](https://github.com/sopetherock/backend/commit/761da5b) 테스트 중 발견한 버그 수정
- [`2b97862`](https://github.com/sopetherock/backend/commit/2b97862) 타이머·소셜 모듈 간 로직 오류 수정

---

## ⚠️ 6. 알려진 한계

- 서버리스(Lambda)에서는 `node-cron` 스케줄러가 동작하지 않아 `DISABLE_CRON=true`로 끕니다. 40분 자동 벼락은 상시 서버 또는 외부 스케줄러(EventBridge 등)가 필요합니다. 마감이 지난 그룹의 해체는 완료·포기·거절이 일어나는 시점에 처리됩니다.
- 푸시 알림용 FCM 토큰 저장 API(`POST /api/fcm/token`)가 아직 없습니다.
- 웹(Flutter Web)에서는 FCM/로컬 알림이 지원되지 않습니다. 알림은 안드로이드에서만 확인할 수 있습니다.
- 그룹 초대 수락/거절 API는 서버에 있으나, 앱 화면 연결은 진행 중입니다.
- `/timers/strike` 등 내부(S2S) API에 인증이 없습니다. 외부에 공개된 환경에서는 접근 제한이 필요합니다.
- 자동 테스트가 없습니다. 현재는 위 Postman 시나리오로 검증합니다.
