//src/modules/timers/timer.count.js
import cron from 'node-cron';
import prisma from '../../config/db.js'; // (prisma 경로 확인)
import axios from 'axios';

//40분마다 자동 벼락을 실행하는 스케줄러 함수
const runAutoStrikeScheduler = async () => {
    const taskName = '[Cron Job - 40분 자동 벼락]';
    console.log(`${taskName} 작업 탐색 시작...`);
    try {
        const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000);
        // 1. "ACTIVE" 상태이고, "마지막 벼락 시간이 40분보다 오래된" 그룹 탐색
        const targetGroups = await prisma.group.findMany({
            where: {
                status: 'ACTIVE',
                lastStrikeAt: {
                    lt: fortyMinutesAgo, // lt = less than (40분 전보다 오래됨)
                },
            },
        });
        if (!targetGroups || targetGroups.length === 0) {
            console.log(`${taskName} 대상 그룹 없음.`);
            return;
        }
        console.log(`${taskName} ${targetGroups.length}개 그룹 대상 자동 벼락 실행.`);
        // 2. 찾은 모든 그룹에 대해 벼락 요청
        for (const group of targetGroups) {
            // 2-1. [중복 방지] 벼락 시간을 "지금"으로 먼저 갱신
            // (Notifications API 호출이 실패하더라도, 다음 1분에 또 실행되지 않도록)
            await prisma.group.update({
                where: { id: group.id },
                data: { lastStrikeAt: new Date() },
            });
            // 2-2. [Timer -> Notifications]
            // "알아서 벼락 내려"라고 Notifications 모듈에 트리거 전송
            const strikeTriggerApi = 'http://localhost:3000/api/notifications/trigger-auto-strike';
  
            axios.post(strikeTriggerApi, { groupId: group.id })
                .catch(err => {
                    // 알림 전송 실패는 별도로 로깅
                    console.error(`${taskName} 그룹 ${group.id} 알림 전송 실패:`, err.message);
                });
        }
    } catch (error) {
        console.error(`🔥 ${taskName} 스케줄러 오류:`, error);
    }
};

/**
 * 개인 할일 벼락치기 실패 감지 및 알림 처리 스케줄러
 */
const runTodoFailureDetection = async () => {
    const taskName = '[Cron Job - Todo 실패 감지]';
    console.log(`${taskName} 작업 탐색 시작...`);
    const now = new Date();

    try {
        // 1. 실패한 개인 할일 목록 조회
        // 조건: 
        // a) status: 'pending' (아직 완료/실패 처리 안 됨)
        // b) deadline: 현재 시간보다 작음 (마감 기한이 지남)
        const failedTodos = await prisma.personalTimer.findMany({
            where: {
                status: 'running',
                deadline: {
                    lt: now, // 마감 기한이 현재 시간보다 작음
                },
                // PersonalTimer가 있는 경우에만 실패로 처리하도록 필터링 (선택 사항)
                // 현재 스키마에서는 모든 Todo에 deadline이 있으므로, deadline만으로 충분함.
            },
            select: {
                id: true,
                ownerId: true,
            },
        });

        if (!failedTodos || failedTodos.length === 0) {
            console.log(`${taskName} 대상 할일 없음.`);
            return;
        }

        console.log(`${taskName} ${failedTodos.length}개 할일 실패 처리 시작.`);

        // 2. 실패 처리 및 알림 발송
        for (const todo of failedTodos) {
            // A. Todo 상태를 'failed'로 업데이트
            await prisma.personalTimer.update({
                where: { id: todo.id },
                data: { status: 'failed' },
            });

            // B. 알림 모듈에 실패 통보 및 친구 알림 요청 (Service 직접 호출)
            // Notifications Service를 비동기로 가져와 순환 참조를 피함
            const notificationService = (await import('./../notifications/notifications.service.js')).notificationService; 
            
            await notificationService.sendFailureAlerts(todo.ownerId, todo.id)
                .catch(err => {
                    console.error(`${taskName} Todo ${todo.id} 알림 전송 실패:`, err.message);
                });
        }

    } catch (error) {
        console.error(`🔥 ${taskName} 스케줄러 오류:`, error);
    }
};

//서버가 시작될 때 모든 타이머 크론 작업을 실행하는 함수
export const startTimerCronJobs = () => {
    // 올바른 cron 표현식(5개 필드)을 사용합니다. 여기서는 매 40분마다 실행합니다.
    const task = cron.schedule('*/40 * * * *', runAutoStrikeScheduler);
    // 매 10분마다 개인 할일 실패 감지 작업 실행
    const failureDetectionTask = cron.schedule('*/10 * * * *', runTodoFailureDetection);
    return [task, failureDetectionTask];
}

// (나중에 다른 스케줄러가 생기면 여기에 추가) // 
//cron.schedule('...', anotherJob); }
    
