// pages/bmi/bmi.js - BMI 计算器
var report = require('../../utils/report.js')
var calcPage = require('../../behaviors/calc-page.js')

// ---- 常量 ----
var BMI_HEALTHY_MIN = 18.5   // 健康体重区间下界
var BMI_HEALTHY_MAX = 23.9   // 健康体重区间上界

var BMI_TABLE = [
  { min: 0, max: BMI_HEALTHY_MIN, name: '偏瘦', color: '#3498db', comment: '有点单薄，注意营养均衡 🍚' },
  { min: BMI_HEALTHY_MIN, max: 24, name: '正常', color: '#27ae60', comment: '身材刚好，继续保持 💪' },
  { min: 24, max: 28, name: '超重', color: '#f39c12', comment: '稍微圆润，该动一动了 🏃' },
  { min: 28, max: 999, name: '肥胖', color: '#e74c3c', comment: '建议关注健康，适度减脂 ⚠️' }
]

Page({
  behaviors: [calcPage],

  data: {
    height: '', weight: '', bmi: 0, bmiStr: '0.0',
    cat: null, rangeStr: '', showResult: false, isSaving: false,
    share: { ready: false, title: '', path: '/pages/bmi/bmi' }
  },

  calculate: function () {
    var d = this.data
    var h = parseFloat(d.height) || 0
    var w = parseFloat(d.weight) || 0
    if (h <= 0 || w <= 0) { this.setData({ showResult: false, bmi: 0, bmiStr: '0.0', cat: null, rangeStr: '' }); return }

    var hm = h / 100
    var bmi = w / (hm * hm)
    var cat = null
    for (var i = 0; i < BMI_TABLE.length; i++) { if (bmi >= BMI_TABLE[i].min && bmi < BMI_TABLE[i].max) { cat = BMI_TABLE[i]; break } }
    if (!cat) cat = BMI_TABLE[BMI_TABLE.length - 1]
    var lo = BMI_HEALTHY_MIN * hm * hm, hi = BMI_HEALTHY_MAX * hm * hm
    var rangeStr = Math.round(lo * 10) / 10 + ' ~ ' + Math.round(hi * 10) / 10 + ' kg'

    this.setData({
      bmi: bmi, bmiStr: bmi.toFixed(1), cat: cat, rangeStr: rangeStr, showResult: true,
      share: { ready: true, title: 'BMI ' + bmi.toFixed(1) + '，体质' + cat.name + '，来测', path: '/pages/bmi/bmi' }
    })
  },

  reset: function () {
    this.setData({ height: '', weight: '', bmi: 0, bmiStr: '0.0', cat: null, rangeStr: '', showResult: false, share: { ready: false, title: '', path: '/pages/bmi/bmi' } })
  },

  saveResult: function () {
    var d = this.data
    this.saveResultTemplate({
      toolId: 'bmi', toolName: 'BMI 计算器', icon: '⚖️',
      input: { height: d.height, weight: d.weight },
      // 懒计算：guard 通过（有结果）后才求值，避免无结果时 d.cat 为空抛错
      summary: function (d) { return 'BMI ' + d.bmiStr + ' | ' + d.cat.name + ' | 健康区间 ' + d.rangeStr },
      title: 'BMI 报告',
      theme: ['#11998e', '#38ef7d'],
      slogan: '健康，从算 BMI 开始',
      footer: '中国成人 BMI 标准 · 仅供参考',
      hook: '我的 BMI 是「' + d.bmiStr + '·' + (d.cat ? d.cat.name : '?') + '」，你什么体质？',
      guard: function (d) { return d.showResult },
      noResultHint: '请先输入身高体重',
      draw: function (canvas, ctx, W, H, data) {
        ctx.fillStyle = '#666'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('身高 ' + data.height + 'cm   体重 ' + data.weight + 'kg', W / 2, 105)
        if (data.cat) {
          report.drawBadge(ctx, { x: W / 2 - 70, y: 120, w: 140, h: 36, r: 18, bg: data.cat.color, text: data.cat.name, fontSize: 16 })
        }
        ctx.fillStyle = '#333'; ctx.font = '14px sans-serif'; ctx.fillText('你的 BMI 指数', W / 2, 188)
        ctx.fillStyle = data.cat ? data.cat.color : '#333'; ctx.font = 'bold 34px sans-serif'; ctx.fillText(data.bmiStr, W / 2, 224)
        report.drawDivider(ctx, 30, 248, W - 30)
        ctx.fillStyle = '#666'; ctx.font = '13px sans-serif'; ctx.fillText('中国成人标准 · 健康体重区间', W / 2, 278)
        ctx.fillStyle = '#27ae60'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(data.rangeStr, W / 2, 308)
        if (data.cat) { ctx.fillStyle = '#888'; ctx.font = '12px sans-serif'; ctx.fillText(data.cat.comment, W / 2, 340) }
      }
    })
  },

  restoreHistory: function (record) {
    var inp = record.input
    this.setData({ height: inp.height || '', weight: inp.weight || '' })
    this.calculate()
  }
})
