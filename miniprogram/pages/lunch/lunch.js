// pages/lunch/lunch.js - 中午吃什么（老道士算卦·今日吃什么）
var lunch = require('../../utils/lunch.js')
var calcPage = require('../../behaviors/calc-page.js')

var LOADING_TEXTS = [
  '天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。',
  '掐指一算——施主今日五行有缺，需以食补之。',
  '八卦转动，五行相生。且看贫道为你推演今日之食。',
  '急急如律令——卦象将现，施主且看！'
]

Page({
  behaviors: [calcPage],

  data: {
    screen: 'welcome',     // welcome | loading | result | denied | norest
    isDark: false,
    loadingText: LOADING_TEXTS[0],
    gua: null,
    rest: null,
    huangli: null,
    isSaving: false,
    share: { ready: true, title: '今日吃什么？让老道士为你算一卦', path: '/pages/lunch/lunch' }
  },

  onLoad: function (options) {
    // 调试直传坐标（对应桌面版 ?lat=&lng=，免去真机定位授权），如 pages/lunch/lunch?lat=22.5431&lng=114.0579
    var lat = options && options.lat ? parseFloat(options.lat) : null
    var lng = options && options.lng ? parseFloat(options.lng) : null
    this._debugLoc = (lat != null && lng != null) ? { lat: lat, lng: lng } : null
  },

  // 迎宾 → 算卦
  startFortune: function () {
    var that = this
    this.setData({ screen: 'loading', loadingText: LOADING_TEXTS[0] })
    if (this._debugLoc) {
      this._loc = this._debugLoc
      setTimeout(function () { that.doFortune() }, 700)
      return
    }
    this._authorizeLocation()
  },

  // 隐私授权（新版微信真机强校验：未通过隐私授权会拦截地理位置接口；开发工具不校验故表现正常）
  _authorizeLocation: function () {
    var that = this
    var proceed = function () { that._ensureLocationPermission() }
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: function (res) {
          if (res && res.needAuthorization && wx.requirePrivacyAuthorize) {
            wx.requirePrivacyAuthorize({ success: proceed, fail: proceed })
          } else { proceed() }
        },
        fail: proceed
      })
    } else if (wx.requirePrivacyAuthorize) {
      wx.requirePrivacyAuthorize({ success: proceed, fail: proceed })
    } else { proceed() }
  },

  // 检查模糊地理位置授权状态：已拒绝则引导去设置页重新授权，否则直接取定位
  _ensureLocationPermission: function () {
    var that = this
    if (wx.getSetting) {
      wx.getSetting({
        success: function (res) {
          var auth = res.authSetting && res.authSetting['scope.userFuzzyLocation']
          if (auth === false) {
            wx.showModal({
              title: '需要定位权限',
              content: '请在设置中开启「模糊位置」权限，贫道方能感知你的方位',
              confirmText: '去设置', cancelText: '返回',
              success: function (m) {
                if (m.confirm) {
                  wx.openSetting({
                    success: function () { that._doGetLocation() },
                    fail: function () { that.setData({ screen: 'denied' }) }
                  })
                } else { that.setData({ screen: 'denied' }) }
              }
            })
          } else { that._doGetLocation() }
        },
        fail: function () { that._doGetLocation() }
      })
    } else { that._doGetLocation() }
  },

  _doGetLocation: function () {
    var that = this
    // getLocation（精确位置）受服务类目限制无法开通，改用 getFuzzyLocation（模糊位置，免类目审核、自动通过）。
    // 返回 wgs84，与 utils/lunch.js 的 wgs2bd 转换链完全兼容，逻辑层无需改动。
    wx.getFuzzyLocation({
      type: 'wgs84',
      success: function (res) {
        that._loc = { lat: res.latitude, lng: res.longitude }
        that.doFortune()
      },
      fail: function (err) {
        var msg = (err && err.errMsg) || ''
        // auth/deny/privacy 类错误 → 方位之术被拒；其余（系统定位关闭等）提示后进入 denied
        if (/auth|deny|permission|privacy/i.test(msg)) {
          that.setData({ screen: 'denied' })
        } else {
          wx.showToast({ title: '定位失败，请确认已开启系统定位', icon: 'none' })
          that.setData({ screen: 'denied' })
        }
      }
    })
  },

  doFortune: function () {
    var that = this
    var ti = 0
    this.setData({ loadingText: LOADING_TEXTS[0] })
    var iv = setInterval(function () {
      ti++
      if (ti < LOADING_TEXTS.length) that.setData({ loadingText: LOADING_TEXTS[ti] })
      else clearInterval(iv)
    }, 1800)
    setTimeout(function () {
      clearInterval(iv)
      if (!that._loc) { that.setData({ screen: 'denied' }); return }
      lunch.fortune(that._loc).then(function (r) {
        if (r.noRest) {
          that.setData({ screen: 'norest', gua: r.gua })
          return
        }
        that.setData({ screen: 'result', gua: r.gua, rest: r.rest, huangli: r.huangli })
      }).catch(function () {
        that.setData({ screen: 'norest' })
      })
    }, 2200)
  },

  refortune: function () {
    if (this._loc) this.startFortune()
    else this.setData({ screen: 'welcome' })
  },

  confirmChoice: function () {
    wx.showToast({ title: '就选这家！', icon: 'none' })
  },

  goWelcome: function () {
    this.setData({ screen: 'welcome', gua: null, rest: null, huangli: null })
  },

  saveResult: function () {
    var d = this.data
    if (!d.gua) { wx.showToast({ title: '请先算一卦', icon: 'none' }); return }
    var summary = d.gua.name + (d.rest ? (' → ' + d.rest.name) : '（附近无匹配食肆）')
    this.saveResultTemplate({
      toolId: 'lunch', toolName: '中午吃什么', icon: '🍜',
      input: undefined, // 算卦无输入可还原，仅出海报
      summary: summary,
      title: '今日吃什么',
      theme: ['#7a1818', '#a02828'],
      slogan: '老道士算卦 · 信则灵',
      footer: '结合黄历与卦象推荐，仅供娱乐参考',
      hook: d.gua.name + (d.rest ? ('，贫道为你寻得「' + d.rest.name + '」') : '，附近暂无合卦餐厅'),
      draw: function (canvas, ctx, W, H, data) {
        var y = 120
        ctx.fillStyle = '#2a1f14'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('卦 象 已 现', W / 2, y); y += 46
        if (data.gua) {
          ctx.fillStyle = '#a02828'; ctx.font = '54px sans-serif'; ctx.textAlign = 'center'
          ctx.fillText(data.gua.symbol, W / 2, y + 24); y += 64
          ctx.fillStyle = '#2a1f14'; ctx.font = '22px sans-serif'
          ctx.fillText(data.gua.name, W / 2, y); y += 28
          ctx.fillStyle = '#6a5a45'; ctx.font = '13px sans-serif'
          ctx.fillText('五行属' + data.gua.wuxing + ' · 利' + data.gua.direction + '方', W / 2, y); y += 30
          ctx.fillStyle = '#7a1818'; ctx.font = '14px sans-serif'
          wrapText(ctx, '「' + data.gua.qianwen + '」', W / 2, y, W - 56, 20); y += 46
          ctx.fillStyle = '#4a6a4a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'
          wrapText(ctx, data.gua.foodHint, 30, y, W - 60, 20); y += 40
        }
        if (data.rest) {
          ctx.fillStyle = '#2a1f14'; ctx.font = '15px sans-serif'; ctx.textAlign = 'left'
          ctx.fillText('贫道为你寻得——', 30, y); y += 26
          ctx.fillStyle = '#2a1f14'; ctx.font = '20px sans-serif'
          ctx.fillText(data.rest.name, 30, y); y += 28
          ctx.fillStyle = '#4a6a4a'; ctx.font = '13px sans-serif'
          ctx.fillText(data.rest.grpLabel + ' · 人均约¥' + data.rest.price + ' · ' + data.rest.distText, 30, y)
        } else {
          ctx.fillStyle = '#8a7a65'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'
          ctx.fillText('（附近暂无与卦象相合之食肆，换个方位再算）', 30, y)
        }
      }
    })
  }
})

// 居中自动换行（Canvas 2.0 无原生 wrapText）
function wrapText(ctx, text, x, y, maxWidth, lh) {
  var chars = (text || '').split('')
  var line = ''
  for (var i = 0; i < chars.length; i++) {
    var test = line + chars[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y); line = chars[i]; y += lh
    } else { line = test }
  }
  if (line) ctx.fillText(line, x, y)
}
