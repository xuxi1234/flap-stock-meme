type NullableLink = string | null
type NullableAddress = `0x${string}` | null

const brand = Object.freeze({
  chineseName: '蝴蝶股票',
  englishName: 'FLAP STOCK',
  symbol: 'FLAP',
  tagline: '不要预测风口，成为扇动翅膀的人。',
})

export const projectConfig = Object.freeze({
  brand,
  network: Object.freeze({ name: 'BNB Smart Chain', chainId: 56 }),
  token: Object.freeze({ contractAddress: null as NullableAddress, totalSupply: null as string | null }),
  presale: Object.freeze({
    websiteOpen: true,
    priceBnb: '0.05',
    maxParticipants: 10_000,
    initialDeadline: 1_788_969_599,
    deadlineUtc: '2026-09-09T15:59:59Z',
    deadlineZh: '北京时间 2026-09-09 23:59:59',
    recipientAddress: '0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2',
    adminAddress: '0xbE37AB912De351B9312FA593C9f99e3279FDB0a2',
    oneParticipationPerAddress: true,
    contractAddress: '0x409c9448172b0f244a6823e91ad669281294622b' as NullableAddress,
    purchaseUrl: '#presale' as NullableLink,
  }),
  community: Object.freeze({ qq: undefined, x: 'https://x.com/hudiegupiao', telegram: 'https://t.me/hudiegupiao', debox: 'https://m.debox.pro/group?id=g4o88wvy&code=pgk4b63r' }),
})
