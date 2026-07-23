// pages/home/home.js - 首页（工具选择页 + 主题切换 + 历史入口）
var config = require('../../config/tools.js')
var history = require('../../utils/history.js')

function calcCols(n) {
  if (n > 8) return 4
  if (n > 4) return 3
  return 2
}

Page({
  data: {
    appName: config.appName,
    tools: config.tools,
    gridCols: 2,
    isDark: false,
    historyCount: 0
  },

  onLoad: function () {
    var app = getApp()
    var dark = app.globalData.theme === 'dark'
    this.setData({
      gridCols: calcCols(config.tools.length),
      isDark: dark,
      historyCount: history.getAll().length
    })
  },

  onShow: function () {
    // 每次回到首页刷新历史计数
    this.setData({ historyCount: history.getAll().length })
  },

  // 主题切换
  toggleTheme: function () {
    var app = getApp()
    var next = app.toggleTheme()
    this.setData({ isDark: next === 'dark' })
  },

  // 工具卡片跳转
  goTool: function (e) {
    var url = e.currentTarget.dataset.path
    wx.navigateTo({ url: url })
  },

  // 跳转历史页
  goHistory: function () {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  // 分享
  onShareAppMessage: function () {
    return {
      title: config.appName + ' - 多种场景计算工具，算一算更好懂',
      path: '/pages/home/home'
    }
  }
})
