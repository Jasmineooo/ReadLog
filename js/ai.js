/** 模型接入：任意 OpenAI 兼容接口 */
import { loadSettings } from './store.js';
import { sectionToText } from './templates.js';

export const PRESETS = [
  { id: 'zhipu', name: '智谱 GLM-4.7-Flash（免费，推荐）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.7-flash' },
  { id: 'zhipu53', name: '智谱 GLM-5.3-Flash（付费）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3-flash' },
  { id: 'zhipu53x', name: '智谱 GLM-5.3-FlashX（付费，更快）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3-flashx' },
  { id: 'zhipu46v', name: '智谱 GLM-4.6V-Flash（免费，可读图）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.6v-flash' },
  { id: 'qwen', name: '阿里百炼 qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'siliconflow', name: '硅基流动 Qwen2.5-7B', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  { id: 'modelscope', name: '魔搭 ModelScope', baseUrl: 'https://api-inference.modelscope.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  { id: 'deepseek', name: 'DeepSeek Chat', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'custom', name: '自定义地址 / 模型', baseUrl: '', model: '' }
];

export const DIMENSIONS = [
  { key: 'capture', name: '信息抓取', desc: '有没有抓住文章真正的核心判断与关键事实' },
  { key: 'structure', name: '结构完整', desc: '结构板块是否填满，是否按顺序推进' },
  { key: 'evidence', name: '证据意识', desc: '是否记录证据类型与来源，而非只记结论' },
  { key: 'reasoning', name: '论证加工', desc: '是否解释了因果与传导链，逻辑是否站得住' },
  { key: 'reflection', name: '独立思考', desc: '是否有自己的判断、怀疑与反例' },
  { key: 'application', name: '落点转化', desc: '是否落到可验证的假设与具体行动' }
];

const SYSTEM_REVIEW = `你是一位严格、具体的阅读教练。你熟悉《如何阅读一本书》的阅读层次、卡片笔记写作法（Zettelkasten）与费曼技巧，也熟悉宏观交易与跨资产定价的研究框架。

你在批阅一份阅读笔记。你的职责是判断这份笔记有没有真的抓住、加工、推进思考，而不是夸奖。

规则：
1. 只依据笔记文本判断，不虚构原文内容；笔记没写的，直接指出缺失。
2. 每条批评必须指向具体板块或具体表述，禁止"可以更深入""继续加油"这类空话。
3. 建议必须可执行：给出句式、给出改写示范、指出下一步该查什么。
4. 尊重笔记作者的专业语境（可能涉及 A 股、ETF、期权、宏观变量），不要泛泛地劝人"多读多想"。
5. 中文回答，语气克制、直接、像一位不留情面的编辑。
6. 遇到传导链板块：它由"事件/政策 → 全球变量 → 落点"三个节点组成，一条链就是三行短语。检查每格是不是一个短语或短句（若写成整段话要指出）、相邻节点是否真的接得上（如"美联储降息"接"美元指数回落"再接"黄金 ETF"，成立；"美联储降息"直接接"某只股票"，是跳跃），并提示哪一条通路还缺一个中间变量。
7. 只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释文字。`;

const DIM_RULES = `评分维度（共 6 项，必须全部输出）：
- capture 信息抓取：是否抓住作者的核心判断、关键事实与关键数字。
- structure 结构完整：模板板块是否填满，是否按"输入 → 加工 → 落点"推进；空板块要算失分。
- evidence 证据意识：是否记录了证据类型（数据、历史类比、市场信号）与来源，而不是只有结论。
- reasoning 论证加工：是否解释了因果与传导链，环节之间是否真的接得上，有没有跳跃。
- reflection 独立思考：是否有自己的判断、怀疑、反例与分歧，而不是复述作者。
- application 落点转化：是否落到可验证的假设、需要重估的变量或具体行动。

评分锚点：0-30 基本是摘抄复述；31-50 有概括但缺少个人加工；51-70 有判断与关联，但证据或传导链不完整；71-85 有批判、有传导逻辑、有可检验的落点；86-100 有独立洞察，且能指出自己的判断在什么条件下会错。`;

function settingsOrThrow() {
  const s = loadSettings();
  if (!s.apiKey || !s.apiKey.trim()) throw new Error('还没有填写 API Key，请到「设置」里填一下');
  if (!s.baseUrl || !s.model) throw new Error('Base URL 或模型名没有填完整，请到「设置」里检查');
  return s;
}

async function chatRaw({ system, user, maxTokens = 2600, temperature = 0.35 }) {
  const s = settingsOrThrow();
  const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.apiKey.trim()
      },
      body: JSON.stringify({
        model: s.model,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: ctrl.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('请求超时（90 秒），模型服务没有响应，稍后重试或换一个模型');
    throw new Error('无法连接模型服务。常见原因：Base URL 填错，或该服务不允许浏览器直连（跨域 CORS）。可换用支持浏览器调用的地址，或在设置里换一家平台。');
  }
  clearTimeout(timer);

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      detail = j.error?.message || j.message || detail;
    } catch { /* 保留原始文本 */ }
    if (res.status === 401 || res.status === 403) throw new Error(`API Key 无效或没有权限（${res.status}）：${detail}`);
    if (res.status === 404) throw new Error(`接口地址或模型名不对（404）：${detail}`);
    if (res.status === 429) throw new Error(`请求太频繁或额度用尽（429）：${detail}`);
    throw new Error(`模型服务返回 ${res.status}：${detail}`);
  }

  let data;
  try { data = JSON.parse(text); } catch { throw new Error('模型返回的不是合法数据，可能被截断了'); }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型返回内容为空，换一个模型或稍后重试');
  return content;
}

