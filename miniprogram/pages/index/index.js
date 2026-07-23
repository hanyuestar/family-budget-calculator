// pages/index/index.js - 支出计算页
var format = require('../../utils/format.js')
var report = require('../../utils/report.js')
var history = require('../../utils/history.js')
var calcPage = require('../../behaviors/calc-page.js')

Page({
  behaviors: [calcPage],

  data: {
    // 月度固定支出
    mortgage: '',        // 房贷
    carLoan: '',          // 车贷
    utility: '',          // 水电物业
    food: '',            // 餐饮日用
    transport: '',       // 交通出行
    telecom: '',          // 通讯费
    // 育儿支出（月度）
    babyFood: '',         // 奶粉尿不湿
    babyEdu: '',         // 教育托管
    babyOther: '',        // 衣物玩具游玩
    // 月度家庭支出
    parents: '',         // 赡养父母
    social: '',           // 人情往来
    // 年度支出
    insurance: '',       // 商业保险
    travel: '',           // 旅行度假
    electronics: '',     // 数码家电
    otherAnnual: '',     // 其他年度

    // 计算结果
    monthlyFixed: 0,      // 月度固定支出
    monthlyFamily: 0,     // 月度家庭支出
    monthlyTotal: 0,      // 月度总支出
    annualTotal: 0,        // 年度总支出
    insuranceRatio: 0,    // 保险占比
    insuranceColor: '#ccc', // 保险占比颜色

    // 格式化后的结果
    monthlyTotalStr: '0',
    annualTotalStr: '0',
    insuranceRatioStr: '0%',

    // 饼图图例数据
    pieLegend: [],

    // 保存状态
    isSaving: false,

    // 分享数据（供 behaviors/calc-page 的 onShareAppMessage 使用）
    share: { ready: false, title: '', path: '/pages/index/index' }
  },

  // 计算逻辑
  calculate: function () {
    var d = this.data
    // 解析输入值，空字符串视为0
    var mortgage = parseFloat(d.mortgage) || 0
    var carLoan = parseFloat(d.carLoan) || 0
    var utility = parseFloat(d.utility) || 0
    var food = parseFloat(d.food) || 0
    var transport = parseFloat(d.transport) || 0
    var telecom = parseFloat(d.telecom) || 0
    // 育儿支出
    var babyFood = parseFloat(d.babyFood) || 0
    var babyEdu = parseFloat(d.babyEdu) || 0
    var babyOther = parseFloat(d.babyOther) || 0
    var parents = parseFloat(d.parents) || 0
    var social = parseFloat(d.social) || 0
    var insurance = parseFloat(d.insurance) || 0
    var travel = parseFloat(d.travel) || 0
    var electronics = parseFloat(d.electronics) || 0
    var otherAnnual = parseFloat(d.otherAnnual) || 0

    // 月度固定支出 = 前6项
    var monthlyFixed = mortgage + carLoan + utility + food + transport + telecom
    // 月度育儿支出
    var monthlyBaby = babyFood + babyEdu + babyOther
    // 月度家庭支出（含育儿）
    var monthlyFamily = monthlyBaby + parents + social
    // 月度总支出
    var monthlyTotal = monthlyFixed + monthlyFamily
    // 年度总支出 = 月度总×12 + 年度项
    var annualTotal = monthlyTotal * 12 + insurance + travel + electronics + otherAnnual
    // 保险占比
    var insuranceRatio = annualTotal > 0 ? (insurance / annualTotal * 100) : 0

    // 保险占比颜色
    var insuranceColor = '#ccc'
    if (insuranceRatio === 0) {
      insuranceColor = '#ccc'
    } else if (insuranceRatio < 8) {
      insuranceColor = '#27ae60'
    } else if (insuranceRatio <= 15) {
      insuranceColor = '#e67e22'
    } else {
      insuranceColor = '#e74c3c'
    }

    // 饼图数据：15项占年度支出比例
    // 月度项按×12计入年度
    var items = [
      { name: '房贷', value: mortgage * 12, color: '#4A90D9' },
      { name: '车贷', value: carLoan * 12, color: '#357AbD' },
      { name: '水电物业', value: utility * 12, color: '#5DADE2' },
      { name: '餐饮日用', value: food * 12, color: '#48C9B0' },
      { name: '交通出行', value: transport * 12, color: '#F5B041' },
      { name: '通讯费', value: telecom * 12, color: '#AF7AC5' },
      { name: '奶粉尿不湿', value: babyFood * 12, color: '#F8C8DC' },
      { name: '教育托管', value: babyEdu * 12, color: '#82E0AA' },
      { name: '衣物玩具游玩', value: babyOther * 12, color: '#F0B27A' },
      { name: '赡养父母', value: parents * 12, color: '#EC7063' },
      { name: '人情往来', value: social * 12, color: '#F1948A' },
      { name: '商业保险', value: insurance, color: '#27AE60' },
      { name: '旅行度假', value: travel, color: '#E67E22' },
      { name: '数码家电', value: electronics, color: '#D4AC0D' },
      { name: '其他年度', value: otherAnnual, color: '#95A5A6' }
    ]

    // 过滤掉值为0的项
    var pieData = items.filter(function (item) {
      return item.value > 0
    })

    // 计算图例（含百分比）
    var pieLegend = pieData.map(function (item) {
      var pct = annualTotal > 0 ? (item.value / annualTotal * 100) : 0
      return {
        name: item.name,
        value: item.value,
        color: item.color,
        valueStr: format.formatMoney(item.value),
        pctStr: pct.toFixed(1) + '%'
      }
    })

    this.setData({
      monthlyFixed: monthlyFixed,
      monthlyFamily: monthlyFamily,
      monthlyTotal: monthlyTotal,
      annualTotal: annualTotal,
      insuranceRatio: insuranceRatio,
      insuranceColor: insuranceColor,
      monthlyTotalStr: format.formatMoney(Math.round(monthlyTotal)),
      annualTotalStr: format.formatMoney(Math.round(annualTotal)),
      insuranceRatioStr: insuranceRatio.toFixed(1) + '%',
      pieLegend: pieLegend,
      // 分享数据
      share: {
        ready: annualTotal > 0,
        title: '我家年度支出¥' + format.formatMoney(Math.round(annualTotal)) +
          '，保险占比' + insuranceRatio.toFixed(1) + '%，快来算算你的',
        path: '/pages/index/index'
      }
    })

    // 重绘饼图
    this.drawPie(pieData, annualTotal)
  },

  // 绘制环形饼图
  drawPie: function (data, total) {
    if (!total || total <= 0) {
      // 清空画布
      var ctxClear = wx.createCanvasContext('pieCanvas')
      ctxClear.draw()
      return
    }

    var ctx = wx.createCanvasContext('pieCanvas')
    var centerX = 85
    var centerY = 85
    var outerRadius = 75
    var innerRadius = 45

    var startAngle = -Math.PI / 2 // 从顶部开始
    // 绘制每个扇形
    for (var i = 0; i < data.length; i++) {
      var item = data[i]
      var angle = (item.value / total) * Math.PI * 2
      var endAngle = startAngle + angle

      // 外环
      ctx.beginPath()
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle)
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true)
      ctx.closePath()
      ctx.setFillStyle(item.color)
      ctx.fill()

      startAngle = endAngle
    }

    // 中心文字
    ctx.setFontSize(11)
    ctx.setTextAlign('center')
    ctx.setFillStyle('#999')
    ctx.fillText('年度支出', centerX, centerY - 8)
    ctx.setFontSize(13)
    ctx.setFillStyle('#333')
    ctx.fillText(format.formatMoney(Math.round(total)), centerX, centerY + 12)
    ctx.draw()
  },

  // 保存结果到相册 + 记录历史
  saveResult: function () {
    var that = this
    if (this.data.isSaving) return
    this.setData({ isSaving: true })
    var d = this.data
    if (d.annualTotal <= 0) {
      wx.showToast({ title: '请先输入支出数据', icon: 'none' })
      this.setData({ isSaving: false })
      return
    }
    // 写入历史
    history.add('expense', '家庭支出计算', '🧮', {
      mortgage: d.mortgage, carLoan: d.carLoan, utility: d.utility,
      food: d.food, transport: d.transport, telecom: d.telecom,
      babyFood: d.babyFood, babyEdu: d.babyEdu, babyOther: d.babyOther,
      parents: d.parents, social: d.social, insurance: d.insurance,
      travel: d.travel, electronics: d.electronics, otherAnnual: d.otherAnnual
    }, '月支出 ¥' + d.monthlyTotalStr + ' | 年度 ¥' + d.annualTotalStr + ' | 保险 ' + d.insuranceRatioStr)

    this.saveImage({
      title: '家庭年度支出报告',
      theme: ['#667eea', '#764ba2'],
      slogan: '每一笔，都算得清',
      footer: '数据仅供参考',
      hook: '我家一年在「' + (d.pieLegend.length ? d.pieLegend[0].name : '生活') + '」上花得最多，你呢？',
      draw: function (canvas, ctx, W, H, data) {
        report.drawRow(ctx, { label: '月度总支出', value: '¥ ' + data.monthlyTotalStr, y: 120, valueColor: '#4A90D9', valueSize: 20 })
        report.drawRow(ctx, { label: '年度总支出', value: '¥ ' + data.annualTotalStr, y: 160, valueColor: '#8e44ad', valueSize: 20 })
        report.drawRow(ctx, { label: '保险占比', value: data.insuranceRatioStr, y: 200, valueColor: data.insuranceColor, valueSize: 20 })
        report.drawDivider(ctx, 30, 220, W - 30)
        ctx.fillStyle = '#666666'
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('支出构成 Top5', 30, 245)
        var legend = data.pieLegend.slice(0, 5)
        var yPos = 270
        for (var i = 0; i < legend.length; i++) {
          var item = legend[i]
          ctx.fillStyle = item.color
          ctx.fillRect(30, yPos - 10, 10, 10)
          ctx.fillStyle = '#333333'
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText(item.name, 46, yPos)
          ctx.fillStyle = '#666666'
          ctx.textAlign = 'right'
          ctx.fillText('¥' + item.valueStr + '  ' + item.pctStr, W - 30, yPos)
          yPos += 26
        }
      }
    })
  },

  // 从历史记录恢复输入
  restoreHistory: function (record) {
    var inp = record.input
    this.setData({
      mortgage: inp.mortgage || '', carLoan: inp.carLoan || '', utility: inp.utility || '',
      food: inp.food || '', transport: inp.transport || '', telecom: inp.telecom || '',
      babyFood: inp.babyFood || '', babyEdu: inp.babyEdu || '', babyOther: inp.babyOther || '',
      parents: inp.parents || '', social: inp.social || '', insurance: inp.insurance || '',
      travel: inp.travel || '', electronics: inp.electronics || '', otherAnnual: inp.otherAnnual || ''
    })
    this.calculate()
  }
})
