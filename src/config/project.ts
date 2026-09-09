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
    websiteDeadline: 1_789_142_400,
    deadlineUtc: '2026-09-11T16:00:00Z',
    deadlineZh: '北京时间 2026-09-11 24:00（9 月 12 日 00:00）',
    deadlineEn: '2026-09-12 00:00 BEIJING TIME (END OF SEPTEMBER 11)',
    recipientAddress: '0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2',
    adminAddress: '0xbE37AB912De351B9312FA593C9f99e3279FDB0a2',
    oneParticipationPerAddress: true,
    contractAddress: '0x409c9448172b0f244a6823e91ad669281294622b' as NullableAddress,
    purchaseUrl: '#presale' as NullableLink,
  }),
  community: Object.freeze({ qq: 'https://qun.qq.com/universal-share/share?ac=1&authKey=tmim20R9SXdX%2Bf%2Btg51ZYjataEroH9hIhAbZQfhEP%2Bj8wc66cl52QbcBBW7jsnz%2F&busi_data=eyJncm91cENvZGUiOiI4MTA4NTU1NzgiLCJ0b2tlbiI6IktQaU9IREZtaVV2TU8vRlE2UUZZTnRQbmtOS2NDaGJ0RE9xL0dXcXRmLzB0cmdBVm5OV2tYM0x6WjQ3cDlra1AiLCJ1aW4iOiIxNjY2MDM0MSJ9&data=4fRsa_V5Cm2YvDTzxzHRMW2j2yAzmWyQLm7Ig_8kYD5XNNzCbYSlwJwx-LcGECC2dEUIutYZsJGNDdFP3MStAA&svctype=4&tempid=h5_group_info', x: 'https://x.com/hudiegupiao', telegram: 'https://t.me/hudiegupiao', debox: 'https://m.debox.pro/group?id=g4o88wvy&code=pgk4b63r' }),
})