function parseJSONLoose(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有按要求返回 JSON，请重试一次');
  let body = t.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    body = body.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(body);
    } catch {
      throw new Error('模型返回的 JSON 格式有误，请重试一次（免费模型偶尔会这样）');
    }
  }
}

async function chatJSON(payload) {
  const content = await chatRaw(payload);
  return parseJSONLoose(content);
}

const clampScore = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const asArray = (v) => (Array.isArray(v) ? v.filter((x) => x != null) : []);

/* ---------------- 笔记复盘 ---------------- */

export async function reviewNote(project, note) {
  const sections = (project.template && project.template.sections) || [];

  const blocks = sections.map((s, i) => {
    const text = sectionToText(s, (note.sections || {})[s.id]);
    return `### ${i + 1}. ${s.title}（id: ${s.id}）
这一块应该写：${s.hint || '无特别要求'}
实际内容：
${text || '（未填写）'}`;
  }).join('\n\n');

  const terms = (note.terms || [])
    .filter((t) => (t.en || '').trim() || (t.zh || '').trim())
    .map((t) => `- ${t.en || '—'}｜${t.zh || '—'}${t.note ? '：' + t.note : ''}`)
    .join('\n');

  const body = String(note.sections ? Object.values(note.sections).join(' ') : '').slice(0, 12000);

  const user = `【阅读项目】${project.title}（${project.kind || '未分类'}）
【项目阅读目标】${project.goal || '未设置明确目标'}
【本篇笔记】${note.title || '未命名'}${note.subtitle ? ' · ' + note.subtitle : ''}
【正文长度】约 ${body.length} 字

【笔记结构，共 ${sections.length} 块】
${blocks}

【术语记录】
${terms || '（无）'}

${DIM_RULES}

请按下面的 JSON 结构输出。sectionReviews 必须覆盖上面每一个板块 id（包括未填写的，未填写用 level=missing），顺序与笔记结构一致：

{
  "score": 0到100的整数,
  "summary": "两三句话的总体判断：最大的优点 + 最关键的短板",
  "dimensions": [
    {"key":"capture","score":0,"comment":"不超过30字"},
    {"key":"structure","score":0,"comment":"不超过30字"},
    {"key":"evidence","score":0,"comment":"不超过30字"},
    {"key":"reasoning","score":0,"comment":"不超过30字"},
    {"key":"reflection","score":0,"comment":"不超过30字"},
    {"key":"application","score":0,"comment":"不超过30字"}
  ],
  "sectionReviews": [
    {"sectionId":"板块id","level":"good|ok|weak|missing","comment":"这一块好在哪、缺什么，40到90字","suggestions":["一条具体改法"],"example":"可选：替作者写一句示范，40到80字"}
  ],
  "highlights": ["最多3条，必须引用笔记里的具体内容"],
  "gaps": ["最多3条，按重要性排序"],
  "nextStep": "下一篇同类材料动笔前，具体先做的一件事，一句话"
}`;

  const raw = await chatJSON({ system: SYSTEM_REVIEW, user, maxTokens: 3000 });

  return {
    createdAt: new Date().toISOString(),
    model: loadSettings().model,
    score: clampScore(raw.score),
    summary: String(raw.summary || '').slice(0, 400),
    dimensions: DIMENSIONS.map((d) => {
      const found = asArray(raw.dimensions).find((x) => x && x.key === d.key);
      return {
        key: d.key,
        name: d.name,
        score: clampScore(found ? found.score : 0),
        comment: String((found && found.comment) || '').slice(0, 80)
      };
    }),
    sectionReviews: asArray(raw.sectionReviews).map((r) => ({
      sectionId: String(r.sectionId || ''),
      level: ['good', 'ok', 'weak', 'missing'].includes(r.level) ? r.level : 'ok',
      comment: String(r.comment || '').slice(0, 260),
      suggestions: asArray(r.suggestions).slice(0, 2).map((x) => String(x).slice(0, 160)),
      example: String(r.example || '').slice(0, 260)
    })).filter((r) => r.sectionId),
    highlights: asArray(raw.highlights).slice(0, 3).map((x) => String(x).slice(0, 160)),
    gaps: asArray(raw.gaps).slice(0, 3).map((x) => String(x).slice(0, 160)),
    nextStep: String(raw.nextStep || '').slice(0, 200)
  };
}

