/* ============================================================
 * 热量手账 · 品牌/店铺/规格数据
 * 奶茶咖啡品牌 TOP 热销单品 + 食品店铺（品类导航）+ 规格选择库
 * kcal = 中杯 · 默认糖（5分）基准值，price = 中杯基准价
 * ============================================================ */
'use strict';

/* ---------- 规格库 ---------- */
const DRINK_SPECS = {
  sweetness: [
    { label: '无糖', deltaKcal: -36, deltaPrice: 0 },
    { label: '3分糖', deltaKcal: -18, deltaPrice: 0 },
    { label: '5分糖', deltaKcal: 0, deltaPrice: 0 },
    { label: '7分糖', deltaKcal: 18, deltaPrice: 0 },
    { label: '全糖', deltaKcal: 36, deltaPrice: 0 }
  ],
  temperature: [
    { label: '冰', coef: 1, note: '' },
    { label: '常温', coef: 1, note: '' },
    { label: '热', coef: 1, note: '' }
  ],
  sizes: [
    { label: '中杯', coef: 1.0, priceCoef: 1.0 },
    { label: '大杯', coef: 1.25, priceCoef: 1.3 }
  ],
  toppings: [
    { name: '珍珠', kcal: 60, price: 2 },
    { name: '椰果', kcal: 35, price: 2 },
    { name: '芋泥', kcal: 120, price: 4 },
    { name: '奶盖', kcal: 150, price: 5 },
    { name: '波霸', kcal: 70, price: 2 },
    { name: '布丁', kcal: 80, price: 3 },
    { name: '红豆', kcal: 55, price: 2 },
    { name: '燕麦', kcal: 45, price: 3 }
  ]
};

const FOOD_SPECS = {
  portions: [
    { label: '小份', coef: 0.8, priceCoef: 0.85 },
    { label: '中份', coef: 1.0, priceCoef: 1.0 },
    { label: '大份', coef: 1.2, priceCoef: 1.2 }
  ],
  spices: [
    { label: '不辣', deltaKcal: 0 },
    { label: '微辣', deltaKcal: 5 },
    { label: '中辣', deltaKcal: 10 },
    { label: '特辣', deltaKcal: 15 }
  ]
};

