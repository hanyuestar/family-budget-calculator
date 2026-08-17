// pages/progress/progress.js - 年度/人生进度条
var report = require('../../utils/report.js')
var calcPage = require('../../behaviors/calc-page.js')

var LIFE_EXPECT = 80
function pad(n) { return n < 10 ? '0' + n : '' + n }

Page({
  behaviors: [calcPage],

  data: {
    yearProgress: 0, monthProgress: 0, dayProgress: 0,
    yearText: '', monthText: '', dayText: '',
    birth: '', age: 0, lifeProgress: 0, lifeText: '', showLife: false,
    isSaving: false,
    share: { ready: true, title: '', path: '/pages/progress/progress' }
  },

  onLoad: function () {
    this.calcAuto()
    var y = new Date().getFullYear()
    this.setData({ share: { ready: true, title: y + ' 已过 ' + this.data.yearProgress.toFixed(1) + '%，来算算', path: '/pages/progress/progress' } })
  },

  calcAuto: function () {
    var now = new Date()
    var y = now.getFullYear()
    var startOfYear = new Date(y, 0, 1)
    var startOfMonth = new Date(y, now.getMonth(), 1)
    var startOfDay = new Date(y, now.getMonth(), now.getDate())
    var yearMs = new Date(y + 1, 0, 1) - startOfYear
    var monthMs = new Date(y, now.getMonth() + 1, 1) - startOfMonth
    var dayMs = 86400000
    var yearP = (now - startOfYear) / yearMs * 100
    var monthP = (now - startOfMonth) / monthMs * 100
    var dayP = (now - startOfDay) / dayMs * 100
    this.setData({
      yearProgress: yearP, monthProgress: monthP, dayProgress: dayP,
      yearText: y + ' 年已过 ' + yearP.toFixed(1) + '%',
      monthText: (now.getMonth() + 1) + ' 月已过 ' + monthP.toFixed(1) + '%',
      dayText: '今天已过 ' + dayP.toFixed(1) + '%'
    })
  },

  onInputBirth: function (e) {
    this.setData({ birth: e.detail.value })
    this.calcLife()
  },

  calcLife: function () {
    var birth = this.data.birth
    if (!birth) { this.setData({ showLife: false, age: 0, lifeProgress: 0, lifeText: '' }); return }
    var parts = birth.split('-')
    if (parts.length < 3) { this.setData({ showLife: false }); return }
    var by = +parts[0], bm = +parts[1], bd = +parts[2]
    var bDate = new Date(by, bm - 1, bd)
    var now = new Date()
    if (isNaN(bDate.getTime()) || bDate > now) { wx.showToast({ title: '出生日期有误', icon: 'none' }); this.setData({ showLife: false }); return }
    var age = now.getFullYear() - by
    if (now.getMonth() + 1 < bm || (now.getMonth() + 1 == bm && now.getDate() < bd)) age--
    var livedMs = now - bDate
    var totalMs = LIFE_EXPECT * 365.25 * 86400000
    var lifeP = livedMs / totalMs * 100
    if (lifeP < 0) lifeP = 0; if (lifeP > 100) lifeP = 100
    this.setData({ showLife: true, age: age, lifeProgress: lifeP, lifeText: '你已度过人生的 ' + lifeP.toFixed(1) + '%' })
  },

  reset: function () { this.setData({ birth: '', age: 0, lifeProgress: 0, lifeText: '', showLife: false }) },

  saveResult: function () {
    var d = this.data
    var curYear = new Date().getFullYear()

    this.saveResultTemplate({
      toolId: 'progress', toolName: '时光进度条', icon: '📊',
      input: d.showLife ? { birth: d.birth } : undefined,
      summary: d.showLife ? (d.age + ' 岁 | 人生进度 ' + d.lifeProgress.toFixed(1) + '%') : '',
      title: '我的进度条',
      theme: ['#667eea', '#764ba2'],
      slogan: '时间，看得见',
      footer: '按预期寿命 ' + LIFE_EXPECT + ' 岁估算，仅供参考',
      // 直接用结构化年份（curYear），不再依赖 yearText 字符串切分，避免格式变动导致静默错误
      hook: curYear + ' 已过「' + d.yearProgress.toFixed(1) + '%」，你的人生进度到哪了？',
      draw: function (canvas, ctx, W, H, data) {
        var rows = [
          { label: data.yearText, p: data.yearProgress },
          { label: data.monthText, p: data.monthProgress },
          { label: data.dayText, p: data.dayProgress }
        ]
        var y = 110
        for (var i = 0; i < rows.length; i++) {
          ctx.fillStyle = '#666'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(rows[i].label, 30, y)
          ctx.fillStyle = '#eee'; ctx.fillRect(30, y + 12, W - 60, 12)
          ctx.fillStyle = '#667eea'; ctx.fillRect(30, y + 12, (W - 60) * rows[i].p / 100, 12)
          ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(rows[i].p.toFixed(1) + '%', W - 30, y)
          y += 56
        }
        if (data.showLife) {
          report.drawDivider(ctx, 30, y, W - 30); y += 24
          ctx.fillStyle = '#666'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('人生进度（' + data.age + ' 岁）', 30, y)
          ctx.fillStyle = '#e74c3c'; ctx.fillRect(30, y + 12, (W - 60) * data.lifeProgress / 100, 12)
          ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(data.lifeProgress.toFixed(1) + '%', W - 30, y)
        }
      }
    })
  },

  restoreHistory: function (record) {
    var inp = record.input
    if (inp.birth) {
      this.setData({ birth: inp.birth })
      this.calcLife()
    }
  }
})