/* ---------------- 阶段评估 ---------------- */

export async function reviewProgress(project, notes) {
  const sorted = notes.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const lines = sorted.map((n) => {
    const total = ((project.template && project.template.sections) || []).length;
    const filled = total ? Object.keys(n.sections || {}).filter((k) => sectionToText(
      ((project.template.sections || []).find((s) => s.id === k)) || { type: 'text' }, n.sections[k]
    )).length : 0;
    const score = n.aiReview ? `${n.aiReview.score} 分` : '未复盘';
    return `- ${(n.createdAt || '').slice(0, 10)}｜${n.title || '未命名'}｜${score}｜板块 ${filled}/${total}｜${n.aiReview ? n.aiReview.summary : '（没有 AI 总评）'}`;
  }).join('\n');

  const history = (project.reviews || []).slice(0, 3)
    .map((r) => `- ${(r.createdAt || '').slice(0, 10)}：${r.summary}`)
    .join('\n');

  const user = `你在评估一个人的长期阅读进展。请只依据下面的事实，不要客套。

【项目】${project.title}（${project.kind || '未分类'}）
【阅读目标】${project.goal || '未设置'}
【目标篇数】${project.target || '未设置'}
【累计笔记】${notes.length} 篇

【按时间排列的笔记】
${lines || '（还没有笔记）'}

【既往阶段评估】
${history || '（这是第一次评估）'}

请判断：他有没有在进步？进步体现在哪？离目标还差什么？下一步最该做什么？
输出 JSON：
{
  "score": 0到100的整数,
  "trend": "up|flat|down",
  "goalHit": "已达成|部分达成|尚未达成",
  "summary": "三到四句话，必须有具体证据，不要空泛",
  "evidence": ["最多4条，引用具体变化或具体笔记"],
  "gaps": ["最多3条，还差什么"],
  "actions": ["2到3条具体动作，下两周可以执行"]
}`;

  const raw = await chatJSON({ system: SYSTEM_REVIEW, user, maxTokens: 1600, temperature: 0.3 });

  return {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    model: loadSettings().model,
    score: clampScore(raw.score),
    trend: ['up', 'flat', 'down'].includes(raw.trend) ? raw.trend : 'flat',
    goalHit: ['已达成', '部分达成', '尚未达成'].includes(raw.goalHit) ? raw.goalHit : '尚未达成',
    summary: String(raw.summary || '').slice(0, 500),
    evidence: asArray(raw.evidence).slice(0, 4).map((x) => String(x).slice(0, 180)),
    gaps: asArray(raw.gaps).slice(0, 3).map((x) => String(x).slice(0, 180)),
    actions: asArray(raw.actions).slice(0, 3).map((x) => String(x).slice(0, 180))
  };
}

/* ---------------- 结构建议 ---------------- */

export async function suggestTemplate({ title, kind, goal }) {
  const user = `请为一个阅读项目设计笔记结构。

【项目名称】${title || '未命名项目'}
【材料类型】${kind || '文章'}
【阅读目标】${goal || '持续积累并形成自己的判断'}

要求：
- 设计 5 到 7 个板块，顺序符合"先抓住核心 → 再拆证据 → 再形成判断 → 最后落到应用"的推进。
- 每个板块对应一个明确的思考动作，hint 写清楚"这一块应该写什么"，30 到 60 字。
- 类型只能从这三种里选：text（成段文字）、list（逐条一句）、chain（事件/政策 → 全球变量 → 落点 三个节点串成的传导链，每格一个短语，可写多条）。
- 板块标题简短，不超过 10 个字。

只输出 JSON：
{"sections":[{"title":"","hint":"","type":"text"}]}`;

  const raw = await chatJSON({ system: SYSTEM_REVIEW, user, maxTokens: 1400, temperature: 0.4 });
  const list = asArray(raw.sections).slice(0, 8);
  if (!list.length) throw new Error('模型没有给出结构，换一个模型再试');
  return list.map((s, i) => ({
    id: 's' + (i + 1),
    title: String(s.title || '板块 ' + (i + 1)).slice(0, 20),
    hint: String(s.hint || '').slice(0, 160),
    type: ['text', 'list', 'chain'].includes(s.type) ? s.type : 'text',
    ...(s.type === 'chain' ? { columns: ['事件 / 政策', '全球变量', '落点'] } : {})
  }));
}

/* ---------------- 连接测试 ---------------- */

export async function testConnection() {
  const text = await chatRaw({
    system: '你是一个测试接口，严格按用户要求回复。',
    user: '只回复两个字：可用',
    maxTokens: 20,
    temperature: 0
  });
  return text.trim();
}
