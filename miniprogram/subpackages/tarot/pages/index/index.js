// subpackages/tarot/pages/index/index.js - 牌阵选择
var cards = require('../../data/cards.js')

Page({
  data: {
    isDark: false,
    spreads: [
      { id: 'daily', name: '每日一牌', desc: '一张牌，照见今天的能量与提醒', emoji: '🌅', count: 1 },
      { id: 'timeline', name: '圣三角牌阵', desc: '过去 · 现在 · 未来，看清事情走向', emoji: '⏳', count: 3 },
      { id: 'relation', name: '决策牌阵', desc: '现状 · 阻碍 · 建议 · 结果', emoji: '🔮', count: 4 }
    ]
  },

  onLoad: function () {
    var app = getApp()
    this.setData({ isDark: app.globalData.theme === 'dark' })
  },

  onShow: function () {
    var app = getApp()
    this.setData({ isDark: app.globalData.theme === 'dark' })
  },

  goDraw: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/subpackages/tarot/pages/draw/draw?spread=' + id })
  },

  goHome: function () {
    wx.navigateBack()
  },

  onShareAppMessage: function () {
    return {
      title: '聚合计算 · 国潮塔罗，抽一张今天的牌',
      path: '/subpackages/tarot/pages/index/index'
    }
  }
})
