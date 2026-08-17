// pages/history/history.js - 历史记录页
var history = require('../../utils/history.js')
var config = require('../../config/tools.js')

// 时间格式化：刚刚 / N分钟前 / N小时前 / N天前 / 日期
function timeAgo(ts) {
  var diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  var d = new Date(ts)
  return (d.getMonth() + 1) + '/' + d.getDate()
}

Page({
  data: {
    list: [],
    isEmpty: false,
    filterTool: '',   // 空 = 全部
    toolOptions: []   // 筛选标签
  },

  onLoad: function () {
    var app = getApp()
    this.setData({ isDark: app.globalData.theme === 'dark' })
  },

  onShow: function () {
    var app = getApp()
    this.setData({ isDark: app.globalData.theme === 'dark' })
    this.refresh()
  },

  refresh: function (filterId) {
    // 仅「未传参」(undefined) 表示保持当前筛选；
    // 传 ''（「全部」标签 data-id=""）表示显式清除筛选 —— 不能用 || 兜底，否则点了「全部」无法回到全部
    filterId = filterId === undefined ? (this.data.filterTool || '') : filterId
    var list = filterId ? history.getByTool(filterId) : history.getAll()
    // 附加时间文本
    list = list.map(function (item) {
      item.timeText = timeAgo(item.ts)
      return item
    })

    // 生成筛选选项
    var toolMap = {}
    for (var i = 0; i < config.tools.length; i++) {
      toolMap[config.tools[i].id] = config.tools[i]
    }
    var allList = history.getAll()
    var seen = {}
    var options = []
    for (var j = 0; j < allList.length; j++) {
      var tid = allList[j].toolId
      if (!seen[tid] && toolMap[tid]) {
        seen[tid] = true
        options.push({ id: tid, name: toolMap[tid].name, icon: toolMap[tid].icon })
      }
    }

    this.setData({
      list: list,
      isEmpty: list.length === 0,
      filterTool: filterId,
      toolOptions: options
    })
  },

  // 点击某条：跳转对应工具页
  onTapItem: function (e) {
    var id = e.currentTarget.dataset.id
    var item = null
    var list = this.data.list
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { item = list[i]; break }
    }
    if (!item) return
    // 根据 toolId 找路由
    var tools = config.tools
    var path = '/pages/home/home'
    for (var j = 0; j < tools.length; j++) {
      if (tools[j].id === item.toolId) { path = tools[j].path; break }
    }
    // 跳转时传入历史数据（用全局暂存，工具页 onShow 消费后自动清空）
    getApp().globalData._historyRestore = item
    wx.navigateTo({ url: path })
  },

  // 切换收藏
  onStar: function (e) {
    var id = e.currentTarget.dataset.id
    history.star(id)
    this.refresh()
  },

  // 删除单条
  onRemove: function (e) {
    var id = e.currentTarget.dataset.id
    var that = this
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记录？',
      success: function (res) {
        if (res.confirm) {
          history.remove(id)
          that.refresh()
        }
      }
    })
  },

  // 筛选切换
  onFilter: function (e) {
    var id = e.currentTarget.dataset.id || ''
    this.refresh(id)
  },

  // 清空
  onClear: function () {
    var that = this
    wx.showModal({
      title: '清空历史',
      content: '将清空所有未收藏的历史记录，确定？',
      success: function (res) {
        if (res.confirm) {
          history.clear()
          that.refresh()
        }
      }
    })
  }
})