/* ---------- 奶茶/咖啡品牌（drink 品类） ---------- */
const BRANDS = [
  {
    id: 'mixue', name: '蜜雪冰城', emoji: '🍦', color: '#E63329', flavor: '甜口',
    items: [
      { name: '冰鲜柠檬水', series: '果茶', kcal: 170, price: 4 },
      { name: '珍珠奶茶', series: '奶茶', kcal: 380, price: 8 },
      { name: '摇摇奶昔（草莓）', series: '奶茶', kcal: 320, price: 8 },
      { name: '满杯百香果', series: '果茶', kcal: 240, price: 8 },
      { name: '杨枝甘露', series: '奶茶', kcal: 330, price: 12 },
      { name: '原味冰淇淋', series: '甜品', kcal: 180, price: 3 },
      { name: '圣代（巧克力）', series: '甜品', kcal: 290, price: 6 },
      { name: '冰淇淋红茶', series: '果茶', kcal: 220, price: 7 },
      { name: '芝士奶盖四季春', series: '奶茶', kcal: 260, price: 10 },
      { name: '桃桃摇摇奶昔', series: '奶茶', kcal: 340, price: 8 },
      { name: '柠檬绿茶', series: '果茶', kcal: 150, price: 5 },
      { name: '草莓圣代', series: '甜品', kcal: 270, price: 6 },
      { name: '冰摇柠檬茶', series: '果茶', kcal: 190, price: 6 },
      { name: '芝士奶盖绿茶', series: '奶茶', kcal: 280, price: 10 },
      { name: '珍珠圣代', series: '甜品', kcal: 310, price: 7 }
    ]
  },
  {
    id: 'guming', name: '古茗', emoji: '🍇', color: '#2C3E50', flavor: '甜口',
    items: [
      { name: '超A芝士葡萄', series: '果茶', kcal: 380, price: 18 },
      { name: '杨枝甘露椰奶', series: '奶茶', kcal: 420, price: 17 },
      { name: '大叔奶茶', series: '奶茶', kcal: 350, price: 13 },
      { name: '满杯金菠萝', series: '果茶', kcal: 300, price: 16 },
      { name: '云雾栀子青', series: '纯茶', kcal: 180, price: 13 },
      { name: '茉莉奶绿', series: '奶茶', kcal: 290, price: 12 },
      { name: '椰椰啵啵', series: '奶茶', kcal: 310, price: 15 },
      { name: '草莓椰奶', series: '奶茶', kcal: 340, price: 16 },
      { name: '芝士奶盖乌龙', series: '奶茶', kcal: 330, price: 15 },
      { name: '多肉葡萄', series: '果茶', kcal: 360, price: 18 },
      { name: '生椰抹茶', series: '奶茶', kcal: 300, price: 16 },
      { name: '酒酿芋圆', series: '季节限定', kcal: 370, price: 15 },
      { name: '芝士茉莉', series: '奶茶', kcal: 290, price: 15 },
      { name: '满杯百香果', series: '果茶', kcal: 280, price: 15 },
      { name: '椰椰芒芒', series: '果茶', kcal: 290, price: 16 }
    ]
  },
  {
    id: 'yidiandian', name: '一点点', emoji: '🧋', color: '#A6B4C4', flavor: '甜口',
    items: [
      { name: '波霸奶茶', series: '奶茶', kcal: 390, price: 11 },
      { name: '四季春茶', series: '纯茶', kcal: 120, price: 9 },
      { name: '乌龙奶茶', series: '奶茶', kcal: 320, price: 12 },
      { name: '阿华田', series: '奶茶', kcal: 380, price: 13 },
      { name: '冰淇淋红茶', series: '果茶', kcal: 250, price: 12 },
      { name: '养乐多绿', series: '果茶', kcal: 200, price: 13 },
      { name: '仙草冻奶茶', series: '奶茶', kcal: 310, price: 12 },
      { name: '柠檬养乐多', series: '果茶', kcal: 180, price: 12 },
      { name: '可可芭蕾', series: '奶茶', kcal: 400, price: 14 },
      { name: '纯抹茶', series: '奶茶', kcal: 230, price: 14 },
      { name: '古早味奶绿', series: '奶茶', kcal: 280, price: 11 },
      { name: '百香三重奏', series: '果茶', kcal: 260, price: 14 },
      { name: '珍珠奶绿', series: '奶茶', kcal: 300, price: 11 },
      { name: '芒果青', series: '果茶', kcal: 210, price: 13 },
      { name: '奶茶三兄弟', series: '奶茶', kcal: 390, price: 13 }
    ]
  },
  {
    id: 'coco', name: 'CoCo都可', emoji: '🧉', color: '#8B5A2B', flavor: '甜口',
    items: [
      { name: '珍珠奶茶', series: '奶茶', kcal: 370, price: 10 },
      { name: '鲜百香双响炮', series: '果茶', kcal: 260, price: 14 },
      { name: '奶茶三兄弟', series: '奶茶', kcal: 400, price: 13 },
      { name: '柠檬红茶', series: '果茶', kcal: 160, price: 11 },
      { name: '青稞奶茶', series: '奶茶', kcal: 340, price: 13 },
      { name: '鲜芋青稞牛奶', series: '奶茶', kcal: 360, price: 15 },
      { name: '芒果欧蕾', series: '奶茶', kcal: 300, price: 14 },
      { name: '布丁奶茶', series: '奶茶', kcal: 350, price: 12 },
      { name: '双拼奶茶', series: '奶茶', kcal: 380, price: 12 },
      { name: '鲜醇芋泥牛奶', series: '奶茶', kcal: 340, price: 16 },
      { name: '蜜雪柠香', series: '果茶', kcal: 170, price: 10 },
      { name: '草莓厚乳', series: '季节限定', kcal: 320, price: 16 },
      { name: '鲜芋牛奶西米露', series: '奶茶', kcal: 320, price: 15 },
      { name: '柠檬椰果养乐多', series: '果茶', kcal: 210, price: 14 },
      { name: '红豆奶茶', series: '奶茶', kcal: 330, price: 12 }
    ]
  },
  {
    id: 'chagee', name: '霸王茶姬', emoji: '🍵', color: '#1B3A2F', flavor: '清淡',
    items: [
      { name: '伯牙绝弦', series: '奶茶', kcal: 260, price: 18 },
      { name: '桂馥兰香', series: '纯茶', kcal: 150, price: 15 },
      { name: '寻香山茶', series: '奶茶', kcal: 270, price: 18 },
      { name: '青青糯山', series: '奶茶', kcal: 290, price: 17 },
      { name: '万山红金丝小种', series: '纯茶', kcal: 140, price: 16 },
      { name: '白雾红尘', series: '奶茶', kcal: 250, price: 18 },
      { name: '春宴樱花乌龙', series: '季节限定', kcal: 240, price: 17 },
      { name: '醒时春山', series: '奶茶', kcal: 230, price: 17 },
      { name: '花田乌龙', series: '奶茶', kcal: 260, price: 18 },
      { name: '云栖玫瑰', series: '奶茶', kcal: 280, price: 19 },
      { name: '天香茉莉', series: '纯茶', kcal: 130, price: 15 },
      { name: '桂子飘香', series: '季节限定', kcal: 250, price: 18 },
      { name: '幽幽乌龙', series: '纯茶', kcal: 120, price: 15 },
      { name: '破沫云峰', series: '纯茶', kcal: 150, price: 16 },
      { name: '桂花米酿', series: '季节限定', kcal: 240, price: 18 }
    ]
  },
  {
    id: 'heytea', name: '喜茶', emoji: '🍑', color: '#7A3B2E', flavor: '甜口',
    items: [
      { name: '多肉葡萄', series: '果茶', kcal: 350, price: 29 },
      { name: '多肉桃李', series: '果茶', kcal: 320, price: 29 },
      { name: '烤黑糖波波牛乳', series: '奶茶', kcal: 420, price: 25 },
      { name: '芝芝莓莓', series: '果茶', kcal: 340, price: 29 },
      { name: '椰椰芒芒', series: '果茶', kcal: 300, price: 27 },
      { name: '满杯红柚', series: '果茶', kcal: 240, price: 26 },
      { name: '芝芝芒芒', series: '果茶', kcal: 330, price: 29 },
      { name: '生打椰椰奶冻', series: '奶茶', kcal: 350, price: 25 },
      { name: '轻芝多肉葡萄', series: '果茶', kcal: 280, price: 29 },
      { name: '纯绿妍茶后', series: '纯茶', kcal: 120, price: 15 },
      { name: '烤布蕾波波', series: '奶茶', kcal: 400, price: 25 },
      { name: '手剥龙眼冰', series: '季节限定', kcal: 310, price: 28 },
      { name: '满杯西柚', series: '果茶', kcal: 230, price: 25 },
      { name: '芝芝莓莓桃', series: '果茶', kcal: 340, price: 30 },
      { name: '烤黑糖波波鲜奶', series: '奶茶', kcal: 430, price: 26 }
    ]
  },
  {
    id: 'naixue', name: '奈雪的茶', emoji: '🍓', color: '#4A2C2A', flavor: '甜口',
    items: [
      { name: '霸气芝士葡萄', series: '果茶', kcal: 360, price: 27 },
      { name: '霸气草莓', series: '果茶', kcal: 300, price: 27 },
      { name: '霸气橙子', series: '果茶', kcal: 240, price: 25 },
      { name: '杨枝甘露', series: '奶茶', kcal: 380, price: 26 },
      { name: '鸭屎香宝藏茶', series: '奶茶', kcal: 340, price: 24 },
      { name: '金色山脉宝藏茶', series: '奶茶', kcal: 360, price: 24 },
      { name: '霸气芝士芒果', series: '果茶', kcal: 330, price: 28 },
      { name: '奈雪初露', series: '纯茶', kcal: 130, price: 15 },
      { name: '冰博克厚乳', series: '奶茶', kcal: 350, price: 26 },
      { name: '霸气芝士桃桃', series: '果茶', kcal: 320, price: 28 },
      { name: '抹茶芋泥宝藏茶', series: '季节限定', kcal: 390, price: 26 },
      { name: '草莓魔法棒奶茶', series: '季节限定', kcal: 370, price: 25 },
      { name: '霸气葡萄', series: '果茶', kcal: 330, price: 27 },
      { name: '霸气芝士草莓', series: '果茶', kcal: 310, price: 28 },
      { name: '冷泡茶系列', series: '纯茶', kcal: 20, price: 12 }
    ]
  },
  {
    id: 'luckin', name: '瑞幸咖啡', emoji: '☕', color: '#1B4B8F', flavor: '清淡',
    items: [
      { name: '生椰拿铁', series: '咖啡', kcal: 300, price: 16 },
      { name: '厚乳拿铁', series: '咖啡', kcal: 330, price: 18 },
      { name: '丝绒拿铁', series: '咖啡', kcal: 320, price: 17 },
      { name: '生酪拿铁', series: '咖啡', kcal: 340, price: 18 },
      { name: '标准美式', series: '咖啡', kcal: 10, price: 13 },
      { name: '拿铁', series: '咖啡', kcal: 180, price: 15 },
      { name: '卡布奇诺', series: '咖啡', kcal: 160, price: 15 },
      { name: '焦糖玛奇朵', series: '咖啡', kcal: 240, price: 17 },
      { name: '橙C美式', series: '咖啡', kcal: 120, price: 16 },
      { name: '茉莉花香拿铁', series: '咖啡', kcal: 210, price: 17 },
      { name: '抹茶瑞纳冰', series: '咖啡', kcal: 360, price: 20 },
      { name: '陨石拿铁', series: '咖啡', kcal: 340, price: 19 },
      { name: '生椰丝绒拿铁', series: '咖啡', kcal: 300, price: 17 },
      { name: '冰吸生椰拿铁', series: '咖啡', kcal: 310, price: 18 },
      { name: '橙香美式', series: '咖啡', kcal: 90, price: 15 }
    ]
  },
  {
    id: 'cotti', name: '库迪咖啡', emoji: '🧊', color: '#C8102E', flavor: '清淡',
    items: [
      { name: '生椰拿铁', series: '咖啡', kcal: 290, price: 9.9 },
      { name: '潘帕斯蓝生酪茉莉拿铁', series: '咖啡', kcal: 320, price: 12.9 },
      { name: '星辰厚乳拿铁', series: '咖啡', kcal: 340, price: 12.9 },
      { name: '阿根廷芝士拿铁', series: '咖啡', kcal: 330, price: 12.9 },
      { name: '库可冰（摩卡）', series: '咖啡', kcal: 310, price: 11.9 },
      { name: '燕麦拿铁', series: '咖啡', kcal: 260, price: 13.9 },
      { name: '拿铁', series: '咖啡', kcal: 170, price: 9.9 },
      { name: '美式', series: '咖啡', kcal: 10, price: 8.9 },
      { name: '摩卡', series: '咖啡', kcal: 250, price: 11.9 },
      { name: '焦糖拿铁', series: '咖啡', kcal: 230, price: 11.9 },
      { name: '库迪冰萃咖啡', series: '咖啡', kcal: 30, price: 9.9 },
      { name: '柚C美式', series: '季节限定', kcal: 130, price: 10.9 },
      { name: '生椰丝绒拿铁', series: '咖啡', kcal: 280, price: 11.9 },
      { name: '轻乳酪拿铁', series: '咖啡', kcal: 290, price: 12.9 },
      { name: '桂花酿拿铁', series: '季节限定', kcal: 250, price: 12.9 }
    ]
  }
];

