// behaviors/calc-page.js - 工具页通用行为（暗色 / 历史 / 返回 / 分享 / 输入 / 公共保存脚手架）
// 各页面如需历史恢复：实现 restoreHistory(record) 方法，从 record.input 还原字段。
// 各页面如需自定义 onInput：在自身 methods 定义同名方法即可 shadow 掉此版本。
var report = require('../utils/report.js')

module.exports = Behavior({
  data: {
    isDark: false
  },

  lifetimes: {
    attached: function () {
      var app = getApp()
      if (app && app.globalData) {
        this.setData({ isDark: app.globalData.theme === 'dark' })
      }
    }
  },

  pageLifetimes: {
    show: function () {
      var app = getApp()
      if (app && app.globalData) {
        this.setData({ isDark: app.globalData.theme === 'dark' })

        // 历史恢复：globalData._historyRestore 由历史页跳转时写入
        var record = app.globalData._historyRestore
        if (record && this.restoreHistory) {
          this.restoreHistory(record)
          app.globalData._historyRestore = null
        }
      }
    }
  },

  methods: {
    // 通用输入事件（calc-input 组件绑定）。有 showResult 的页自动清结果；
    // 有 calculate 的页自动触发重算。需要自定义逻辑的页可在 methods 里定义同名方法覆盖。
    onInput: function (e) {
      var update = {}
      update[e.detail.field] = e.detail.value
      if (this.data.showResult !== undefined) {
        update.showResult = false
      }
      this.setData(update)
      if (this.calculate) this.calculate()
    },

    // 公共保存脚手架：各页 saveResult 内调 this.saveImage(opts)。
    // opts: { title, theme, slogan, hook, footer, H, draw(canvas,ctx,W,H,data) }
    // draw 可返回 Promise（用于异步加载图片，如塔罗卡面），也可同步返回。
    // 省去 createSelectorQuery + drawHeader + drawBrandStrip + drawFooter + exportAndSave 重复。
    saveImage: function (opts) {
      var that = this
      var H = opts.H || 610
      var query = wx.createSelectorQuery()
      query.select('#saveCanvas').fields({ node: true, size: true }).exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' })
          that.setData({ isSaving: false })
          return
        }
        var canvas = res[0].node
        var head = report.drawHeader(canvas, opts.title, null, opts.theme, { W: 300, H: H })
        var ctx = head.ctx, W = head.W

        var afterDraw = function () {
          report.drawBrandStrip(ctx, {
            W: W, bottomY: head.H, theme: opts.theme,
            slogan: opts.slogan || '',
            hook: opts.hook || '',
            qrCode: { path: report.QR_PATH, label: report.QR_LABEL }
          })
          report.drawFooter(ctx, opts.footer || '', head.H)
          report.exportAndSave(canvas, ctx, {
            onSaved: function () { that.setData({ isSaving: false }) },
            onFail: function () { that.setData({ isSaving: false }) }
          })
        }

        var runDraw = function () {
          if (opts.draw) {
            var r = opts.draw(canvas, ctx, W, H, that.data)
            if (r && typeof r.then === 'function') {
              r.then(afterDraw).catch(function () { afterDraw() })
            } else {
              afterDraw()
            }
          } else {
            afterDraw()
          }
        }
        try {
          runDraw()
        } catch (e) {
          // draw 抛错兜底：恢复按钮状态并提示，避免 isSaving 永久卡 true 导致按钮变灰无反应
          console.error('[saveImage] draw 异常：', e)
          wx.showToast({ title: '保存失败，请重试', icon: 'none' })
          that.setData({ isSaving: false })
        }
      })
    },

    goHome: function () {
      var pages = getCurrentPages()
      var app = getApp()
      app.showInterstitial(function () {
        if (pages.length > 1) {
          wx.navigateBack()
        } else {
          wx.redirectTo({ url: '/pages/home/home' })
        }
      })
    },

    onShareAppMessage: function () {
      var d = this.data
      if (!d.share || !d.share.ready) {
        return {
          title: d.shareFallbackTitle || '聚合计算',
          path: '/pages/home/home'
        }
      }
      return {
        title: d.share.title,
        path: d.share.path || '/pages/home/home',
        imageUrl: ''
      }
    }
  }
})
