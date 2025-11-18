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

// ---------- 그룹 기능 ----------

export const makeGroupWithFriends = async (
    creatorId,
    deadline,
    invitedIds = []
    ) => {
    // 1) 그룹 생성
    const group = await prisma.group.create({
        data: {
        deadline: new Date(deadline),
        },
    });

    // 2) 생성자를 ACCEPTED 상태로 추가
    await prisma.groupMembership.create({
        data: {
        groupId: group.id,
        userId: creatorId,
        status: "ACCEPTED",
        },
    });

    // 3) 초대한 친구들을 INVITED 상태로 추가
    if (invitedIds.length > 0) {
        await prisma.groupMembership.createMany({
        data: invitedIds.map((id) => ({
            groupId: group.id,
            userId: id,
            status: "INVITED",
        })),
        });
    }

    return group;
};