/* ---------- 食品店铺（按品类找） ---------- */
const SHOPS = [
  { id: 'mcd', name: '麦当劳', emoji: '🍔', cat: '汉堡炸鸡', flavor: '咸香', color: '#F5A300', items: [
    { name: '麦辣鸡腿堡', kcal: 490, price: 21 },
    { name: '板烧鸡腿堡', kcal: 420, price: 21 },
    { name: '巨无霸', kcal: 550, price: 26 },
    { name: '薯条（中）', kcal: 320, price: 12 },
    { name: '麦辣鸡翅（对）', kcal: 280, price: 12.5 }
  ]},
  { id: 'kfc', name: '肯德基', emoji: '🍟', cat: '汉堡炸鸡', flavor: '咸香', color: '#A40000', items: [
    { name: '香辣鸡腿堡', kcal: 560, price: 22 },
    { name: '原味鸡（块）', kcal: 270, price: 12 },
    { name: '老北京鸡肉卷', kcal: 480, price: 20 },
    { name: '薯条（中）', kcal: 320, price: 11 },
    { name: '蛋挞（只）', kcal: 200, price: 7 }
  ]},
  { id: 'hls', name: '华莱士', emoji: '🍗', cat: '汉堡炸鸡', flavor: '咸香', color: '#E63329', items: [
    { name: '香辣鸡腿堡', kcal: 480, price: 10 },
    { name: '脆皮全鸡', kcal: 1400, price: 28 },
    { name: '鸡米花（中）', kcal: 380, price: 9 },
    { name: '薯条（中）', kcal: 300, price: 8 }
  ]},
  { id: 'zl', name: '张亮麻辣烫', emoji: '🌶️', cat: '麻辣烫', flavor: '辣', color: '#D32F2F', items: [
    { name: '麻辣烫（素）', kcal: 350, price: 15 },
    { name: '麻辣烫（荤）', kcal: 550, price: 24 },
    { name: '麻辣拌', kcal: 500, price: 22 },
    { name: '骨汤清汤烫', kcal: 380, price: 18 }
  ]},
  { id: 'ygf', name: '杨国福', emoji: '🍲', cat: '麻辣烫', flavor: '辣', color: '#B02A30', items: [
    { name: '经典麻辣烫', kcal: 450, price: 20 },
    { name: '骨汤麻辣烫', kcal: 400, price: 20 },
    { name: '麻辣拌（荤）', kcal: 520, price: 24 }
  ]},
  { id: 'shaxian', name: '沙县小吃', emoji: '🍜', cat: '粉面', flavor: '咸香', color: '#2E7D32', items: [
    { name: '拌面', kcal: 450, price: 8 },
    { name: '蒸饺（笼）', kcal: 320, price: 8 },
    { name: '飘香馄饨', kcal: 300, price: 10 },
    { name: '鸡腿饭', kcal: 620, price: 16 }
  ]},
  { id: 'lanzhou', name: '兰州拉面', emoji: '🍝', cat: '粉面', flavor: '咸香', color: '#B08D57', items: [
    { name: '牛肉拉面', kcal: 520, price: 13 },
    { name: '西红柿鸡蛋面', kcal: 430, price: 12 },
    { name: '牛肉炒面', kcal: 650, price: 18 },
    { name: '兰州牛肉面（毛细）', kcal: 500, price: 13 }
  ]},
  { id: 'laoxiangji', name: '老乡鸡', emoji: '🐔', cat: '米饭套餐', flavor: '清淡', color: '#B53B2A', items: [
    { name: '鸡汤饭套餐', kcal: 480, price: 22 },
    { name: '肥西老母鸡汤', kcal: 210, price: 15 },
    { name: '青椒炒肉饭', kcal: 620, price: 20 },
    { name: '小炒肉饭', kcal: 640, price: 20 },
    { name: '白切鸡饭', kcal: 550, price: 22 }
  ]},
  { id: 'xiangcunji', name: '乡村基', emoji: '🍚', cat: '米饭套餐', flavor: '咸香', color: '#C62828', items: [
    { name: '宫保鸡丁饭', kcal: 580, price: 16 },
    { name: '鱼香肉丝饭', kcal: 590, price: 16 },
    { name: '酸菜鱼饭', kcal: 610, price: 19 },
    { name: '番茄炒蛋饭', kcal: 460, price: 14 }
  ]},
  { id: 'shaye', name: '沙野轻食', emoji: '🥗', cat: '轻食沙拉', flavor: '清淡', color: '#4CAF50', items: [
    { name: '鸡胸肉沙拉', kcal: 330, price: 23 },
    { name: '牛油果藜麦碗', kcal: 420, price: 28 },
    { name: '虾仁糙米碗', kcal: 380, price: 26 },
    { name: '全麦三明治', kcal: 300, price: 15 }
  ]},
  { id: 'superzhan', name: '超能鹿战队', emoji: '🥦', cat: '轻食沙拉', flavor: '清淡', color: '#2E7D32', items: [
    { name: '低脂鸡胸能量碗', kcal: 350, price: 24 },
    { name: '金枪鱼沙拉', kcal: 300, price: 26 },
    { name: '蛋白双拼碗', kcal: 400, price: 27 }
  ]},
  { id: 'bali', name: '巴黎贝甜', emoji: '🍰', cat: '甜品面包', flavor: '甜口', color: '#8E6FAE', items: [
    { name: '奶油泡芙（个）', kcal: 180, price: 9 },
    { name: '芝士蛋糕', kcal: 320, price: 18 },
    { name: '牛角包', kcal: 260, price: 12 },
    { name: '提拉米苏', kcal: 380, price: 22 }
  ]},
  { id: '85c', name: '85度C', emoji: '🍞', cat: '甜品面包', flavor: '甜口', color: '#5D4037', items: [
    { name: '凯撒大帝', kcal: 420, price: 15 },
    { name: '海盐芝士欧包', kcal: 350, price: 14 },
    { name: '半熟芝士', kcal: 280, price: 16 },
    { name: '奶香片', kcal: 220, price: 10 }
  ]}
];

