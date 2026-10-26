/** 世界时区（基准为 UTC，偏移单位：小时） */
export interface TimeZoneDef {
  label: string
  offset: number
  offsetLabel: string
  places: string[]
}

export const TIME_ZONES: TimeZoneDef[] = [
  {
    label: '西十二区',
    offset: -12,
    offsetLabel: 'UTC-12',
    places: ['国际日期变更线以西'],
  },
  {
    label: '西十一区',
    offset: -11,
    offsetLabel: 'UTC-11',
    places: ['萨摩亚', '纽埃岛'],
  },
  {
    label: '西十区',
    offset: -10,
    offsetLabel: 'UTC-10',
    places: ['夏威夷'],
  },
  {
    label: '西九区',
    offset: -9,
    offsetLabel: 'UTC-9',
    places: ['阿拉斯加'],
  },
  {
    label: '西八区',
    offset: -8,
    offsetLabel: 'UTC-8',
    places: ['太平洋时间', '洛杉矶', '旧金山', '温哥华', '西雅图', '拉斯维加斯'],
  },
  {
    label: '西七区',
    offset: -7,
    offsetLabel: 'UTC-7',
    places: ['山地时间', '亚利桑那', '马萨特兰', '凤凰城', '盐湖城', '丹佛', '埃德蒙顿'],
  },
  {
    label: '西六区',
    offset: -6,
    offsetLabel: 'UTC-6',
    places: ['美国和加拿大中部时间', '墨西哥城', '蒙特雷', '芝加哥', '休斯顿', '新奥尔良', '孟菲斯'],
  },
  {
    label: '西五区',
    offset: -5,
    offsetLabel: 'UTC-5',
    places: ['东部时间(美国和加拿大)', '哥伦比亚', '多伦多', '厄瓜多尔', '秘鲁', '古巴', '纽约', '汉密尔顿', '圣地亚哥'],
  },
  {
    label: '西四区',
    offset: -4,
    offsetLabel: 'UTC-4',
    places: ['委内瑞拉', '玻利维亚', '巴拉圭', '智利'],
  },
  {
    label: '西三区',
    offset: -3,
    offsetLabel: 'UTC-3',
    places: ['巴西', '圣地亚哥', '萨尔瓦多', '巴西利亚', '乌拉圭', '阿根廷', '苏里南'],
  },
  {
    label: '西二区',
    offset: -2,
    offsetLabel: 'UTC-2',
    places: ['南乔治亚岛', '费尔南多-迪诺罗尼亚岛'],
  },
  {
    label: '西一区',
    offset: -1,
    offsetLabel: 'UTC-1',
    places: ['佛得角', '亚速尔群岛'],
  },
  {
    label: '世界标准时间',
    offset: 0,
    offsetLabel: 'UTC+0',
    places: ['协调世界时', '格林威治时间', '英国', '里斯本', '托尔斯港', '伦敦', '都柏林', '爱丁堡'],
  },
  {
    label: '东一区',
    offset: 1,
    offsetLabel: 'UTC+1',
    places: ['欧洲中部', '西非', '中非西部', '德国', '爱尔兰', '法国', '阿姆斯特丹', '意大利', '柏林', '罗马', '西班牙', '布拉格', '贝尔格莱德', '布鲁塞尔', '巴黎', '马德里', '突尼斯', '加蓬', '摩洛哥'],
  },
  {
    label: '东二区',
    offset: 2,
    offsetLabel: 'UTC+2',
    places: ['欧洲东部', '非洲中部', '土耳其', '以色列', '南非', '伊斯坦布尔', '开罗', '雅典', '大马士革'],
  },
  {
    label: '东三区',
    offset: 3,
    offsetLabel: 'UTC+3',
    places: ['非洲东部', '俄罗斯', '巴格达', '科威特', '莫斯科', '圣彼得堡'],
  },
  {
    label: '东三区半',
    offset: 3.5,
    offsetLabel: 'UTC+3:30',
    places: ['伊朗标准时间', '德黑兰', '马什哈德'],
  },
  {
    label: '东四区',
    offset: 4,
    offsetLabel: 'UTC+4',
    places: ['阿布扎比', '第比利斯', '迪拜', '毛里求斯', '路易港'],
  },
  {
    label: '东五区',
    offset: 5,
    offsetLabel: 'UTC+5',
    places: ['巴基斯坦', '土库曼斯坦', '马尔代夫', '乌兹别克斯坦', '亚美比亚', '塔吉克斯坦'],
  },
  {
    label: '东五区半',
    offset: 5.5,
    offsetLabel: 'UTC+5:30',
    places: ['印度', '孟买', '新德里', '班加罗尔', '加尔各答'],
  },
  {
    label: '东六区',
    offset: 6,
    offsetLabel: 'UTC+6',
    places: ['新西伯利亚', '吉尔吉斯斯坦', '孟加拉国', '不丹'],
  },
  {
    label: '东七区',
    offset: 7,
    offsetLabel: 'UTC+7',
    places: ['泰国', '曼谷', '河内', '雅加达'],
  },
  {
    label: '东八区',
    offset: 8,
    offsetLabel: 'UTC+8',
    places: ['中国', '马来西亚', '菲律宾', '新加坡'],
  },
  {
    label: '东九区',
    offset: 9,
    offsetLabel: 'UTC+9',
    places: ['日本', '韩国', '东京', '首尔', '札幌', '大阪', '东帝汶'],
  },
  {
    label: '东十区',
    offset: 10,
    offsetLabel: 'UTC+10',
    places: ['澳大利亚', '海参崴', '关岛', '堪培拉', '墨尔本', '悉尼', '巴布亚新几内亚'],
  },
  {
    label: '东十一区',
    offset: 11,
    offsetLabel: 'UTC+11',
    places: ['所罗门群岛', '库页岛'],
  },
  {
    label: '东十二区',
    offset: 12,
    offsetLabel: 'UTC+12',
    places: ['新西兰', '奥克兰', '惠灵顿', '斐济', '瑙鲁'],
  },
]
