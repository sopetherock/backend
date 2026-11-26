# Node.js 공식 이미지 사용
FROM node:20-slim

# Prisma 엔진이 필요로 하는 openssl (slim 이미지에는 없음)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# AWS Lambda Web Adapter: Express 코드 수정 없이 Lambda에서 실행
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Prisma 클라이언트 생성
RUN npx prisma generate

ENV PORT=8080
ENV AWS_LWA_PORT=8080
ENV DISABLE_CRON=true
EXPOSE 8080

CMD [ "npm", "start" ]
