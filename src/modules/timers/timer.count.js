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



//서버가 시작될 때 모든 타이머 크론 작업을 실행하는 함수
export const startTimerCronJobs = () => {
    // 올바른 cron 표현식(5개 필드)을 사용합니다. 여기서는 매 40분마다 실행합니다.
    const task = cron.schedule('*/40 * * * *', runAutoStrikeScheduler);
    return task;
}

// (나중에 다른 스케줄러가 생기면 여기에 추가) // 
//cron.schedule('...', anotherJob); }
    
