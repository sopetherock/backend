// src/modules/social/social.controller.js
import { notificationService } from '../notifications/notifications.service.js';
import {
    findUserByUsername,
    requestFriend,
    approveFriend,
    listFriends,
    makeGroupWithFriends,
    listIncomingRequests,
    deleteFriendRequest,
} from "./social.service.js";

export const searchUser = async (req, res) => {
    try {
        const username = req.params.username;
        const user = await findUserByUsername(username);
        if (!user) return res.status(404).json({ message: "유저 없음" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "검색 오류" });
    }
};

export const sendRequest = async (req, res) => {
    try {
        const requesterId = req.user.id;
        const targetId = Number(req.params.targetId);

        const result = await requestFriend(requesterId, targetId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

export const acceptRequest = async (req, res) => {
    try {
        const friendId = Number(req.params.friendId);
        const result = await approveFriend(friendId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getFriendList = async (req, res) => {
    try {
        const userId = req.user.id;
        const friends = await listFriends(userId);
        res.json(friends);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const createGroup = async (req, res) => {
    try {
        const userId = req.user.id;
        const { deadline, invitedFriendIds } = req.body;

        const {group, invitedUsers} = await makeGroupWithFriends(userId, deadline, invitedFriendIds);
    // 2. [핵심] 알림(Notifications) 모듈에 "초대장 발송" 요청
    // (검증된 친구들에게만 알림이 갑니다)
        if (invitedUsers.length > 0) {
            // 서비스 직접 호출 (서버리스 환경에서 HTTP 자기호출은 실패/유실될 수 있음)
            try {
                await notificationService.sendGroupInvites(
                    invitedUsers,
                    req.user.nickname || '친구',
                    group.todo || '그룹 타이머',
                    group.id
                );
            } catch (err) {
                console.error("🔥 알림 전송 실패:", err.message);
            }
    }

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


// 받은 친구 요청 조회
export const getIncomingRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await listIncomingRequests(userId);
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 친구 요청 삭제(거절)
export const removeFriendRequest = async (req, res) => {
    try {
        const friendId = Number(req.params.friendId);
        await deleteFriendRequest(friendId);
        res.json({ message: "요청 삭제 완료" });
    } catch (err) { 
        res.status(500).json({ message: err.message });
    }
};
