// pages/wealth/wealth.js - 财富层级计算页
var format = require('../../utils/format.js')
var report = require('../../utils/report.js')
var calcPage = require('../../behaviors/calc-page.js')

Page({
  behaviors: [calcPage],

  data: {
    // 家庭资产（万元）
    property: '', financial: '', vehicle: '', equity: '',
    // 家庭负债（万元）
    mortgageDebt: '', carDebt: '', consumerDebt: '', otherDebt: '',
    // 计算结果
    totalAsset: 0, totalDebt: 0, netAsset: 0, debtRatio: 0,
    netAssetStr: '0.0', totalAssetStr: '0.0', totalDebtStr: '0.0', debtRatioStr: '0%',
    level: null, showResult: false, isSaving: false,
    levelTable: [
      { name: '贫困层', emoji: '🏚️', range: '< 10万', desc: '收入仅能覆盖基本生活，抗风险能力较弱，建议优先积累应急资金', color: '#e74c3c', min: 0, max: 10 },
      { name: '温饱层', emoji: '🏠', range: '10 - 50万', desc: '能满足日常开支，但大额支出压力较大，建议稳步积累金融资产', color: '#e67e22', min: 10, max: 50 },
      { name: '小康层', emoji: '🏢', range: '50 - 200万', desc: '生活相对稳定，有基础资产积累，可开始配置多元化投资', color: '#d4ac0d', min: 50, max: 200 },
      { name: '中产层', emoji: '🏛️', range: '200 - 600万', desc: '资产结构较健康，抗风险能力较强，可优化资产配置提升被动收入', color: '#27ae60', min: 200, max: 600 },
      { name: '富裕层', emoji: '🏰', range: '600 - 1000万', desc: '被动收入可覆盖大部分日常开支，已初步实现财务自主', color: '#16a085', min: 600, max: 1000 },
      { name: '高净值层', emoji: '💎', range: '1000万 - 1亿', desc: '财富体量可观，建议关注资产保值、跨周期配置与财富传承', color: '#2980b9', min: 1000, max: 10000 },
      { name: '超高净值层', emoji: '👑', range: '> 1亿', desc: '处于财富金字塔顶端，需综合规划家族财富、税务与资产保全', color: '#8e44ad', min: 10000, max: Infinity }
    ],
    share: { ready: false, title: '', path: '/pages/wealth/wealth' }
  },
  calculate: function () {
    var d = this.data
    var property = parseFloat(d.property) || 0
    var financial = parseFloat(d.financial) || 0
    var vehicle = parseFloat(d.vehicle) || 0
    var equity = parseFloat(d.equity) || 0
    var mortgageDebt = parseFloat(d.mortgageDebt) || 0
    var carDebt = parseFloat(d.carDebt) || 0
    var consumerDebt = parseFloat(d.consumerDebt) || 0
    var otherDebt = parseFloat(d.otherDebt) || 0

    var totalAsset = property + financial + vehicle + equity
    var totalDebt = mortgageDebt + carDebt + consumerDebt + otherDebt
    var netAsset = totalAsset - totalDebt
    var debtRatio = totalAsset > 0 ? (totalDebt / totalAsset * 100) : 0

    var level = null
    var levels = d.levelTable
    for (var i = 0; i < levels.length; i++) {
      if (netAsset >= levels[i].min && netAsset < levels[i].max) { level = levels[i]; break }
    }
    if (!level && netAsset < 0) level = levels[0]

    var hasInput = !!(d.property || d.financial || d.vehicle || d.equity ||
      d.mortgageDebt || d.carDebt || d.consumerDebt || d.otherDebt)

    this.setData({
      totalAsset: totalAsset, totalDebt: totalDebt, netAsset: netAsset, debtRatio: debtRatio,
      netAssetStr: format.formatWan(netAsset), totalAssetStr: format.formatWan(totalAsset),
      totalDebtStr: format.formatWan(totalDebt), debtRatioStr: debtRatio.toFixed(1) + '%',
      level: level, showResult: hasInput,
      share: {
        ready: hasInput,
        title: level ? ('净资产' + format.formatWan(netAsset) + '万，「' + level.name + '」，来测') : '来测测你的财富层级',
        path: '/pages/wealth/wealth'
      }
    })
  },

  reset: function () {
    this.setData({
      property: '', financial: '', vehicle: '', equity: '',
      mortgageDebt: '', carDebt: '', consumerDebt: '', otherDebt: '',
      totalAsset: 0, totalDebt: 0, netAsset: 0, debtRatio: 0,
      netAssetStr: '0.0', totalAssetStr: '0.0', totalDebtStr: '0.0', debtRatioStr: '0%',
      level: null, showResult: false,
      share: { ready: false, title: '', path: '/pages/wealth/wealth' }
    })
  },

  saveResult: function () {
    var d = this.data
    this.saveResultTemplate({
      toolId: 'wealth', toolName: '财富层级测试', icon: '💎',
      input: {
        property: d.property, financial: d.financial, vehicle: d.vehicle, equity: d.equity,
        mortgageDebt: d.mortgageDebt, carDebt: d.carDebt, consumerDebt: d.consumerDebt, otherDebt: d.otherDebt
      },
      summary: '净资产 ' + d.netAssetStr + '万 | ' + (d.level ? d.level.name : '未知'),
      title: '家庭财富层级报告',
      theme: ['#667eea', '#764ba2'],
      slogan: '看清你的财富坐标',
      footer: '数据仅供参考',
      hook: '我的家庭净资产排「' + (d.level ? d.level.name : '未知') + '」，测测你第几层',
      guard: function (d) { return d.showResult },
      noResultHint: '请先输入资产数据',
      draw: function (canvas, ctx, W, H, data) {
        ctx.fillStyle = '#888'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('你的家庭净资产为', W / 2, 115)
        ctx.fillStyle = '#8e44ad'; ctx.font = 'bold 32px sans-serif'
        ctx.fillText(data.netAssetStr + ' 万元', W / 2, 155)
        if (data.level) {
          report.drawBadge(ctx, { x: W / 2 - 70, y: 175, w: 140, h: 36, r: 18, bg: data.level.color, text: data.level.emoji + ' ' + data.level.name, fontSize: 16 })
        }
        report.drawDivider(ctx, 30, 235, W - 30)
        var colW = (W - 60) / 3
        ctx.fillStyle = '#999'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('总资产', 30 + colW / 2, 260); ctx.fillStyle = '#333'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(data.totalAssetStr + '万', 30 + colW / 2, 285)
        ctx.strokeStyle = '#d0d0d0'; ctx.beginPath(); ctx.moveTo(30 + colW, 255); ctx.lineTo(30 + colW, 295); ctx.stroke()
        ctx.fillStyle = '#999'; ctx.font = '11px sans-serif'; ctx.fillText('总负债', 30 + colW + colW / 2, 260)
        ctx.fillStyle = '#333'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(data.totalDebtStr + '万', 30 + colW + colW / 2, 285)
        ctx.strokeStyle = '#d0d0d0'; ctx.beginPath(); ctx.moveTo(30 + colW * 2, 255); ctx.lineTo(30 + colW * 2, 295); ctx.stroke()
        ctx.fillStyle = '#999'; ctx.font = '11px sans-serif'; ctx.fillText('负债率', 30 + colW * 2 + colW / 2, 260)
        ctx.fillStyle = '#333'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(data.debtRatioStr, 30 + colW * 2 + colW / 2, 285)
        if (data.level) {
          ctx.fillStyle = '#666'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
          var desc = data.level.desc
          if (desc.length > 24) { ctx.fillText(desc.substring(0, 24), W / 2, 320); ctx.fillText(desc.substring(24), W / 2, 340) }
          else { ctx.fillText(desc, W / 2, 330) }
        }
      }
    })
  },

  restoreHistory: function (record) {
    var inp = record.input
    this.setData({
      property: inp.property || '', financial: inp.financial || '', vehicle: inp.vehicle || '', equity: inp.equity || '',
      mortgageDebt: inp.mortgageDebt || '', carDebt: inp.carDebt || '', consumerDebt: inp.consumerDebt || '', otherDebt: inp.otherDebt || ''
    })
    this.calculate()
  }
})
