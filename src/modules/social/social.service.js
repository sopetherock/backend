// src/modules/social/social.service.js
import prisma from "../../config/db.js";

// ---------- 친구 기능 ----------

// username으로 유저 검색
export const findUserByUsername = (username) => {
    return prisma.user.findUnique({
    where: { username },
    select: {
        id: true,
        username: true,
        nickname: true,
    },
    });
};

// 친구 요청 보내기
export const requestFriend = async (requesterId, addresseeId) => {
    if (requesterId === addresseeId)
        throw new Error("자기 자신에게 친구 요청 불가");

  // 중복 체크
    const exists = await prisma.friend.findFirst({
    where: {
        requesterId,
        addresseeId,
    },
    });

    if (exists) throw new Error("이미 요청한 친구입니다.");

    return prisma.friend.create({
        data: {
            requesterId,
            addresseeId,
            status: "PENDING",
        },
    });
};

// 친구 요청 수락
export const approveFriend = (friendId) => {
    return prisma.friend.update({
        where: { id: friendId },
        data: { status: "ACCEPTED" },
    });
};

// 친구 목록 조회
export const listFriends = (userId) => {
    return prisma.friend.findMany({
        where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        include: {
        requester: {
            select: { id: true, username: true, nickname: true },
        },
        addressee: {
            select: { id: true, username: true, nickname: true },
        },
        },
    });
};

/**
 * 유저의 친구 중 ACCEPTED 상태인 랜덤한 친구 1명의 ID를 찾습니다.
 * @param {number} userId - 실패한 유저 ID
 * @returns {Promise<number|null>} 랜덤 친구 ID 또는 친구가 없으면 null
 */
export const findRandomAcceptedFriendId = async (userId) => {
    // 1. ACCEPTED 상태인 친구 관계 목록 조회
    const friendships = await prisma.friend.findMany({
        where: {
            status: "ACCEPTED",
            OR: [
                { requesterId: userId },
                { addresseeId: userId },
            ],
        },
        select: {
            requesterId: true,
            addresseeId: true,
        }
    });

    if (friendships.length === 0) {
        return null;
    }

    // 2. 친구 ID 목록 추출
    const friendIds = friendships.map(f => 
        f.requesterId === userId ? f.addresseeId : f.requesterId
    );

    // 3. 랜덤 친구 선택
    const randomIndex = Math.floor(Math.random() * friendIds.length);
    return friendIds[randomIndex];
};

// ---------- 그룹 기능 ----------

export const makeGroupWithFriends = async (
    creatorId,
    deadline,
    invitedIds = []
    ) => {
    // 1) [검증] 초대하려는 유저들이 진짜 친구인지 DB 확인
  // (invitedIds가 비어있으면 검증 생략)
  let validInvitedIds = [];

  if (invitedIds.length > 0) {
    // 'ACCEPTED' 상태인 친구 관계 조회
    const friendships = await prisma.friend.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: creatorId, addresseeId: { in: invitedIds } }, // 내가 신청한 친구들
          { addresseeId: creatorId, requesterId: { in: invitedIds } }, // 나에게 신청한 친구들
        ],
      },
    });

    // 조회된 관계에서 친구 ID만 추출
    validInvitedIds = friendships.map((f) =>
      f.requesterId === creatorId ? f.addresseeId : f.requesterId
    );
  }

  // 2) 그룹 생성 (Timer 모듈을 위해 deadline 저장)
    const group = await prisma.group.create({
        data: {
        deadline: new Date(deadline),
        },
    });

    // 3) 생성자를 ACCEPTED 상태로 추가
    await prisma.groupMembership.create({
        data: {
        groupId: group.id,
        userId: creatorId,
        status: "ACCEPTED",
        },
    });

    // 4) [수정] '검증된 친구들(validInvitedIds)'만 초대
  if (validInvitedIds.length > 0) {
    await prisma.groupMembership.createMany({
      data: validInvitedIds.map((id) => ({
        groupId: group.id,
        userId: id,
        status: "INVITED",
      })),
    });
  }

  // 컨트롤러에게 '그룹 정보'와 '실제로 초대된 유저 목록'을 반환
  return { group, invitedUsers: validInvitedIds };
};

// 받은 친구 요청 목록 조회
export const listIncomingRequests = (userId) => {
    return prisma.friend.findMany({
        where: {
        status: "PENDING",
        addresseeId: userId,
        },
        include: {
        requester: {
            select: { id: true, username: true, nickname: true },
        },
        },
    });
};
// 요청 삭제(거절)
export const deleteFriendRequest = (friendId) => {
    return prisma.friend.delete({
        where: { id: friendId },
    });
};
