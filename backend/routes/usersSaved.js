const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getSavedPosts, toggleSavedPost } = require("../controllers/savedPostController");

const router = express.Router();

router.get("/", requireAuth, getSavedPosts);
router.post("/:postId", requireAuth, toggleSavedPost);

module.exports = router;
