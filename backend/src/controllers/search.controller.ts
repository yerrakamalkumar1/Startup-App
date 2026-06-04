import type { Request, Response } from "express";
import { Post } from "../models/Post.model";
import { asyncHandler } from "../middleware/error.middleware";
import { escapeRegex, parsePagination, sanitizeSearchQuery } from "../utils/pagination";

export const searchController = asyncHandler(async (req: Request, res: Response) => {
  const q = sanitizeSearchQuery(req.query.q);
  const { page, limit, skip } = parsePagination(req.query);

  if (!q) {
    const [results, total] = await Promise.all([
      Post.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name avatar title role city state")
        .lean(),
      Post.countDocuments({})
    ]);
    res.json({ success: true, q, page, limit, total, results });
    return;
  }

  // Primary path: use the weighted compound text index on title, excerpt, and tags.
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

  if (!results.length) {
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
    const regexes = terms.map(term => new RegExp(escapeRegex(term), "i"));
    const fuzzyFilter = {
      $or: regexes.flatMap(regex => [
        { title: regex },
        { excerpt: regex },
        { body: regex },
        { tags: regex }
      ])
    };

    [results, total] = await Promise.all([
      Post.find(fuzzyFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name avatar title role city state")
        .lean(),
      Post.countDocuments(fuzzyFilter)
    ]);
  }

  res.json({ success: true, q, page, limit, total, results });
});
