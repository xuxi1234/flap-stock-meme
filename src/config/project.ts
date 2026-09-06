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
    priceBnb: '0.05',
    maxParticipants: 10_000,
    initialDeadline: 1_788_969_599,
    deadlineUtc: '2026-09-09T15:59:59Z',
    deadlineZh: '北京时间 2026-09-09 23:59:59',
    recipientAddress: '0x59389BDb944a4d8D4747b373b665a781d8DCD420',
    adminAddress: '0xbE37AB912De351B9312FA593C9f99e3279FDB0a2',
    oneParticipationPerAddress: true,
    contractAddress: null as NullableAddress,
    purchaseUrl: null as NullableLink,
  }),
  community: Object.freeze({ x: null as NullableLink, telegram: null as NullableLink }),
})
