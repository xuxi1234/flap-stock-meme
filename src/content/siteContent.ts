export type Language = 'zh' | 'en'

export type SiteCopy = {
  nav: { story: string; signal: string; presale: string; roadmap: string; languageLabel: string; languageSwitchLabel: string; menuOpenLabel: string; menuCloseLabel: string; homeLabel: string; logoLabel: string; navigationLabel: string }
  community: { regionLabel: string; xLabel: string; telegramLabel: string; comingSoon: string; xPendingLabel: string; telegramPendingLabel: string }
  ticker: { sectionLabel: string; symbolLabel: string; chainLabel: string; priceLabel: string; capacityLabel: string; statusLabel: string }
  hero: { eyebrow: string; tagline: string; description: string; explore: string; enterPresale: string; presalePendingLabel: string; visualLabel: string; brandSignalLabel: string; brandSignalValue: string; safetyLabel: string }
  effect: { regionLabel: string; eyebrow: string; title: string; body: string; steps: Array<{ index: string; title: string; body: string }> }
  signal: { regionLabel: string; eyebrow: string; title: string; disclaimer: string; metrics: Array<{ label: string; value: string; trend: string }> }
  nameCore: { regionLabel: string; eyebrow: string; title: string; cards: Array<{ glyph: string; title: string; body: string }>; disclaimer: string }
  presale: { regionLabel: string; eyebrow: string; title: string; body: string; facts: string[]; actionLabel: string; unavailable: string; pendingLabel: string; warning: string }
  howTo: { regionLabel: string; eyebrow: string; title: string; steps: Array<{ index: string; title: string; body: string }> }
  roadmap: { regionLabel: string; eyebrow: string; title: string; phases: Array<{ code: string; title: string; body: string; status: string }>; caveat: string }
  manifesto: { regionLabel: string; eyebrow: string; title: string; body: string }
  footer: { disclaimer: string; rights: string }
}

