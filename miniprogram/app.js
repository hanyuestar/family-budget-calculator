// app.js - 小程序入口（含主题管理、广告管理）
var report = require('./utils/report.js')

App({
  onLaunch() {
    // 主题初始化
    var theme = wx.getStorageSync('app_theme') || 'light'
    this.globalData.theme = theme
    report.setTheme(theme)

    // 插屏广告
    if (wx.createInterstitialAd) {
      this.globalData.interstitialAd = wx.createInterstitialAd({
        adUnitId: 'adunit-xxxxxxxxxxxxxxxx'
      })
      this.globalData.interstitialAd.onLoad(function () {
        console.log('插屏广告加载成功')
      })
      this.globalData.interstitialAd.onError(function (err) {
        console.log('插屏广告加载失败', err)
      })
    }
  },

  globalData: {
    theme: 'light',
    interstitialAd: null,
    lastInterstitialTime: 0
  },

  /* ---- 主题 ---- */
  toggleTheme: function () {
    var current = this.globalData.theme
    var next = current === 'dark' ? 'light' : 'dark'
    this.globalData.theme = next
    wx.setStorageSync('app_theme', next)
    // 同步 report.js 的主题缓存，避免出图用旧主题色
    report.setTheme(next)

    // 广播给所有页面（通过 eventChannel + 页面 onShow 读取 globalData 也行，
    // 但最简单的是让当前活跃页面直接 setData）
    var pages = getCurrentPages()
    for (var i = 0; i < pages.length; i++) {
      var page = pages[i]
      if (page.setData) {
        page.setData({ isDark: next === 'dark' })
      }
    }
    return next
  },

  /* ---- 插屏广告 ---- */
  canShowInterstitial: function () {
    var now = Date.now()
    if (now - this.globalData.lastInterstitialTime < 5 * 60 * 1000) return false
    this.globalData.lastInterstitialTime = now
    return true
  },

  showInterstitial: function (callback) {
    var ad = this.globalData.interstitialAd
    if (!ad || !this.canShowInterstitial()) {
      if (callback) callback()
      return
    }

    var called = false
    var done = function () {
      if (!called) {
        called = true
        ad.offClose(done)
        if (callback) callback()
      }
    }

    // 注册前先解绑同名回调，避免异常路径下叠加多个 onClose 侦听
    ad.offClose(done)
    ad.onClose(done)
    ad.show().catch(function () {
      ad.offClose(done)
      done()
    })
  }
})
