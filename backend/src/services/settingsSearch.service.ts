import { SETTINGS_FEATURE_MAP, SettingsFeature } from "../data/settingsFeatureMap";
import { SettingsAction } from "../models/SettingsAction.model";
import { sanitizeSearchQuery } from "../utils/pagination";

export interface SettingsSearchResult {
  key: string;
  displayName: string;
  category: string;
  deepLinkRoute: string;
  description: string;
  icon: string;
  score: number;
  priority: number;
  matchedTokens: string[];
  suggestion: string;
}

export interface SettingsSearchResponse {
  success: true;
  q: string;
  intent: string;
  suggestions: string[];
  results: SettingsSearchResult[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

function inferIntent(q: string): string {
  const text = normalize(q);
  if (/password|passcode|otp|login|security|credential/.test(text)) return "security";
  if (/privacy|visibility|block|hide|public|private/.test(text)) return "privacy";
  if (/notification|bell|sound|alert|email/.test(text)) return "notifications";
  if (/saved|bookmark|folder/.test(text)) return "saved_content";
  if (/dark|light|theme|appearance/.test(text)) return "appearance";
  if (/ai|match|recommend|location/.test(text)) return "ai_preferences";
  return text ? "settings_navigation" : "popular_settings";
}

function scoreFeature(feature: SettingsFeature, q: string): SettingsSearchResult {
  const normalizedQuery = normalize(q);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const display = normalize(feature.displayName);
  const category = normalize(feature.category);
  const description = normalize(feature.description);
  const tokens = feature.keywordTokens.map(normalize);
  const matchedTokens = tokens.filter(token => terms.some(term => token.includes(term) || term.includes(token)));

  let score = feature.priority;
  if (!q) score += feature.priority;
  if (display === normalizedQuery) score += 100;
  if (display.includes(normalizedQuery)) score += 60;
  if (category.includes(normalizedQuery)) score += 30;
  score += matchedTokens.length * 24;
  terms.forEach(term => {
    if (display.includes(term)) score += 18;
    if (description.includes(term)) score += 8;
  });

  return {
    key: feature.key,
    displayName: feature.displayName,
    category: feature.category,
    deepLinkRoute: feature.deepLinkRoute,
    description: feature.description,
    icon: feature.icon,
    score,
    priority: feature.priority,
    matchedTokens,
    suggestion: `Open ${feature.displayName} in ${feature.category}`
  };
}

export async function seedSettingsActions(): Promise<void> {
  const writes = SETTINGS_FEATURE_MAP.map(feature => ({
    updateOne: {
      filter: { key: feature.key },
      update: { $set: feature },
      upsert: true
    }
  }));
  await SettingsAction.bulkWrite(writes, { ordered: false });
}

export async function searchSettingsActions(query: unknown): Promise<SettingsSearchResponse> {
  const q = sanitizeSearchQuery(query);
  const fallback = SETTINGS_FEATURE_MAP
    .map(feature => scoreFeature(feature, q))
    .filter(result => !q || result.score > result.priority)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  let results = fallback;
  try {
    const dbResults = await SettingsAction.find(q ? { $text: { $search: q } } : {})
      .sort(q ? { score: { $meta: "textScore" }, priority: -1 } : { priority: -1 })
      .limit(8)
      .lean();
    if (dbResults.length) {
      results = dbResults.map(item => scoreFeature(item, q)).sort((a, b) => b.score - a.score);
    }
  } catch {
    results = fallback;
  }

  const intent = inferIntent(q);
  const suggestions = results.slice(0, 4).map(result => result.suggestion);
  return { success: true, q, intent, suggestions, results };
}