/* ---------- 品类导航 ---------- */
const FOOD_CATEGORIES = [
  { name: '奶茶咖啡', emoji: '🧋' },
  { name: '汉堡炸鸡', emoji: '🍔' },
  { name: '麻辣烫', emoji: '🌶️' },
  { name: '粉面', emoji: '🍜' },
  { name: '米饭套餐', emoji: '🍚' },
  { name: '轻食沙拉', emoji: '🥗' },
  { name: '甜品面包', emoji: '🍰' }
];

/* ---------- 平台校准数据（演示“有更新”角标） ---------- */
const PLATFORM_CALIBRATIONS = {
  '生椰拿铁（瑞幸）': { kcal: 285, source: '瑞幸2026年官方营养表' },
  '珍珠奶茶（蜜雪）': { kcal: 375, source: '蜜雪冰城2026年官方营养表' },
  '食堂炒饭': { kcal: 600, source: '平台众包校准' },
  '黄焖鸡米饭': { kcal: 655, source: '平台众包校准' }
};

/* ---------- 工具：根据名称关键词推测系列（AI 自动归类兜底） ---------- */
function guessSeries(name) {
  if (/拿铁|美式|咖啡|摩卡|玛奇朵|瑞纳冰|卡布奇诺/.test(name)) return '咖啡';
  if (/芝士|奶茶|波波|奶绿|欧蕾|鲜芋|奶盖|宝藏|奶昔|厚乳/.test(name)) return '奶茶';
  if (/柠檬|百香|葡萄|草莓|芒果|桃|柚|橙|西瓜|龙眼/.test(name)) return '果茶';
  if (/限定|樱花|酒酿/.test(name)) return '季节限定';
  if (/纯茶|四季春|乌龙|红茶|绿茶|茉莉/.test(name)) return '纯茶';
  return '其他';
}

/* 相似度（简单字符重合度）用于名称消歧 */
function nameSimilarity(a, b) {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  let hit = 0;
  setA.forEach((c) => { if (setB.has(c)) hit++; });
  return hit / Math.max(setA.size, setB.size);
}
