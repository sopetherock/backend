// src/modules/timers/timer.controller.js
import prisma from '../../config/db.js';
import { makeGroupWithFriends } from '../social/social.service.js';
import { notificationService } from '../notifications/notifications.service.js';

// --- 기능 1: 개인 할일 (PersonalTimer 모델 사용) ---

/**
 * API: POST /api/timers/personal
 * 기능: 개인 할일 생성 (타이머 시작)
 * 설명: 유저가 입력한 'todo'(할일 내용)와 'duration'을 PersonalTimer에 저장
 */
// src/modules/timers/timer.controller.js

export const createPersonalTimer = async (req, res) => {
  try {
    // [디버깅] req.user가 제대로 들어왔는지 확인
    console.log("🔍 요청한 유저 정보:", req.user);
    const userId = req.user?.userId || req.user?.id; // authMiddleware가 토큰에서 추출한 ID
    
    if (!userId) {
      return res.status(401).json({ message: '유저 식별 실패. 재로그인이 필요합니다.' });
    }
    // [수정] 프론트에서 deadline을 받음 (duration 아님)
    const { todo, deadline } = req.body; 

    if (!todo || !deadline) {
      return res.status(400).json({ message: '할 일과 마감 시간을 모두 입력해주세요.' });
    }

    // [핵심] Deadline(마감시간) - Now(현재시간) = Duration(초) 계산
    const now = new Date();
    const targetDate = new Date(deadline);
    
    // 밀리초 단위 차이를 1000으로 나눠서 '초(Seconds)' 단위로 변환
    const durationSeconds = Math.floor((targetDate.getTime() - now.getTime()) / 1000);

    // (혹시 모르니 예외 처리) 이미 지난 시간이라면?
    if (durationSeconds <= 0) {
       return res.status(400).json({ message: '마감 시간은 현재 시간보다 미래여야 합니다.' });
    }

    // DB에 저장 (DB는 여전히 duration을 원하므로 계산된 값을 넣어줌)
    const newTimer = await prisma.personalTimer.create({
      data: {
        todo: todo,
        ownerId: userId,
        duration: durationSeconds, // 👈 계산된 초 단위 시간 저장
        // startTime은 DB에서 @default(now())로 자동 생성됨
        status: 'running'
      },
    });

    res.status(201).json(newTimer);

  } catch (error) {
    console.error('🔥 개인 타이머 생성 오류:', error);
    // Prisma 에러 로그를 자세히 보기 위해 error 객체 전체 출력
    res.status(500).json({ message: '서버 오류', error: error.message });
  }
};
/**
 * API: POST /api/timers/personal/:timerId/complete
 * 기능: 개인 할일 완료 처리 및 번개 지급
 */
export const completePersonalTimer = async (req, res) => {
  try {
    // 1. 유저 ID 가져오기 (안전하게)
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: '유저 인증 정보가 없습니다.' });
    }

    // 2. URL 파라미터에서 timerId 가져오기
    // 주의: req.params.timerId는 문자열(String)이므로 정수(Int)로 변환해야 합니다.
    const timerIdInt = parseInt(req.params.timerId, 10);

    if (isNaN(timerIdInt)) {
      return res.status(400).json({ message: '유효하지 않은 타이머 ID입니다.' });
    }

    console.log(`🏁 타이머 완료 요청: User ${userId}, Timer ${timerIdInt}`);

    // 3. DB 업데이트
    // updateMany를 쓰는 이유: ID와 OwnerId를 동시에 체크해서 "내 타이머"인지 확인하기 위함
    const result = await prisma.personalTimer.updateMany({
      where: {
        id: timerIdInt,      // [수정] Int로 변환된 ID 사용
        ownerId: userId,     // [수정] undefined 방지
        status: 'running',   // 진행 중인 것만 완료 가능
      },
      data: {
        status: 'success',
        endTime: new Date(),
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: '타이머를 찾을 수 없거나 이미 종료되었습니다.' });
    }

    // 4. 번개 포인트 지급
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        lightingPoints: { increment: 1 },
      },
      select: { lightingPoints: true },
    });

    res.status(200).json({
      message: '타이머 완료 성공!',
      lightingPoints: updatedUser.lightingPoints,
    });

  } catch (error) {
    console.error('🔥 개인 타이머 완료 오류:', error);
    res.status(500).json({ message: '서버 오류', error: error.message });
  }
};

