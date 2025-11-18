// src/modules/social/social.controller.js
import {
    findUserByUsername,
    requestFriend,
    approveFriend,
    listFriends,
    makeGroupWithFriends,
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
        const requesterId = req.user.userId;
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
        const userId = req.user.userId;
        const friends = await listFriends(userId);
        res.json(friends);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const createGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { deadline, invitedFriendIds } = req.body;

        const group = await makeGroupWithFriends(userId, deadline, invitedFriendIds);
        res.json(group);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
