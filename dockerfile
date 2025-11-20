# Node.js 공식 이미지 사용
FROM node:20-slim

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 종속성 설치 (package.json 복사)
COPY package*.json ./
# 개발 종속성(예: nodemon)을 제외하고 설치하여 이미지 크기를 줄입니다.
RUN npm install --omit=dev

# 모든 소스 코드 복사 (src 폴더 포함)
COPY . .

# Prisma 클라이언트 생성 (데이터베이스 연결을 위해 필수)
# 이 명령어가 컨테이너 환경에 맞는 클라이언트 바이너리를 빌드합니다.
RUN npx prisma generate

# 서버가 수신 대기할 포트 (Cloud Run은 기본적으로 8080을 사용합니다)
EXPOSE 8080 

# 서버 시작 명령어 (package.json의 start 스크립트 그대로 사용)
CMD [ "npm", "start" ]