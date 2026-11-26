//src/modules/timers/timer.count.js
import cron from 'node-cron';
import prisma from '../../config/db.js'; // (prisma 경로 확인)
import { notificationService } from '../notifications/notifications.service.js';
import { applyAutoStrike } from './timer.controller.js';

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
            // 2-2. 자동 벼락 적용 (HTTP 자기호출 대신 서비스 함수 직접 호출)
            await applyAutoStrike(group.id).catch(err => {
                console.error(`${taskName} 그룹 ${group.id} 자동 벼락 실패:`, err.message);
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
    const now = Date.now();

    try {
        // PersonalTimer에는 deadline 컬럼이 없으므로 startTime + duration(초)으로 마감 시각을 계산한다.
        const runningTimers = await prisma.personalTimer.findMany({
            where: { status: 'running' },
            select: { id: true, ownerId: true, startTime: true, duration: true },
        });
        const failedTimers = runningTimers.filter(
            (t) => t.startTime.getTime() + t.duration * 1000 < now
        );

        if (failedTimers.length === 0) {
            console.log(`${taskName} 대상 할일 없음.`);
            return;
        }

        console.log(`${taskName} ${failedTimers.length}개 할일 실패 처리 시작.`);

        for (const timer of failedTimers) {
            // 사용자가 동시에 완료/실패 처리했을 수 있으므로 running 일 때만 변경
            const result = await prisma.personalTimer.updateMany({
                where: { id: timer.id, status: 'running' },
                data: { status: 'fail', endTime: new Date() },
            });
            if (result.count === 0) continue;

            await notificationService.sendFailureAlerts(timer.ownerId, timer.id)
                .catch(err => {
                    console.error(`${taskName} Timer ${timer.id} 알림 전송 실패:`, err.message);
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
    