export const siteContent: Record<Language, SiteCopy> = {
  zh: {
    nav: { story: '故事', signal: '信号', presale: '预售', roadmap: '路线图', languageLabel: 'EN', languageSwitchLabel: '切换到英文', menuOpenLabel: '打开菜单', menuCloseLabel: '关闭菜单', homeLabel: 'FLAP STOCK 首页', logoLabel: '蝴蝶股票 FLAP STOCK 标志', navigationLabel: '主导航' },
    community: { regionLabel: '社区入口', xLabel: 'X', telegramLabel: 'Telegram', comingSoon: 'COMING SOON · 尚未开放', xPendingLabel: 'X：尚未开放', telegramPendingLabel: 'Telegram：尚未开放' },
    ticker: { sectionLabel: 'FLAP STOCK 项目详情', symbolLabel: '代币符号', chainLabel: '网络', priceLabel: '价格', capacityLabel: '席位', statusLabel: '状态' },
    hero: {
      eyebrow: 'BNB SMART CHAIN · COMMUNITY MEME TOKEN',
      tagline: '不要预测风口，成为扇动翅膀的人。',
      description: 'FLAP 是由社区驱动的 Meme 代币。它不是股票、证券或投资产品。',
      explore: '探索故事',
      enterPresale: '进入预售',
      presalePendingLabel: '尚未开放',
      visualLabel: 'FLAP STOCK 品牌标志',
      brandSignalLabel: '品牌信号',
      brandSignalValue: '蝴蝶效应',
      safetyLabel: '非金融数据',
    },
    effect: {
      regionLabel: '蝴蝶效应',
      eyebrow: 'THE BUTTERFLY EFFECT',
      title: '没有基本面，只有蝴蝶面。',
      body: '微小行动沿着 Meme 文化扩散：一次振翅带来一次传播，一次传播也可能汇成一场风暴。',
      steps: [
        { index: '01', title: '一次振翅', body: '一个玩笑、一个创意或一次参与，都是微小的起点。' },
        { index: '02', title: '一次传播', body: '社区把一次行动接力成更远的 Meme 回响。' },
        { index: '03', title: '一场风暴', body: '无数次传播汇在一起，形成属于社区的 Meme 风暴。' },
      ],
    },
    signal: {
      regionLabel: 'Meme 信号终端',
      eyebrow: 'ENTERTAINMENT SIGNAL',
      title: '把情绪当作游戏，而非预测。',
      disclaimer: '仅供娱乐的社区信号，非金融数据，不构成任何投资建议。',
      metrics: [
        { label: '翅膀频率', value: '轻快', trend: '振翅同步中' },
        { label: '社区信号', value: '共振', trend: '社区传播中' },
        { label: 'Meme 引力', value: '聚合', trend: '创意持续汇入' },
        { label: '风暴等级', value: '酝酿', trend: '娱乐氛围展示' },
      ],
    },
    nameCore: {
      regionLabel: '蝴蝶股票四字内核',
      eyebrow: 'NAME CORE',
      title: '四个字，一套社区叙事。',
      cards: [
        { glyph: '蝴', title: '微小起点', body: '每一次振翅，都从一个微小行动开始。' },
        { glyph: '蝶', title: '不断进化', body: '蝴蝶在变化中生长，社区叙事也持续进化。' },
        { glyph: '股', title: '共同持有的注意力', body: '“股”是社区共同持有的注意力符号。' },
        { glyph: '票', title: '风暴入场券', body: '“票”是进入 Meme 风暴的入场券。' },
      ],
      disclaimer: '“股”和“票”仅为品牌比喻，不代表真实股权、股票、证券或证券票据。',
    },
    presale: {
      regionLabel: '预售控制台',
      eyebrow: 'PRESALE',
      title: '预售席位，等待下一次扇动。',
      body: '预售参数已公开；购买入口将在正式可用时开放。',
      facts: ['网络：BSC 主网', '固定金额：0.05 BNB', '每个地址限参与一次', '最多 10,000 个地址', '截止：北京时间 2026-09-09 23:59:59', 'FLAP 将在预售后人工发放', '不退款'],
      actionLabel: '参与预售',
      unavailable: '尚未开放',
      pendingLabel: '预售尚未开放',
      warning: '请勿向任何未验证地址转账；当前没有可用购买链接或合约地址。',
    },
    howTo: {
      regionLabel: '参与方式',
      eyebrow: 'HOW TO PARTICIPATE',
      title: '参与前，请保持清醒。',
      steps: [
        { index: '01', title: '准备 BSC 钱包和 BNB', body: '确认钱包支持 BSC 主网，并准备固定 0.05 BNB。' },
        { index: '02', title: '等待官方预售合约', body: '合约上线后，操作前核对网络、金额与官方链接。' },
        { index: '03', title: '保留交易记录', body: '成功参与后保留交易记录，并等待 FLAP 后续人工发放。' },
      ],
    },
    roadmap: {
      regionLabel: '路线图',
      eyebrow: 'ROADMAP',
      title: '路线由社区一起扇动。',
      phases: [
        { code: 'FLAP', title: '品牌与社区启动', body: '建立蝴蝶股票的品牌世界，并开启社区共振。', status: '当前阶段' },
        { code: 'FLY', title: '预售与 Meme 扩散', body: '推进预售、Meme 扩散与社区共创。', status: '后续阶段' },
        { code: 'STORM', title: '上线后的社区阶段', body: '代币上线后，由社区继续推动蝴蝶效应。', status: '未来阶段' },
      ],
      caveat: '未来阶段的具体安排以后续官方公告为准。',
    },
    manifesto: { regionLabel: '社区宣言', eyebrow: 'MANIFESTO', title: '不要预测风口，成为扇动翅膀的人。', body: '让每一次微小行动，汇成社区自己的 Meme 风暴。' },
    footer: { disclaimer: 'FLAP 是社区 Meme 代币，不是真实股票、证券或投资产品。', rights: '© 2026 FLAP STOCK. ALL RIGHTS RESERVED.' },
  },
  en: {
    nav: { story: 'STORY', signal: 'SIGNAL', presale: 'PRESALE', roadmap: 'ROADMAP', languageLabel: '中文', languageSwitchLabel: 'Switch to Chinese', menuOpenLabel: 'Open menu', menuCloseLabel: 'Close menu', homeLabel: 'FLAP STOCK home', logoLabel: 'FLAP STOCK logo', navigationLabel: 'Primary navigation' },
    community: { regionLabel: 'Community channels', xLabel: 'X', telegramLabel: 'Telegram', comingSoon: 'COMING SOON', xPendingLabel: 'X: COMING SOON', telegramPendingLabel: 'Telegram: COMING SOON' },
    ticker: { sectionLabel: 'FLAP STOCK project details', symbolLabel: 'SYMBOL', chainLabel: 'CHAIN', priceLabel: 'PRICE', capacityLabel: 'CAPACITY', statusLabel: 'STATUS' },
    hero: {
      eyebrow: 'BNB SMART CHAIN · COMMUNITY MEME TOKEN',
      tagline: 'Do not predict the wind. Be the one who flaps.',
      description: 'FLAP is a community-driven Meme token. It is not a stock, security, or investment product.',
      explore: 'EXPLORE THE STORY',
      enterPresale: 'ENTER PRESALE',
      presalePendingLabel: 'COMING SOON',
      visualLabel: 'FLAP STOCK brand mark',
      brandSignalLabel: 'BRAND SIGNAL',
      brandSignalValue: 'BUTTERFLY EFFECT',
      safetyLabel: 'NOT FINANCIAL DATA',
    },
    effect: {
      regionLabel: 'The Butterfly Effect',
      eyebrow: 'THE BUTTERFLY EFFECT',
      title: 'No fundamentals, only butterfly fundamentals.',
      body: 'Small actions travel through Meme culture: one flap becomes one spread, and one spread can gather into a storm.',
      steps: [
        { index: '01', title: 'ONE FLAP', body: 'A joke, an idea, or one act of participation is a small beginning.' },
        { index: '02', title: 'ONE SPREAD', body: 'The community carries one action into a wider Meme echo.' },
        { index: '03', title: 'ONE STORM', body: 'Countless shares gather into a Meme storm shaped by the community.' },
      ],
    },
    signal: {
      regionLabel: 'Meme Signal Terminal',
      eyebrow: 'ENTERTAINMENT SIGNAL',
      title: 'Treat sentiment as play, never prediction.',
      disclaimer: 'ENTERTAINMENT SIGNAL ONLY — NOT FINANCIAL DATA AND NOT INVESTMENT ADVICE.',
      metrics: [
        { label: 'WING FREQUENCY', value: 'LIVELY', trend: 'FLAPS IN SYNC' },
        { label: 'COMMUNITY SIGNAL', value: 'RESONANT', trend: 'TRAVELLING OUT' },
        { label: 'MEME GRAVITY', value: 'MAGNETIC', trend: 'IDEAS GATHERING' },
        { label: 'STORM LEVEL', value: 'BREWING', trend: 'ENTERTAINMENT DISPLAY' },
      ],
    },
    nameCore: {
      regionLabel: 'FLAP STOCK Character Core',
      eyebrow: 'NAME CORE',
      title: 'Four characters. One community story.',
      cards: [
        { glyph: '蝴', title: 'SMALL BEGINNING', body: 'Every flap begins with one small action.' },
        { glyph: '蝶', title: 'CONTINUOUS EVOLUTION', body: 'A butterfly changes as it grows, and the community story keeps evolving.' },
        { glyph: '股', title: 'COMMUNITY-HELD ATTENTION', body: '股 is a symbol of attention held together by the community.' },
        { glyph: '票', title: 'A TICKET INTO THE MEME STORM', body: '票 is a ticket into the Meme storm.' },
      ],
      disclaimer: 'The characters 股 and 票 are brand metaphors only. They do not represent equity, real stock, securities, or securities tickets.',
    },
    presale: {
      regionLabel: 'Presale Console',
      eyebrow: 'PRESALE',
      title: 'Presale places await the next flap.',
      body: 'The presale parameters are public; the purchase route opens when it is ready.',
      facts: ['NETWORK: BSC MAINNET', 'FIXED AMOUNT: 0.05 BNB', 'ONE PARTICIPATION PER ADDRESS', 'MAXIMUM: 10,000 ADDRESSES', 'DEADLINE: BEIJING TIME 2026-09-09 23:59:59', 'FLAP DISTRIBUTED MANUALLY AFTER PRESALE', 'NO REFUNDS'],
      actionLabel: 'JOIN PRESALE',
      unavailable: 'COMING SOON',
      pendingLabel: 'PRESALE COMING SOON',
      warning: 'Do not send funds to unverified addresses; no purchase link or contract address is currently available.',
    },
    howTo: {
      regionLabel: 'How to Join',
      eyebrow: 'HOW TO PARTICIPATE',
      title: 'Stay clear-eyed before you join.',
      steps: [
        { index: '01', title: 'PREPARE A BSC WALLET AND BNB', body: 'Use a wallet configured for BSC mainnet and prepare the fixed 0.05 BNB amount.' },
        { index: '02', title: 'WAIT FOR THE OFFICIAL PRESALE CONTRACT', body: 'When it is live, verify the network, amount, and official link before interacting.' },
        { index: '03', title: 'KEEP THE TRANSACTION RECORD', body: 'After successful participation, retain the transaction record and wait for later manual FLAP distribution.' },
      ],
    },
    roadmap: {
      regionLabel: 'Roadmap',
      eyebrow: 'ROADMAP',
      title: 'The route moves with the community’s wings.',
      phases: [
        { code: 'FLAP', title: 'BRAND AND COMMUNITY START', body: 'Establish the FLAP STOCK world and begin the community signal.', status: 'CURRENT PHASE' },
        { code: 'FLY', title: 'PRESALE AND MEME SPREAD', body: 'Advance the presale, Meme spread, and community co-creation.', status: 'NEXT PHASE' },
        { code: 'STORM', title: 'POST-LAUNCH COMMUNITY PHASE', body: 'After token launch, the community continues the butterfly effect.', status: 'FUTURE PHASE' },
      ],
      caveat: 'Specific future arrangements are subject to subsequent official announcements.',
    },
    manifesto: { regionLabel: 'Community Manifesto', eyebrow: 'MANIFESTO', title: 'Do not predict the wind. Be the one who flaps.', body: 'Let every small action gather into the community’s own Meme storm.' },
    footer: { disclaimer: 'FLAP is a community Meme token, not a real stock, security, or investment product.', rights: '© 2026 FLAP STOCK. ALL RIGHTS RESERVED.' },
  },
}
