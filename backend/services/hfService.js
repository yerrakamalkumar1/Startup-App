const { HfInference } = require('@huggingface/inference');

const CHAT_MODEL = 'Qwen/Qwen2.5-1.5B-Instruct';
const EMBED_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
const SENTIMENT_MODEL = 'cardiffnlp/twitter-roberta-base-sentiment-latest';
const TOXICITY_MODEL = 'unitary/toxic-bert';
const ZERO_SHOT_MODEL = 'facebook/bart-large-mnli';

let hf = null;

function getHf() {
  if (hf) return hf;
  const token = process.env.HUGGINGFACE_API_KEY;
  if (token) {
    hf = new HfInference(token);
  }
  return hf;
}

function isAvailable() {
  return !!getHf();
}

async function hfChat(prompt, systemMsg = 'You are ConnectBot, a helpful career assistant for ConnectHub India.') {
  const client = getHf();
  if (!client) return null;
  try {
    const res = await client.textGeneration({
      model: CHAT_MODEL,
      inputs: `<|system|>${systemMsg}<|end|><|user|>${prompt}<|end|><|assistant|>`,
      parameters: { max_new_tokens: 512, temperature: 0.7, return_full_text: false, wait_for_model: true }
    });
    return res.generated_text?.trim() || '';
  } catch {
    return null;
  }
}

async function hfEmbed(text) {
  const client = getHf();
  if (!client) return null;
  try {
    const res = await client.featureExtraction({
      model: EMBED_MODEL,
      inputs: String(text).substring(0, 512)
    });
    return Array.isArray(res[0]) ? res[0] : res;
  } catch {
    return null;
  }
}

async function hfSentiment(text) {
  const client = getHf();
  if (!client) return null;
  try {
    const res = await client.textClassification({
      model: SENTIMENT_MODEL,
      inputs: String(text).substring(0, 512)
    });
    const labelMap = { LABEL_0: 'NEGATIVE', LABEL_1: 'NEUTRAL', LABEL_2: 'POSITIVE' };
    return { label: labelMap[res[0]?.label] || res[0]?.label, score: parseFloat((res[0]?.score || 0.5).toFixed(3)) };
  } catch {
    return null;
  }
}

async function hfToxicity(text) {
  const client = getHf();
  if (!client) return null;
  try {
    const res = await client.textClassification({
      model: TOXICITY_MODEL,
      inputs: String(text).substring(0, 512)
    });
    const toxic = res.find(r => r.label !== 'non_toxic' && r.score > 0.5);
    return toxic ? { label: toxic.label, score: parseFloat(toxic.score.toFixed(3)), isToxic: true } : { label: 'safe', score: 0, isToxic: false };
  } catch {
    return null;
  }
}

async function hfClassify(text, labels) {
  const client = getHf();
  if (!client) return null;
  try {
    const res = await client.zeroShotClassification({
      model: ZERO_SHOT_MODEL,
      inputs: String(text).substring(0, 512),
      parameters: { candidate_labels: labels }
    });
    return res.labels.map((l, i) => ({ label: l, score: parseFloat(res.scores[i].toFixed(3)) }));
  } catch {
    return null;
  }
}

module.exports = { hfChat, hfEmbed, hfSentiment, hfToxicity, hfClassify, isAvailable, get HF_AVAILABLE() { return isAvailable(); } };
