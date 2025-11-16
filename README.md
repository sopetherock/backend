# main
⚡️ ZEUS ON: "벼락치기의 신이 깨어난다"

벼락치기 성공을 위한 실시간 페널티 타이머 백엔드

💡 프로젝트 개요 (Overview)

ZEUS ON은 데드라인이 정해진 업무을 완수하기 위해 설계된 웹/앱 백엔드입니다. 단순한 타이머를 넘어, 유저가 정해진 세션 중 페이지를 이탈하거나 방치할 경우 '벼락(Thunder)' 이라는 부정적 페널티를 실시간으로 누적시킵니다.

서버는 이 페널티 횟수를 기준으로 그룹이 해체되는 순간 벌칙자를 선정하여 통보하며, 벌칙자의 친구들에게 벌칙자 알림이 가는 로직을 구현합니다. 이는 사용자의 집중 지속력과 목표 완수율을 극대화하는 것을 목표로 합니다.

🌟 주요 기능 및 핵심 로직 (Key Features)

기능

로직

기술적 특징

Dual-Point System

할 일 완료 시 번개(Lightning) 획득 (User.lightingPoints), 비활동 시 벼락(Thunder) 누적 (GroupMembership.thunderCount).

인센티브와 페널티를 이원화하여 행동 유도.

강제 벌칙 스케줄러

**node-cron**을 사용하여 40분마다 활동적이지 않은 그룹을 자체적으로 감지하고, 자동 벼락을 부과합니다.

서버의 시간 관리 신뢰성(Reliability) 보장.

실시간 페널티 누적

S2S API 호출을 통해 notifications 모듈로부터 유저의 '페이지 이탈' 신호를 받아, 해당 그룹 멤버에게 즉시 벼락 횟수를 누적합니다.

모듈 간 Axios 통신 및 Foreign Key 기반의 데이터 업데이트.

벌칙자 선정

그룹 해체 시점에 GroupMembership 테이블을 thunderCount 기준 내림차순으로 정렬하여, 벼락을 가장 많이 맞은 한 명의 유저를 확정하고 (POST /notifications/penalty로) 통보합니다.

복잡한 쿼리 로직 및 모듈 간 책임 분리.

그룹 라이프사이클

그룹 생성, 수락, 완료, 해체(deadline 만료 또는 모두 완료)의 모든 과정을 timer 모듈이 관리합니다.

Group 및 GroupMembership 모델의 status 필드를 통한 상태 관리.

🏗️ 아키텍처 및 기술 스택 (Architecture & Stack)

구분

내용

목적

백엔드

Node.js (Express), Nodemon, Axios

안정적인 서버 구동 및 모듈 간 통신 담당.

데이터 레이어

Prisma ORM (Schema-first design)

타입 안정성 확보. GCP Cloud SQL을 염두에 둔 설계.

로직/검증

Zod, node-cron

Zod로 요청 유효성 검사, node-cron으로 서버측 시간 규칙 관리.

인증

JWT (jsonwebtoken, bcrypt)

보안 토큰 기반의 사용자 인증.

아키텍처 패턴

Modular Pattern (Controller-Route-Service)

**관심사의 분리(S.O.C.)**를 적용하여 timer와 notifications 모듈의 역할을 명확히 분리함.

🚀 시작하기 (Getting Started)

1. 환경 설정

프로젝트 루트에 .env 파일을 생성하고 다음 설정을 추가합니다.

DATABASE_URL="file:./dev.db"   
JWT_SECRET="YOUR_OWN_VERY_SECURE_RANDOM_SECRET_KEY"  
PORT=3000


src/config/db.js 파일에 Prisma Client 인스턴스가 단일로 생성되어 export되는지 확인합니다.

2. 설치 및 DB 마이그레이션

모든 의존성을 설치합니다.

npm install


Prisma Client를 재빌드하고 DB 스키마를 적용합니다.

npx prisma generate  
npx prisma migrate dev --name init_zeus_on


3. 서버 실행 및 테스트

서버를 실행하면 node-cron 스케줄러가 자동으로 시작됩니다.

npm run dev


4. 핵심 API 엔드포인트 (Base URL: http://localhost:3000/api/)

기능

Method

URI

역할

로그인

POST

/auth/login

유효한 actcessToken 획득

그룹 생성

POST

/timers/group

그룹 타이머 생성 및 notifications 모듈로 초대 발송 트리거

벼락 누적 (S2S)

POST

/timers/strike

(Internal API) notifications 모듈이 호출하여 유저의 벼락 횟수 +1 누적

할일 완료

POST

/timers/group/:groupId/complete

번개 획득 및 벌칙자 선정/통보 로직 실행
