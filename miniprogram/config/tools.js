// config/tools.js - 中央工具注册表（单一数据源）
// 新增一个工具：① 在 app.json 的 pages 数组注册页面路径；
// ② 在下面的 tools 数组加一项即可，首页列表会自动渲染。
// 顺序即首页展示顺序（自上而下）。
module.exports = {
  // 小程序对外显示名（全局统一，改这里即可）
  appName: '聚合计算',

  // 首页工具卡片列表（顺序 = 展示顺序）
  tools: [
    {
      id: 'tarot',
      icon: '🔮',
      name: '国潮塔罗',
      desc: '抽一张牌，照见今天的状态与提醒',
      path: '/subpackages/tarot/pages/index/index',
      hot: true
    },
    {
      id: 'wealth',
      icon: '💎',
      name: '财富层级测试',
      desc: '输入资产负债，测算你的财富等级',
      path: '/pages/wealth/wealth',
      hot: true
    },
    {
      id: 'saving',
      icon: '🐷',
      name: '存钱段位',
      desc: '算算你能存下多少钱，看看存钱习惯像几岁',
      path: '/pages/saving/saving'
    },
    {
      id: 'relation',
      icon: '👪',
      name: '亲戚关系',
      desc: '从"我"出发拼关系链，一键查出该叫TA什么',
      path: '/pages/relation/relation'
    },
    {
      id: 'expense',
      icon: '🧮',
      name: '家庭支出计算',
      desc: '15项支出明细，月度年度一目了然',
      path: '/pages/index/index'
    },
    {
      id: 'bmi',
      icon: '⚖️',
      name: 'BMI 计算器',
      desc: '身高体重一键算，看看你的体质指数',
      path: '/pages/bmi/bmi'
    },
    {
      id: 'progress',
      icon: '📊',
      name: '时光进度条',
      desc: '今年/人生进度一目了然，量化你的时间',
      path: '/pages/progress/progress'
    },
  ]
}