/**
 * API: POST /api/timers/personal/:timerId/fail
 * 기능: 개인 할일 실패 (시간 초과 등) -> 친구에게 알림 전송
 */
export const failPersonalTimer = async (req, res) => {
  try {
    const userId = req.user.id;
    const timerId = parseInt(req.params.timerId, 10);

    if (isNaN(timerId)) {
      return res.status(400).json({ message: '유효하지 않은 타이머 ID입니다.' });
    }

    // "내 running 타이머"만 원자적으로 실패 처리 (이미 처리된 타이머는 count 0)
    const result = await prisma.personalTimer.updateMany({
      where: { id: timerId, ownerId: userId, status: 'running' },
      data: { status: 'fail', endTime: new Date() },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: '타이머를 찾을 수 없거나 이미 처리되었습니다.' });
    }

    // 본인 알림 + 랜덤 친구에게 실패 알림(FriendFailureAlert 생성)은 서비스 직접 호출
    try {
      await notificationService.sendFailureAlerts(userId, timerId);
    } catch (err) {
      console.error('🔔 실패 알림 처리 오류:', err.message);
    }

    res.status(200).json({ message: '타이머 실패 처리되었습니다.' });

  } catch (error) {
    console.error('🔥 개인 타이머 실패 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};


// --- 기능 2: 그룹 타이머 (수정됨) ---

/**
 * API: POST /api/timers/group
 * 기능: 그룹 타이머 생성 (Todo, Deadline 저장)
 * 설명: 프론트에서 todo, deadline, invitedUserIds를 받아 그룹을 생성합니다.
 */
export const createGroupTimer = async (req, res) => {
  try {
    const userId = req.user.id;
    // 프론트엔드에서 보낸 데이터: { todo: "팀플 자료조사", deadline: "2024-11-20T18:00:00", invitedUserIds: [2, 3] }
    const { todo, deadline, invitedUserIds } = req.body; 

    if (!deadline || isNaN(new Date(deadline).getTime())) {
      return res.status(400).json({ message: '유효한 마감 시간(deadline)이 필요합니다.' });
    }

    // 1. Social 서비스의 그룹 생성 로직 호출
    // (makeGroupWithFriends 함수 내부에서 prisma.group.create를 할 때 todo, deadline을 넣도록 수정 필요)
    // 여기서는 직접 create하는 로직으로 보여드릴게요 (직관적인 이해를 위해)
    
    const newGroup = await prisma.group.create({
      data: {
        todo: todo,           // 그룹 공통 할일 저장
        deadline: new Date(deadline), // 마감 시간 저장
        status: 'ACTIVE',
        
        // 멤버 연결
        members: {
          create: [
            { userId: userId, status: 'ACCEPTED' }, // 방장 (나)
            // 초대된 친구들 (검증 로직 생략하고 바로 넣는 예시)
            ...(invitedUserIds || []).map(id => ({ userId: id, status: 'INVITED' }))
          ]
        }
      },
      include: { members: true }
    });

    // 2. 초대 알림 발송 (기존 로직)
    if (invitedUserIds && invitedUserIds.length > 0) {
      // 서비스 직접 호출 (서버리스 환경에서 HTTP 자기호출/응답 후 비동기 작업은 유실될 수 있음)
      try {
        await notificationService.sendGroupInvites(
          invitedUserIds,
          req.user.nickname || '친구',
          todo || '그룹 타이머',
          newGroup.id
        );
      } catch (err) {
        console.error('🔥 초대 알림 전송 실패:', err.message);
      }
    }

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('🔥 그룹 타이머 생성 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * API: POST /api/timers/group/:groupId/accept
 * 기능: 그룹 초대 수락 (INVITED -> ACCEPTED)
 */
export const acceptGroupInvite = async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = parseInt(req.params.groupId, 10);
    if (isNaN(groupId)) {
      return res.status(400).json({ message: '유효하지 않은 그룹 ID입니다.' });
    }

    const result = await prisma.groupMembership.updateMany({
      where: { userId, groupId, status: 'INVITED', group: { status: 'ACTIVE' } },
      data: { status: 'ACCEPTED' },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: '수락할 초대가 없거나 이미 처리되었습니다.' });
    }

    res.status(200).json({ message: '그룹 초대를 수락했습니다.', groupId });
  } catch (error) {
    console.error('🔥 그룹 초대 수락 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * API: POST /api/timers/group/:groupId/decline
 * 기능: 그룹 초대 거절 (INVITED -> DECLINED)
 */
export const declineGroupInvite = async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = parseInt(req.params.groupId, 10);
    if (isNaN(groupId)) {
      return res.status(400).json({ message: '유효하지 않은 그룹 ID입니다.' });
    }

    const result = await prisma.groupMembership.updateMany({
      where: { userId, groupId, status: 'INVITED' },
      data: { status: 'DECLINED' },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: '거절할 초대가 없거나 이미 처리되었습니다.' });
    }

    // 남은 참여자가 모두 끝난 상태였다면 그룹을 정리
    await findLoserAndDisband(groupId);

    res.status(200).json({ message: '그룹 초대를 거절했습니다.', groupId });
  } catch (error) {
    console.error('🔥 그룹 초대 거절 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * API: POST /api/timers/group/:groupId/complete
 * 기능: 그룹 할일 "개별" 성공 처리
 * 설명: 내 멤버십 상태를 COMPLETED로 바꾸고 번개를 받습니다. (그룹은 그대로 유지될 수도 있음)
 */
export const completeGroupTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = parseInt(req.params.groupId);

    // 1. "나의" 멤버십 상태를 COMPLETED로 변경 (내 목록에서 사라짐)
    const updateResult = await prisma.groupMembership.updateMany({
      where: {
        userId: userId,
        groupId: groupId,
        status: 'ACCEPTED', // 진행 중인 상태만
      },
      data: {
        status: 'COMPLETED', // 완료 처리
      },
    });

    if (updateResult.count === 0) {
        return res.status(404).json({ message: "이미 완료했거나 참여하지 않은 그룹입니다." });
    }

    // 2. [보상] 유저 개인에게 번개 지급
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { lightingPoints: { increment: 1 } },
      select: { lightingPoints: true }
    });

    // 3. 전원 완료(또는 마감 경과) 시 그룹 해체 + 벌칙자 선정 (조건 미충족이면 내부에서 return)
    await findLoserAndDisband(groupId);

    res.status(200).json({ 
      message: '그룹 할 일 완료! (번개 +1)',
      lightingPoints: updatedUser.lightingPoints 
    });
  } catch (error) {
    console.error('🔥 그룹 할일 완료 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * [신규 추가] API: POST /api/timers/group/:groupId/fail
 * 기능: 그룹 할일 "개별" 실패/포기
 * 설명: 내 멤버십 상태를 FAILED로 바꾸고 친구에게 알림을 보냅니다.
 */
export const failGroupTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = parseInt(req.params.groupId);

    // 1. "나의" 멤버십 상태를 FAILED로 변경 (내 목록에서 사라짐)
    const updateResult = await prisma.groupMembership.updateMany({
      where: {
        userId: userId,
        groupId: groupId,
        status: 'ACCEPTED',
      },
      data: {
        status: 'FAILED', // 실패 처리
      },
    });

    if (updateResult.count === 0) {
        return res.status(404).json({ message: "이미 종료되었거나 참여하지 않은 그룹입니다." });
    }

    // 2. [알림] 친구에게 실패 알림 보내기
    // 내 친구 중 한 명 찾기
    const friendRelation = await prisma.friend.findFirst({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
          status: 'ACCEPTED',
        },
    });
  
    if (friendRelation) {
        const friendId = (friendRelation.requesterId === userId) 
            ? friendRelation.addresseeId 
            : friendRelation.requesterId;
        
        // 주의: 현재 스키마의 FriendFailureAlert는 failedTodoId(개인타이머)만 연결되어 있습니다.
        // 그룹 실패를 기록하려면 스키마에 `failedGroupId` 필드를 추가하거나,
        // 당장은 알림만 보내는 방식(DB저장 X, Axios 전송 O)을 써야 합니다.
        // 여기서는 "알림 서비스로 전송"하는 코드를 작성합니다.
        
        // 서비스 직접 호출 (기존 동작 유지: 알림 수신 대상은 실패한 본인 — 설계 확인 필요)
        try {
          await notificationService.sendLightningAlert(userId, groupId);
        } catch (err) {
          console.error('🔔 그룹 실패 알림 전송 실패:', err.message);
        }

        console.log(`🔔 그룹 할일 포기: 친구(ID:${friendId})에게 알림 전송 시도`);
    }

    // 남은 참여자가 모두 끝났다면 그룹 해체 + 벌칙자 선정
    await findLoserAndDisband(groupId);

    res.status(200).json({ message: '그룹 할 일을 포기했습니다. (목록에서 제거됨)' });

  } catch (error) {
    console.error('🔥 그룹 할일 실패 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

// --- 기능 3: 벼락 및 벌칙 ---

/**
 * API: POST /api/timers/strike
 * 기능: (C번) 벼락 1회 누적 (Notification 모듈이 호출)
 */
export const addStrike = async (req, res) => {
  try {
    const { userId, groupId } = req.body;

    if (!userId || !groupId) {
      return res.status(400).json({ message: 'userId와 groupId가 필요합니다.' });
    }

    // 'ACCEPTED' 상태인 (아직 완료 안 한) 유저의 'thunderCount' 1 증가
    await prisma.groupMembership.updateMany({
      where: {
        userId: userId,
        groupId: groupId,
        status: 'ACCEPTED', // 완료한 사람은 벼락 안 맞음
      },
      data: {
        thunderCount: {
          increment: 1, // '벼락' 누적
        },
      },
    });

    // "이 그룹에서 방금 벼락이 발생했음"을 DB에 기록
    await prisma.group.update({
      where: { id: groupId },
      data: { lastStrikeAt: new Date() }, // ⬅️ 현재 시간으로 갱신
    });

    // 알림은 서비스 직접 호출 (알림이 실패해도 벼락 누적은 성공으로 처리)
    try {
      await notificationService.sendLightningAlert(userId, groupId);
    } catch (err) {
      console.error('⚡ 벼락 알림 요청 실패:', err.message);
    }

    res.status(200).json({ message: 'Strike processed.' });
  } catch (error) {
    console.error('🔥 벼락 누적 API 오류:', error);
    res.status(500).json({ message: '벼락 누적 중 서버 오류' });
  }
};

/**
 * 내부 함수 (API 아님)
 * 기능: 자동 벼락 — 완료 안 한(ACCEPTED) 멤버 중 랜덤 1명에게 벼락 +1 후 알림
 * (40분 크론, /notifications/trigger-auto-strike 에서 호출)
 */
export async function applyAutoStrike(groupId) {
  const candidates = await prisma.groupMembership.findMany({
    where: { groupId, status: 'ACCEPTED', group: { status: 'ACTIVE' } },
    select: { userId: true },
  });
  if (candidates.length === 0) return null;

  const target = candidates[Math.floor(Math.random() * candidates.length)];

  await prisma.groupMembership.updateMany({
    where: { groupId, userId: target.userId, status: 'ACCEPTED' },
    data: { thunderCount: { increment: 1 } },
  });
  await prisma.group.update({
    where: { id: groupId },
    data: { lastStrikeAt: new Date() },
  });

  try {
    await notificationService.sendLightningAlert(target.userId, groupId);
  } catch (err) {
    console.error('⚡ 자동 벼락 알림 실패:', err.message);
  }
  return target.userId;
}

/**
 * 내부 함수 (API 아님)
 * 기능: 그룹 해체 조건 확인 및 벌칙자 선정/통보
 */
async function findLoserAndDisband(groupId) {
  try {
    // 1. 그룹이 이미 해체되었는지 확인
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        status: 'ACTIVE', // 'ACTIVE' 상태인 그룹만 처리
      },
      include: {
        members: {
          where: {
            status: 'ACCEPTED', // 아직 완료 안 한 사람만 조회
          },
        },
      },
    });

    // 그룹이 없거나, 이미 해체됐으면 중단
    if (!group) {
      return;
    }

    // 2. 그룹 해체 조건 확인
    const deadlinePassed = new Date() > group.deadline;
    const allMembersCompleted = group.members.length === 0;

    // 3. 조건 미충족 시 중단 (그룹 아직 활성)
    if (!deadlinePassed && !allMembersCompleted) {
      return;
    }

    // 4. [그룹 해체!]
    await prisma.group.update({
      where: { id: groupId },
      data: { status: 'COMPLETED' },
    });

    // 5. 벌칙자 선정: 벼락(thunderCount)이 가장 많은 사람 검색
    const allMembers = await prisma.groupMembership.findMany({
      where: { groupId: groupId },
      orderBy: { thunderCount: 'desc' }, // 벼락 많은 순 정렬
    });

    if (allMembers.length === 0) return; // 멤버가 없으면 종료

    const loser = allMembers[0]; // 0번이 벼락 1등

    // (만약 벼락 0개인 사람은 제외하는 등 추가 로직이 필요하면 여기에)
    if (loser.thunderCount === 0) {
      return; // 벼락 맞은 사람이 없으면 벌칙 없음
    }

    // 6. [B] Timer -> Notifications (벌칙자 통보)
    // 벌칙을 내리는 주체를 '그룹 벌칙 시스템'으로 지정
    await notificationService.sendStrikePenaltyAlert(
        loser.userId, 
        '그룹 벌칙 시스템' // 👈 벌칙을 내린 주체를 명확히 지정
    )
      .catch((err) => {
        console.error('🔥 벌칙 알림 전송 실패:', err.message);
      });
  } catch (error) {
    console.error('🔥 그룹 해체/벌칙자 선정 오류:', error);
  }
}

/**
 * API: GET /api/timer/urgent
 * 기능: 위젯용 - 마감이 가장 임박한(24시간 이내) 할 일 1개 조회
 * (푸시 알림 없이 데이터만 제공)
 */
export const getUrgentTask = async (req, res) => {
  try {
    const userId = req.user.id; // authMiddleware가 준 유저 ID
    const now = new Date();
    const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // PersonalTimer에는 deadline 컬럼이 없으므로 startTime + duration(초)으로 마감 시각을 계산
    const running = await prisma.personalTimer.findMany({
      where: { ownerId: userId, status: 'running' },
      select: { id: true, todo: true, startTime: true, duration: true },
    });

    const urgentTask = running
      .map((t) => ({
        id: t.id,
        todo: t.todo,
        deadline: new Date(t.startTime.getTime() + t.duration * 1000),
      }))
      .filter((t) => t.deadline > now && t.deadline <= limit)
      .sort((x, y) => x.deadline - y.deadline)[0];

    // 급한 게 없으면 null 반환 (위젯이 '할 일 없음' 띄우도록)
    res.status(200).json({ task: urgentTask ?? null });

  } catch (error) {
    console.error('🔥 위젯 데이터 조회 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * API: GET /api/timers
 * 기능: '투두 스크린'용 데이터 조회
 * 설명: 나의 '진행 중(running/ACCEPTED)'인 개인 타이머와 그룹 타이머를 모두 가져옵니다.
 */
export const getRunningTimers = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. 개인 타이머 조회 (status: 'running')
    const personalTimers = await prisma.personalTimer.findMany({
      where: {
        ownerId: userId,
        status: 'running',
      },
      orderBy: { startTime: 'desc' }
    });

    // 2. 그룹 타이머 조회 (Membership status: 'ACCEPTED')
    // 그룹 자체는 ACTIVE여도, 내가 이미 완료(COMPLETED)했으면 목록에 안 떠야 함!
    const groupTimers = await prisma.groupMembership.findMany({
      where: {
        userId: userId,
        status: 'ACCEPTED', // 아직 완료 안 한 상태
        group: {
          status: 'ACTIVE' // 그룹 자체도 살아있는 상태
        }
      },
      include: {
        group: true, // 그룹의 todo, deadline 정보 가져오기
      },
      orderBy: { group: { deadline: 'asc' } }
    });

    // 3. 두 목록을 합쳐서 반환 (프론트에서 구분해서 보여줘도 됨)
    res.status(200).json({
      personal: personalTimers,
      group: groupTimers, // 프론트에서는 groupTimers.map(m => m.group) 식으로 사용
    });

  } catch (error) {
    console.error('🔥 타이머 목록 조회 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};