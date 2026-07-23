// pages/saving/saving.js - 存钱段位（正向 + 目标倒推）
var format = require('../../utils/format.js')
var report = require('../../utils/report.js')
var history = require('../../utils/history.js')
var calcPage = require('../../behaviors/calc-page.js')

// 年限选项
var YEAR_OPTS = []
for (var i = 1; i <= 30; i++) { YEAR_OPTS.push(i + '年') }

Page({
  behaviors: [calcPage],

  data: {
    mode: 'forward',  // 'forward' | 'reverse'

    // 正向输入
    income: '',
    expense: '',

    // 倒推输入
    goalAmount: '',
    goalYearOptions: YEAR_OPTS,
    goalYearIdx: 4,   // 默认「5年」

    // 结果
    monthSaving: 0,
    savingRate: 0,
    incomeStr: '0',
    expenseStr: '0',
    savingStr: '0',
    savingRateStr: '0%',
    goalIncomeStr: '0',

    rank: null,
    showResult: false,
    isSaving: false,

    wealthAge: 0,
    wealthAgeComment: '',
    yearlySaved: '0',
    yearlyCompare: '',

    rankTable: [
      { name: '青铜', emoji: '🥉', color: '#cd7f32', min: 0,  max: 10 },
      { name: '白银', emoji: '🥈', color: '#a0a0a0', min: 10, max: 20 },
      { name: '黄金', emoji: '🥇', color: '#d4ac0d', min: 20, max: 30 },
      { name: '钻石', emoji: '💎', color: '#2e86c1', min: 30, max: 50 },
      { name: '王者', emoji: '👑', color: '#8e44ad', min: 50, max: 100 }
    ],

    ageAnchors: [
      [5, 22], [10, 25], [15, 28], [20, 30], [25, 33], [30, 36],
      [35, 39], [40, 43], [45, 47], [50, 52], [55, 57], [60, 62]
    ],

    compareTable: [
      { min: 0, max: 999, icon: '🎧', desc: '还不够买一副降噪耳机' },
      { min: 1000, max: 2999, icon: '🏕️', desc: '够来一次周末短途游' },
      { min: 3000, max: 4999, icon: '🛵', desc: '差不多一台电动摩托车' },
      { min: 5000, max: 9999, icon: '📱', desc: '够买一部新款智能手机' },
      { min: 10000, max: 19999, icon: '✈️', desc: '可以去一次出境深度游' },
      { min: 20000, max: 29999, icon: '🏖️', desc: '够一次全家国内豪华游' },
      { min: 30000, max: 49999, icon: '🚗', desc: '差不多一辆二手代步车' },
      { min: 50000, max: 79999, icon: '🚙', desc: '够一辆五菱宏光MINIEV' },
      { min: 80000, max: 99999, icon: '🚘', desc: '差不多一辆比亚迪海鸥' },
      { min: 100000, max: 149999, icon: '🚗', desc: '够一辆经济型轿车全款' },
      { min: 150000, max: 199999, icon: '🏠', desc: '够三四线城市一套小户型首付' },
      { min: 200000, max: 299999, icon: '🏡', desc: '够二线城市一间房首付' },
      { min: 300000, max: 999999999, icon: '👑', desc: '攒钱王者，财富自由在望' }
    ],

    share: { ready: false, title: '', path: '/pages/saving/saving' }
  },

  // ---- 输入 ----
  onInput: function (e) {
    var update = {}
    update[e.detail.field] = e.detail.value
    update.showResult = false
    this.setData(update)
  },

  onPickYear: function (e) {
    this.setData({ goalYearIdx: parseInt(e.detail.value), showResult: false })
  },

  switchMode: function (e) {
    var m = e.currentTarget.dataset.mode
    this.setData({ mode: m, showResult: false })
  },

  doCalculate: function () {
    if (this.data.mode === 'forward') {
      this.forwardCalc()
    } else {
      this.reverseCalc()
    }
    if (this.data.showResult) {
      wx.showToast({ title: '计算结果已出 👇', icon: 'none', duration: 1500 })
    }
  },

  // ---- 正向：已知收入+支出 → 储蓄率+段位 ----
  forwardCalc: function () {
    var d = this.data
    var income = Math.max(0, parseFloat(d.income) || 0)
    var expense = Math.max(0, parseFloat(d.expense) || 0)
    var saving = income - expense
    var rate = income > 0 ? (saving / income * 100) : 0
    if (rate < 0) rate = 0

    var rank = this.matchRank(rate, d.rankTable)
    var wealthAge = this.calcWealthAge(rate)
    var comment = this.ageComment(wealthAge)
    var yearlySaved = saving > 0 ? saving * 12 : 0
    var compare = this.calcCompare(yearlySaved)

    var hasInput = !!(d.income || d.expense)

    this.setData({
      monthSaving: saving, savingRate: rate,
      incomeStr: d.income, expenseStr: d.expense,
      savingStr: format.formatMoney(Math.round(saving)),
      savingRateStr: rate.toFixed(1) + '%',
      rank: rank, showResult: hasInput,
      wealthAge: wealthAge, wealthAgeComment: comment,
      yearlySaved: format.formatMoney(Math.round(yearlySaved)),
      yearlyCompare: compare,
      share: {
        ready: hasInput,
        title: rank ? ('存钱段位「' + rank.name + '」储蓄率' + rate.toFixed(1) + '%，财富年龄' + wealthAge + '岁，来测') : '来测测你的存钱段位',
        path: '/pages/saving/saving'
      }
    })
  },

  // ---- 倒推：目标+年限+月支出 → 所需月储蓄+月收入+段位 ----
  reverseCalc: function () {
    var d = this.data
    var goal = Math.max(0, parseFloat(d.goalAmount) || 0)
    var years = d.goalYearIdx + 1
    var months = years * 12
    var expense = Math.max(0, parseFloat(d.expense) || 0)
    var needSave = months > 0 ? goal / months : 0
    var needIncome = needSave + expense
    var rate = needIncome > 0 ? (needSave / needIncome * 100) : 0
    var rank = this.matchRank(rate, d.rankTable)
    var wealthAge = this.calcWealthAge(rate)

    var hasInput = goal > 0 && expense >= 0

    this.setData({
      monthSaving: needSave, savingRate: rate,
      incomeStr: format.formatMoney(Math.round(needIncome)),
      expenseStr: format.formatMoney(Math.round(expense)),
      savingStr: format.formatMoney(Math.round(needSave)),
      savingRateStr: rate.toFixed(1) + '%',
      goalIncomeStr: format.formatMoney(Math.round(needIncome)),
      rank: rank, showResult: hasInput,
      wealthAge: wealthAge, wealthAgeComment: this.ageComment(wealthAge),
      yearlySaved: format.formatMoney(Math.round(needSave * 12)),
      yearlyCompare: this.calcCompare(needSave * 12),
      share: {
        ready: hasInput,
        title: '想' + years + '年攒 ¥' + format.formatMoney(Math.round(goal)) + '？每月需存 ¥' + format.formatMoney(Math.round(needSave)) + '，来测',
        path: '/pages/saving/saving'
      }
    })
  },

  // ---- 共享辅助 ----
  matchRank: function (rate, ranks) {
    for (var i = 0; i < ranks.length; i++) {
      if (rate >= ranks[i].min && rate < ranks[i].max) return ranks[i]
    }
    if (rate >= 100) return ranks[ranks.length - 1]
    return null
  },

  calcWealthAge: function (rate) {
    var anchors = this.data.ageAnchors
    if (rate <= anchors[0][0]) return anchors[0][1]
    if (rate >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1]
    for (var i = 0; i < anchors.length - 1; i++) {
      var r1 = anchors[i][0], a1 = anchors[i][1]
      var r2 = anchors[i + 1][0], a2 = anchors[i + 1][1]
      if (rate >= r1 && rate < r2) {
        return Math.round(a1 + (rate - r1) / (r2 - r1) * (a2 - a1))
      }
    }
    return 25
  },

  ageComment: function (age) {
    if (age <= 25) return '还在成长，加油攒钱吧 💪'
    if (age <= 30) return '渐入佳境，已经开始觉醒了 🌱'
    if (age <= 35) return '稳步成熟，财务自律在线 ⭐'
    if (age <= 45) return '老司机了，财务管理有一套 🏆'
    return '存钱天花板，退休思维已上线 👴'
  },

  calcCompare: function (amount) {
    amount = Math.max(0, amount)
    var table = this.data.compareTable
    for (var i = 0; i < table.length; i++) {
      if (amount >= table[i].min && amount <= table[i].max) return table[i].icon + ' ' + table[i].desc
    }
    return table[table.length - 1].icon + ' ' + table[table.length - 1].desc
  },

  goExpense: function () { wx.navigateTo({ url: '/pages/index/index' }) },

  reset: function () {
    this.setData({
      income: '', expense: '', goalAmount: '', goalYearIdx: 4,
      monthSaving: 0, savingRate: 0,
      incomeStr: '0', expenseStr: '0', savingStr: '0', savingRateStr: '0%',
      goalIncomeStr: '0', rank: null, showResult: false,
      wealthAge: 0, wealthAgeComment: '',
      yearlySaved: '0', yearlyCompare: '',
      share: { ready: false, title: '', path: '/pages/saving/saving' }
    })
  },

  // ---- 保存结果到相册 ----
  saveResult: function () {
    var that = this
    if (this.data.isSaving) return
    if (!this.data.showResult) {
      wx.showToast({ title: '请先计算', icon: 'none' })
      return
    }
    this.setData({ isSaving: true })
    var d = this.data

    // 写入历史
    if (d.mode === 'forward') {
      history.add('saving', '存钱段位', '🐷',
        { income: d.income, expense: d.expense },
        '储蓄率 ' + d.savingRateStr + ' | ' + (d.rank ? d.rank.name + '段位' : '未定') + ' | 财富年龄' + d.wealthAge + '岁')
    } else {
      history.add('saving', '存钱段位(倒推)', '🐷',
        { goalAmount: d.goalAmount, goalYears: d.goalYearIdx + 1, expense: d.expense },
        '倒推 | 月需存 ¥' + d.savingStr + ' | ' + (d.rank ? d.rank.name + '段位' : '未定'))
    }

    this.saveImage({
      title: '存钱段位报告',
      theme: ['#f093fb', '#f5576c'],
      H: 670,
      slogan: '存钱，也要段位',
      footer: '本测试仅供娱乐',
      hook: '我的存钱段位是「' + (d.rank ? d.rank.name : '?') + '」，财富年龄 ' + d.wealthAge + ' 岁，你呢？',
      draw: function (canvas, ctx, W, H, data) {
        ctx.fillStyle = '#666'
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'center'
        if (data.mode === 'forward') {
          ctx.fillText('月收入 ¥' + data.incomeStr + '   月支出 ¥' + data.expenseStr, W / 2, 105)
        } else {
          ctx.fillText(data.goalYearOptions[data.goalYearIdx] + '目标 ¥' + format.formatMoney(Math.round(parseFloat(data.goalAmount) || 0)) + '   月支出 ¥' + data.expenseStr, W / 2, 105)
        }

        if (data.rank) {
          report.drawBadge(ctx, {
            x: W / 2 - 60, y: 120, w: 120, h: 36, r: 18,
            bg: data.rank.color, text: data.rank.emoji + ' ' + data.rank.name + '段位', fontSize: 16
          })
        }

        ctx.fillStyle = '#333'
        ctx.font = '14px sans-serif'
        ctx.fillText(data.mode === 'forward' ? '每月储蓄率' : '每月需存', W / 2, 185)
        ctx.fillStyle = data.rank ? data.rank.color : '#333'
        ctx.font = 'bold 28px sans-serif'
        ctx.fillText(data.mode === 'forward' ? data.savingRateStr : '¥' + data.savingStr, W / 2, 218)

        ctx.fillStyle = '#666'
        ctx.font = '13px sans-serif'
        ctx.fillText('每月存下 ¥' + data.savingStr, W / 2, 245)
        report.drawDivider(ctx, 30, 260, W - 30)

        ctx.fillStyle = '#666'
        ctx.font = '13px sans-serif'
        ctx.fillText('你的存钱习惯相当于', W / 2, 285)
        ctx.fillStyle = '#e74c3c'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(data.wealthAge + ' 岁', W / 2, 312)

        if (data.yearlyCompare) {
          ctx.fillStyle = '#888'
          ctx.font = '12px sans-serif'
          ctx.fillText('一年存下的钱 ' + data.yearlyCompare, W / 2, 340)
        }

        ctx.fillStyle = '#666'
        ctx.font = '13px sans-serif'
        ctx.fillText('照此速度，一年后多存 ¥' + data.yearlySaved, W / 2, 365)

        ctx.fillStyle = '#bbb'
        ctx.font = '10px sans-serif'
        ctx.fillText('本测试结果仅供娱乐，不代表用户真实水平', W / 2, 395)
      }
    })
  },

  restoreHistory: function (record) {
    var inp = record.input
    if (inp.income !== undefined) {
      // 正向模式
      this.setData({ mode: 'forward', income: inp.income || '', expense: inp.expense || '' })
      this.forwardCalc()
    } else if (inp.goalAmount !== undefined) {
      // 倒推模式
      this.setData({ mode: 'reverse', goalAmount: inp.goalAmount || '', expense: inp.expense || '' })
      if (inp.goalYears) { this.setData({ goalYearIdx: inp.goalYears - 1 }) }
      this.reverseCalc()
    }
  }
})
