// src/modules/social/social.routes.js
import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js";
import {
  searchUser,
  sendRequest,
  acceptRequest,
  getFriendList,
  createGroup,
} from "./social.controller.js";

const router = express.Router();

// ---- 친구 기능 ----
router.get("/search/:username", authMiddleware, searchUser);
router.post("/add/:targetId", authMiddleware, sendRequest);
router.post("/accept/:friendId", authMiddleware, acceptRequest);
router.get("/friends", authMiddleware, getFriendList);

// ---- 그룹 기능 ----
router.post("/groups", authMiddleware, createGroup);

export default router;
