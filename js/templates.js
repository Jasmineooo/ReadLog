/**
 * 笔记结构模板
 * section.type: text（整段文字） | list（逐条一句） | chain（三列传导链）
 */

export const TEMPLATES = {
  journal: {
    id: 'journal',
    name: '期刊精读 · 经济学人式',
    kind: '期刊',
    desc: '先判断核心，再逐段拆论证，最后落到传导链与假设审视',
    sections: [
      {
        id: 'pick', type: 'text', title: '文章选取',
        hint: '标题 / 期号 / 栏目 / 主题（如：美联储路径、原油供给、AI 资本开支）。先记清楚读的是哪一篇。'
      },
      {
        id: 'thesis', type: 'text', title: '首尾段 · 核心判断',
        hint: '作者的核心判断是什么？用一句话写出来，不要复述标题。'
      },
      {
        id: 'foil', type: 'text', title: '首尾段 · 回应的共识或分歧',
        hint: '他在反驳谁、回应什么市场共识？市场当前怎么定价，他不同意哪一点？'
      },
      {
        id: 'paras', type: 'list', title: '逐段笔记',
        hint: '每段一句话：这一段在论证什么 / 用什么证据（数据、历史类比、市场信号）/ 承认了什么反例或不确定性。'
      },
      {
        id: 'chain', type: 'chain', title: '三行传导链',
        hint: '三个节点串成一条链，每格只写一个短语或短句：事件 / 政策 → 全球变量 → 落点。落点看 A 股板块或风格、纳指 ETF 的驱动、黄金 ETF 的变量、ETF 期权的定价维度。文章有几条通路就加几条。',
        columns: ['事件 / 政策', '全球变量', '落点']
      },
      {
        id: 'shift', type: 'text', title: '认知变化',
        hint: '这篇文章改变或强化了我对哪个变量、哪条定价逻辑的认知？'
      },
      {
        id: 'question', type: 'text', title: '落点问题',
        hint: '对【A 股 / 纳指 ETF / ETF 期权 / 黄金 ETF】而言，我需要重新审视的假设是什么？'
      }
    ]
  },

  article: {
    id: 'article',
    name: '文章 / 论文通用',
    kind: '文章',
    desc: '适合单篇文章、研究报告、论文，重点抓问题、证据与判断',
    sections: [
      { id: 'src', type: 'text', title: '出处与主题', hint: '作者、发表处、时间；这篇在讨论什么领域里的什么问题。' },
      { id: 'question', type: 'text', title: '它要回答的问题', hint: '用一句疑问句写出来。作者真正想解决的问题是什么？' },
      { id: 'thesis', type: 'text', title: '核心主张', hint: '作者给出的答案，以及他依赖的关键前提。' },
      { id: 'evidence', type: 'list', title: '证据与推理', hint: '每条一句：论点是什么 / 证据是什么（数据、案例、模型）/ 证据够不够支撑。' },
      { id: 'counter', type: 'text', title: '反例与边界', hint: '作者承认了哪些不确定性？他的结论在什么条件下会失效？你怎么看？' },
      { id: 'judgment', type: 'text', title: '我的判断', hint: '我同意哪部分、不同意哪部分，为什么。不要写“收获很大”。' },
      { id: 'apply', type: 'text', title: '关联与落点', hint: '它连接到我已知的什么？对我的观察或决策意味着什么？' }
    ]
  },

  book: {
    id: 'book',
    name: '书籍 · 章节',
    kind: '书籍',
    desc: '按章节推进，关注命题、概念、论证和你自己的迁移',
    sections: [
      { id: 'pos', type: 'text', title: '章节定位', hint: '这一章在全书中承担什么角色？承接上文什么，开启下文什么？' },
      { id: 'thesis', type: 'text', title: '核心命题', hint: '作者这一章最想让读者接受的一句话是什么？' },
      { id: 'concepts', type: 'list', title: '关键概念', hint: '每条一句：概念 / 作者的定义 / 它和我原有的理解差在哪。' },
      { id: 'argument', type: 'list', title: '论证与证据', hint: '每条一句：论点 / 用了什么材料 / 我信几分。' },
      { id: 'counter', type: 'text', title: '反驳与边界', hint: '哪里我觉得可疑？换一个前提，结论还成立吗？' },
      { id: 'transfer', type: 'text', title: '可迁移应用', hint: '这个概念或方法，能搬到我正在做的事上吗？怎么搬。' }
    ]
  },

  course: {
    id: 'course',
    name: '课程 / 讲座',
    kind: '课程',
    desc: '适合课程、讲座、播客，重点是听懂、提问、用起来',
    sections: [
      { id: 'topic', type: 'text', title: '主题与场景', hint: '谁讲的、讲给谁听、在什么背景下讲。' },
      { id: 'points', type: 'list', title: '要点', hint: '每条一句：讲了什么 / 为什么重要 / 我的理解。' },
      { id: 'concepts', type: 'list', title: '关键概念', hint: '术语、定义、容易混淆的地方。' },
      { id: 'doubt', type: 'text', title: '疑问', hint: '哪些地方没听懂、或者我不认同？具体到哪一句。' },
      { id: 'apply', type: 'text', title: '应用计划', hint: '接下来一周我可以拿它做什么具体的事。' }
    ]
  }
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function templateById(id) {
  return TEMPLATES[id] || TEMPLATES.article;
}

export function emptySectionContent(section) {
  if (section.type === 'list') return [''];
  if (section.type === 'chain') return [{ a: '', b: '', c: '' }];
  return '';
}

export function emptyContent(template) {
  const out = {};
  (template.sections || []).forEach((s) => { out[s.id] = emptySectionContent(s); });
  return out;
}

/** 判断某个板块是否已填写 */
export function sectionFilled(section, value) {
  if (section.type === 'list') return Array.isArray(value) && value.some((v) => v && String(v).trim());
  if (section.type === 'chain') return Array.isArray(value) && value.some((r) => r && ['a', 'b', 'c'].some((k) => (r[k] || '').trim()));
  return Boolean(value && String(value).trim());
}

/** 把板块内容转成给 AI 读的纯文本 */
export function sectionToText(section, value) {
  if (!sectionFilled(section, value)) return '';
  if (section.type === 'list') {
    return value.map((v, i) => (String(v || '').trim() ? `${i + 1}. ${String(v).trim()}` : '')).filter(Boolean).join('\n');
  }
  if (section.type === 'chain') {
    const cols = section.columns || ['事件 / 政策', '全球变量', '落点'];
    return value
      .map((r, i) => {
        if (!r || !['a', 'b', 'c'].some((k) => (r[k] || '').trim())) return '';
        return `第 ${i + 1} 条：${(r.a || '（空）').trim()} → ${(r.b || '（空）').trim()} → ${(r.c || '（空）').trim()}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(value).trim();
}

/** 笔记正文总字数（中文按字、英文按词） */
export function noteWordCount(note) {
  if (!note) return 0;
  let text = '';
  Object.values(note.sections || {}).forEach((v) => {
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (typeof item === 'string') text += item;
        else if (item && typeof item === 'object') text += `${item.a || ''}${item.b || ''}${item.c || ''}`;
      });
    } else if (typeof v === 'string') {
      text += v;
    }
  });
  (note.terms || []).forEach((t) => { text += `${t.en || ''}${t.zh || ''}${t.note || ''}`; });
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (text.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  return cjk + latin;
}

/** 板块填写进度 */
export function completionOf(note, project) {
  const sections = (project.template && project.template.sections) || [];
  if (!sections.length) return { filled: 0, total: 0, ratio: 0 };
  const filled = sections.filter((s) => sectionFilled(s, (note.sections || {})[s.id])).length;
  return { filled, total: sections.length, ratio: filled / sections.length };
}
