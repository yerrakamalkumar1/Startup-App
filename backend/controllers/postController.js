const Post = require("../models/Post");

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeQuery(value) {
  return String(value || "")
    .replace(/[^\p{L}\p{N}\s@#&.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function pageOptions(req) {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
  const page = Math.max(1, Number(req.query.page || 1));
  return { limit, page, skip: (page - 1) * limit };
}

async function searchPosts(req, res, next) {
  try {
    const q = sanitizeQuery(req.query.q);
    const { limit, page, skip } = pageOptions(req);

    if (!q) {
      const [items, total] = await Promise.all([
        Post.find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("author", "name avatar title role city state")
          .lean(),
        Post.countDocuments({})
      ]);
      return res.json({ success: true, q, page, limit, total, results: items });
    }

    // Primary path: MongoDB text index across title, content, tags, and hashtags.
    const textFilter = { $text: { $search: q } };
    let [results, total] = await Promise.all([
      Post.find(textFilter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name avatar title role city state")
        .lean(),
      Post.countDocuments(textFilter)
    ]);

    // Fallback path: partial matching for small typos and incomplete words.
    if (!results.length) {
      const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
      const regexes = terms.map(term => new RegExp(escapeRegex(term), "i"));
      const fallbackFilter = {
        $or: regexes.flatMap(regex => [
          { title: regex },
          { content: regex },
          { tags: regex },
          { hashtags: regex }
        ])
      };
      [results, total] = await Promise.all([
        Post.find(fallbackFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("author", "name avatar title role city state")
          .lean(),
        Post.countDocuments(fallbackFilter)
      ]);
    }

    return res.json({ success: true, q, page, limit, total, results });
  } catch (error) {
    return next(error);
  }
}

module.exports = { searchPosts, sanitizeQuery };
