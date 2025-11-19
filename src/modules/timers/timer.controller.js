// src/modules/timers/timer.controller.js
import prisma from '../../config/db.js';
import axios from 'axios';
import { makeGroupWithFriends } from '../social/social.service.js';

// --- 기능 1: 개인 할일 (PersonalTimer 모델 사용) ---

/**
 * API: POST /api/timers/personal
 * 기능: 개인 할일 생성 (타이머 시작)
 * 설명: 유저가 입력한 'todo'(할일 내용)와 'duration'을 PersonalTimer에 저장
 */
export const createPersonalTimer = async (req, res) => {
  try {
    // 프론트에서 { todo: "수학 3단원 벼락치기", duration: 1800 } 이렇게 보냄
    const { todo, duration } = req.body; 
    const userId = req.user.id; // authMiddleware 통과한 유저 ID

    // PersonalTimer 모델에 바로 저장
    const newTimer = await prisma.personalTimer.create({
      data: {
        todo: todo,         // 스키마의 todo 필드에 바로 저장
        duration: duration, // 스키마의 duration 필드에 바로 저장
        ownerId: userId,    // owner 연결
        // startTime은 default(now())라 자동 생성
        // status는 default("running")이라 자동 생성
      },
    });

    res.status(201).json(newTimer);
  } catch (error) {
    console.error('🔥 개인 타이머 생성 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * API: POST /api/timers/personal/:timerId/complete
 * 기능: 개인 할일 완료 처리 및 번개 지급
 */
export const completePersonalTimer = async (req, res) => {
  try {
    const userId = req.user.userId;
    const timerId = parseInt(req.params.timerId);

    // 1. 내 타이머 중 'running'인 것을 찾아 'success'로 업데이트
    const updatedTimer = await prisma.personalTimer.updateMany({
      where: {
        id: timerId,
        ownerId: userId,
        status: 'running', // 진행 중인 것만 완료 가능
      },
      data: {
        status: 'success', // 완료 상태 (목록에서 제외됨)
        endTime: new Date(), // 끝난 시간 기록
      },
    });

    // 업데이트된 갯수가 0이면 예외 처리
    if (updatedTimer.count === 0) {
      return res.status(404).json({ message: '이미 끝났거나 존재하지 않는 타이머입니다.' });
    }

    // 2. [보상] 번개 포인트 +1 지급
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        lightingPoints: { increment: 1 },
      },
      select: { lightingPoints: true },
    });

    res.status(200).json({
      message: '타이머 성공! (번개 +1)',
      lightingPoints: user.lightingPoints,
    });

  } catch (error) {
    console.error('🔥 개인 타이머 완료 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * API: POST /api/timers/personal/:timerId/fail
 * 기능: 개인 할일 실패 (시간 초과 등) -> 친구에게 알림 전송
 */
export const failPersonalTimer = async (req, res) => {
  try {
    const userId = req.user.id;
    const todoId = parseInt(req.params.todoId);

    // 1. 타이머 상태를 'fail'로 변경
    // findFirst로 먼저 확인 후 update (관계 생성을 위해 ID가 확실히 필요함)
    const targetTimer = await prisma.personalTimer.findFirst({
      where: { id: todoId, ownerId: userId, status: 'running' },
    });

    if (!targetTimer) {
      return res.status(404).json({ message: '이미 처리된 타이머입니다.' });
    }

    // 상태 실패로 변경
    await prisma.personalTimer.update({
      where: { id: todoId },
      data: {
        status: 'fail',
        endTime: new Date(),
      },
    });

    // 2. 알림을 보낼 친구 찾기 (랜덤 1명 혹은 지정된 로직)
    // 예: 친구 관계 중 'ACCEPTED'인 사람 조회
    const friendRelation = await prisma.friend.findFirst({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: 'ACCEPTED',
      },
    });

    if (friendRelation) {
      // 친구 ID 추출
      const friendId = (friendRelation.requesterId === userId)
        ? friendRelation.addresseeId
        : friendRelation.requesterId;

      // 3. FriendFailureAlert 생성 (친구에게 알림)
      // 주의: 스키마의 FriendFailureAlert에서 failedTodoId가 PersonalTimer의 ID를 참조한다고 가정
      await prisma.friendFailureAlert.create({
        data: {
          failedUserId: userId,
          notifiedFriendId: friendId,
          failedTodoId: timerId, // 실패한 PersonalTimer의 ID
          status: 'SENT',
        },
      });
      
      console.log(`🔔 친구(ID:${friendId})에게 벼락치기 실패 알림 전송`);
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
      const notificationApiUrl = `http://localhost:3000/api/notifications/invite`;
      axios.post(notificationApiUrl, {
        groupId: newGroup.id,
        inviterName: req.user.nickname || "친구",
        invitedUserIds: invitedUserIds,
      }).catch(err => console.error("🔥 초대 알림 전송 실패:", err.message));
    }

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('🔥 그룹 타이머 생성 오류:', error);
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

    // 3. (선택사항) 그룹의 모든 멤버가 완료했는지 체크하여 그룹 상태를 변경하는 로직
    // await checkGroupAllComplete(groupId); 

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
        
        const notificationApiUrl = `http://localhost:${process.env.PORT || 3000}/api/notifications/lightning`; 
        // 혹은 별도의 failure 알림 엔드포인트

        axios.post(notificationApiUrl, {
             targetUserId: userId, // 실패한 사람 (나)
             friendId: friendId,   // 알림 받을 사람
             groupId: groupId,     // 관련 그룹
             type: 'group_fail'
        }).catch(err => console.error('🔔 그룹 실패 알림 전송 실패:', err.message));

        console.log(`🔔 그룹 할일 포기: 친구(ID:${friendId})에게 알림 전송 시도`);
    }

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

    // Notification 서버로 알림 요청 보내기
    const notificationApiUrl = `http://localhost:${process.env.PORT || 3000}/api/notifications/lightning`;
    
    // 비동기로 요청 (await 안 씀 - 알림 실패해도 벼락은 성공 처리)
    axios.post(notificationApiUrl, {
      targetUserId: userId, // 벼락 맞은 사람 ID
      groupId: groupId,     // 어느 그룹인지
    }).catch(err => console.error('⚡ 벼락 알림 요청 실패:', err.message));

    res.status(200).json({ message: 'Strike processed.' });
  } catch (error) {
    console.error('🔥 벼락 누적 API 오류:', error);
    res.status(500).json({ message: '벼락 누적 중 서버 오류' });
  }
};

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
    // 알림 서비스 모듈을 가져옵니다. (순환 참조 방지)
    const { notificationService } = await import('./notifications.service.js');

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
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 조건에 맞는 가장 급한 할 일 1개 찾기
    const urgentTask = await prisma.todo.findFirst({
      where: {
        ownerId: userId,       // 내 할 일
        status: 'pending',     // 아직 안 끝난 것
        deadline: {
          gt: now,                  // 이미 지난 건 제외
          lte: twentyFourHoursLater // 24시간 이내인 것
        },
      },
      orderBy: {
        deadline: 'asc', // 마감 시간이 빠른 순서대로 정렬
      },
      select: {
        id: true,
        title: true,
        deadline: true, // 위젯이 시간 계산하려면 이게 필수!
      }
    });

    // 급한 게 없으면 null 반환 (위젯이 '할 일 없음' 띄우도록)
    if (!urgentTask) {
      return res.status(200).json({ task: null });
    }

    // 3. 할 일 정보 반환
    res.status(200).json({ task: urgentTask });

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