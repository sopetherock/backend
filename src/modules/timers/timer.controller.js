// src/modules/timers/timer.controller.js
import prisma from '../../config/db.js';
import axios from 'axios'; // API 호출을 위해 import
import { makeGroupWithFriends } from '../social/social.service.js';

// --- 기능 1: 개인 할일 ---

/**
 * API: POST /api/timers/personal
 * 기능: 개인 할일과 1:1 타이머 생성
 */
export const createPersonalTimer = async (req, res) => {
  try {
    const { title, duration } = req.body; // 할일 제목, 타이머 시간(초)
    const userId = req.user.userId; // 인증된 유저 ID

    // Prisma의 'Nested Write' 기능으로 Todo와 PersonalTimer를 한 번에 생성
    const newTodo = await prisma.todo.create({
      data: {
        title: title,
        ownerId: userId,
        timer: {
          // 1:1 관계인 PersonalTimer도 'create'
          create: {
            duration: duration,
            startTime: new Date(),
          },
        },
      },
      include: {
        timer: true, // 응답에 timer 정보 포함
      },
    });

    res.status(201).json(newTodo);
  } catch (error) {
    console.error('🔥 개인 타이머 생성 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};


// --- 기능 2: 그룹 타이머 (Social 연동 + 알림 발송) ---

/**
 * API: POST /api/timers/group
 * 역할: Social 모듈을 통해 그룹을 만들고, Notification 모듈에 초대장을 보냅니다.
 */
export const createGroupTimer = async (req, res) => {
  try {
    const userId = req.user.id; // (authMiddleware가 준 유저 ID)
    const { deadline, invitedUserIds } = req.body;

    // 1. [Social 모듈 사용] 그룹 생성 및 친구 관계 검증
    // makeGroupWithFriends는 { group, invitedUsers } 객체를 반환합니다.
    const { group, invitedUsers } = await makeGroupWithFriends(
      userId,
      deadline,
      invitedUserIds
    );

    // 2. [Notification 모듈 호출] 초대 알림 발송
    // 실제로 초대된(검증된) 친구가 있을 때만 발송합니다.
    if (invitedUsers.length > 0) {
      const notificationApiUrl = `http://localhost:3000/api/notifications/invite`;

      // 비동기 호출 (응답을 기다리지 않음으로써 사용자 경험 향상)
      axios.post(notificationApiUrl, {
        groupId: group.id,
        inviterName: req.user.nickname, // 초대자 닉네임
        invitedUserIds: invitedUsers,   // 검증된 친구 ID 목록
      }).catch(err => console.error("🔥 초대 알림 전송 실패:", err.message));
    }

    // 3. 생성된 그룹 정보 반환
    res.status(201).json(group);

  } catch (error) {
    console.error('🔥 그룹 타이머 생성 오류:', error);
    res.status(500).json({ message: '서버 오류' });
  }
};

/**
 * API: POST /api/timers/group/:groupId/complete
 * 기능: 유저가 그룹 할일 완료 (번개 획득)
 */
export const completeGroupTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const groupId = parseInt(req.params.groupId);

    // 1. 유저의 상태를 'COMPLETED'로 변경
    await prisma.groupMembership.updateMany({
      where: {
        userId: userId,
        groupId: groupId,
        status: 'ACCEPTED', // 'ACCEPTED' 상태인 사람만 완료 가능
      },
      data: {
        status: 'COMPLETED',
      },
    });

    // 2. [보상] 퀘스트 완료 '번개'(lightingPoints) 1 지급
    await prisma.user.update({
      where: { id: userId },
      data: {
        lightingPoints: {
          increment: 1, // '번개' 누적
        },
      },
    });

    // 3. [핵심] 그룹 해체 및 벌칙자 선정 로직 호출
    await findLoserAndDisband(groupId);

    res.status(200).json({ message: '할 일을 완료했습니다! (번개 +1)' });
  } catch (error) {
    console.error('🔥 그룹 할일 완료 오류:', error);
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
    const notificationApiUrl = 'http://localhost:3000/api/notifications/penalty';
    const penaltyBody = {
      loserUserId: loser.userId,
      groupId: loser.groupId,
      strikeCount: loser.thunderCount,
    };

    axios.post(notificationApiUrl, penaltyBody)
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