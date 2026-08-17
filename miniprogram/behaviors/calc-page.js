// behaviors/calc-page.js - 工具页通用行为（暗色 / 历史 / 返回 / 分享 / 输入 / 公共保存脚手架）
// 各页面如需历史恢复：实现 restoreHistory(record) 方法，从 record.input 还原字段。
// 各页面如需自定义 onInput：在自身 methods 定义同名方法即可 shadow 掉此版本。
var report = require('../utils/report.js')
var history = require('../utils/history.js')

// 输入防抖延迟（毫秒）。防抖后再触发 calculate，避免每次按键做全量计算。
var INPUT_DEBOUNCE_MS = 250

module.exports = Behavior({
  data: {
    isDark: false
  },

  lifetimes: {
    attached: function () {
      var app = getApp()
      if (app && app.globalData) {
        this.setData({ isDark: app.globalData.theme === 'dark' })
        report.setTheme(app.globalData.theme)
      }
    }
  },

  pageLifetimes: {
    show: function () {
      var app = getApp()
      if (app && app.globalData) {
        this.setData({ isDark: app.globalData.theme === 'dark' })
        report.setTheme(app.globalData.theme)

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
    // 通用输入事件（calc-input 组件绑定）。
    // - 有 showResult 的页自动清结果
    // - 有 calculate 的页自动触发重算（防抖 250ms，避免每次按键做全量计算）
    // 需要自定义逻辑的页可在 methods 里定义同名方法覆盖。
    onInput: function (e) {
      var update = {}
      update[e.detail.field] = e.detail.value
      if (this.data.showResult !== undefined) {
        update.showResult = false
      }
      this.setData(update)
      if (this.calculate) {
        var that = this
        if (this._calcTimer) clearTimeout(this._calcTimer)
        this._calcTimer = setTimeout(function () {
          that.calculate()
          that._calcTimer = null
        }, INPUT_DEBOUNCE_MS)
      }
    },

    // ---- 模板方法：统一 saveResult 脚手架 ----
    // 各页 saveResult 内部调用 this.saveResultTemplate(opts)，
    // 仅需提供 draw / summary / guard 等页面定制字段，
    // 其余 isSaving 守卫 / 历史写入 / saveImage 统一处理。
    //
    // opts 字段：
    //   toolId, toolName, icon —— 历史记录
    //   input  —— 历史记录的 input 对象（undefined 则跳过写历史）
    //   summary —— 历史记录摘要
    //   title, theme, slogan, footer, hook —— 海报品牌条
    //   H       —— 海报高度（默认 610）
    //   W       —— 海报宽度（默认 300，新加，可选）
    //   guard(d) —— 返回 false 时弹出 noResultHint 并 abort（用于「未输入就保存」拦截）
    //   noResultHint —— guard 不过时的 toast 提示
    //   draw(canvas, ctx, W, H, data) —— 页面自定义绘图（5参）
    // 注：input / summary 可传「函数」，guard 通过后才求值（懒计算），
    //     避免无结果时摘要表达式因空字段（如 d.cat）抛错。
    saveResultTemplate: function (opts) {
      var that = this
      if (this.data.isSaving) return

      var d = this.data
      // guard 检查：未达到可保存状态时，toast + 复位 isSaving
      if (opts.guard && !opts.guard(d)) {
        wx.showToast({ title: opts.noResultHint || '请先输入', icon: 'none' })
        this.setData({ isSaving: false })
        return
      }

      this.setData({ isSaving: true })

      // 写入历史（input 为 undefined 时跳过；函数则懒求值）
      var input = typeof opts.input === 'function' ? opts.input(d) : opts.input
      var summary = typeof opts.summary === 'function' ? opts.summary(d) : opts.summary
      if (input) {
        history.add(opts.toolId, opts.toolName, opts.icon, input, summary)
      }

      this.saveImage({
        title: opts.title,
        theme: opts.theme,
        slogan: opts.slogan,
        footer: opts.footer,
        hook: opts.hook,
        H: opts.H,
        W: opts.W,
        draw: opts.draw
      })
    },

    // 公共保存脚手架：各页 saveResult 内调 this.saveImage(opts)。
    // opts: { title, theme, slogan, hook, footer, H, W, draw(canvas,ctx,W,H,data) }
    // draw 可返回 Promise（用于异步加载图片，如塔罗卡面），也可同步返回。
    // 省去 createSelectorQuery + drawHeader + drawBrandStrip + drawFooter + exportAndSave 重复。
    saveImage: function (opts) {
      var that = this
      var H = opts.H || report.DEFAULT_H
      var W = opts.W || report.DEFAULT_W
      var query = wx.createSelectorQuery()
      query.select('#saveCanvas').fields({ node: true, size: true }).exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' })
          that.setData({ isSaving: false })
          return
        }
        var canvas = res[0].node
        var head = report.drawHeader(canvas, opts.title, null, opts.theme, { W: W, H: H })
        var ctx = head.ctx

        var finished = false
        var afterDraw = function () {
          if (finished) return
          finished = true
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
            var r
            try {
              r = opts.draw(canvas, ctx, W, H, that.data)
            } catch (e) {
              // 同步 draw 抛错：恢复按钮状态，避免 isSaving 永久卡 true
              console.error('[saveImage] draw 异常：', e)
              if (!finished) {
                finished = true
                wx.showToast({ title: '保存失败，请重试', icon: 'none' })
                that.setData({ isSaving: false })
              }
              return
            }
            if (r && typeof r.then === 'function') {
              // 异步 draw（如塔罗异步加载卡面）：失败只重置+提示，不重复 afterDraw/导出
              r.then(afterDraw).catch(function (e) {
                console.error('[saveImage] 异步 draw 失败：', e)
                if (!finished) {
                  finished = true
                  wx.showToast({ title: '保存失败，请重试', icon: 'none' })
                  that.setData({ isSaving: false })
                }
              })
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
          // 兜底：任何未预期异常都恢复按钮状态，避免 isSaving 永久卡 true 导致按钮变灰无反应
          console.error('[saveImage] 未预期异常：', e)
          if (!finished) {
            finished = true
            wx.showToast({ title: '保存失败，请重试', icon: 'none' })
            that.setData({ isSaving: false })
          }
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
