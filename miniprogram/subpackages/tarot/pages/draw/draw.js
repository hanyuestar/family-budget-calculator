// subpackages/tarot/pages/draw/draw.js - 抽牌 / 结果
var cards = require('../../data/cards.js')
var report = require('../../../../utils/report.js')
var history = require('../../../../utils/history.js')
var calcPage = require('../../../../behaviors/calc-page.js')

// 中文友好的按宽换行（逐字测量），超 maxLines 行截断加省略号
function wrapCjk(ctx, text, maxWidth, maxLines) {
  var lines = []
  var line = ''
  for (var i = 0; i < text.length; i++) {
    var ch = text[i]
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      if (lines.length === maxLines - 1) {
        var rest = line + text.slice(i)
        while (rest.length > 1 && ctx.measureText(rest + '…').width > maxWidth) {
          rest = rest.slice(0, -1)
        }
        lines.push(rest + '…')
        return lines
      }
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

Page({
  behaviors: [calcPage],

  data: {
    isDark: false,
    spreadId: 'daily',
    spreadName: '每日一牌',
    positions: ['今日'],
    deck: [],          // 抽到的牌（含 position）
    drawing: false,    // 洗牌中
    revealed: false,   // 已开牌
    isSaving: false,
    share: { ready: false, title: '', path: '/subpackages/tarot/pages/draw/draw' }
  },

  onLoad: function (options) {
    var app = getApp()
    var sid = options.spread || 'daily'
    var sp = cards.SPREADS[sid] || cards.SPREADS.daily
    this.setData({
      isDark: app.globalData.theme === 'dark',
      spreadId: sp.id,
      spreadName: sp.name,
      positions: sp.positions
    })
    // 进页面自动抽一次
    this.doDraw()
  },

  onShow: function () {
    var app = getApp()
    this.setData({ isDark: app.globalData.theme === 'dark' })
  },

  // 抽牌：先进入洗牌态，模拟短暂洗牌后再开牌
  doDraw: function () {
    var that = this
    if (this.data.drawing) return
    this.setData({ drawing: true, revealed: false, deck: [] })
    // 洗牌动画 1200ms，与牌堆动画节奏同步
    setTimeout(function () {
      var picked = cards.drawCards(that.data.positions.length)
      var deck = picked.map(function (c, i) {
        return {
          idx: c.idx, slug: c.slug, cn: c.cn, en: c.en, img: c.img,
          reversed: c.reversed, orientation: c.orientation,
          kw: c.kw, text: c.text, today: c.today,
          position: that.data.positions[i]
        }
      })
      that.setData({ deck: deck, drawing: false, revealed: true })
      that._updateShare(deck)
      that._saveHistory(deck)
    }, 900)
  },

  _updateShare: function (deck) {
    var first = deck[0]
    var title = this.data.spreadName + '：' + first.cn + (first.reversed ? '（逆位）' : '（正位）')
    this.setData({
      share: {
        ready: true,
        title: title,
        path: '/subpackages/tarot/pages/draw/draw?spread=' + this.data.spreadId
      }
    })
  },

  _saveHistory: function (deck) {
    var summary = deck.map(function (c) {
      return c.cn + (c.reversed ? '逆' : '正')
    }).join(' / ')
    history.add('tarot', '国潮塔罗', '🔮', { spread: this.data.spreadId }, summary)
  },

  // 保存出图（含卡面图 + 文案，复用通用出图链路，draw 异步加载卡面）
  saveResult: function () {
    var that = this
    if (this.data.isSaving) return
    if (!this.data.revealed) { wx.showToast({ title: '请先抽牌', icon: 'none' }); return }
    this.setData({ isSaving: true })

    var deck = this.data.deck
    var count = deck.length
    var UNIT = 200                      // 每张牌在图中的竖向占位
    var TOP = 110                       // 内容区起始 y（banner 高80 + 留白30，避开首位标签重叠）
    var H = 305 + count * UNIT + (TOP - 96)   // 顶栏80 + 内容 + 品牌条/footer 预留 + 内容上移补偿

    this.saveImage({
      title: this.data.spreadName + ' · 国潮塔罗',
      theme: ['#5b3a89', '#3a2b5f'],
      slogan: '聚合计算 · 国潮塔罗',
      footer: '本结果为娱乐测试，仅供参考，不构成任何建议',
      hook: '我在「聚合计算」抽了张塔罗牌，来试试你的',
      H: H,
      draw: function (canvas, ctx, W, H, data) {
        var deck = data.deck
        // 预加载所有卡面图（分包 jpg，Canvas 2.0 异步）
        var jobs = deck.map(function (c) {
          return new Promise(function (resolve) {
            var im = canvas.createImage()
            im.onload = function () { resolve(im) }
            im.onerror = function () { resolve(null) }
            im.src = c.img
          })
        })
        return Promise.all(jobs).then(function (images) {
          var y = TOP
          var IMG = 96
          for (var i = 0; i < deck.length; i++) {
            var c = deck[i]
            var im = images[i]
            var cx = (W - IMG) / 2

            // 卡面图（逆位旋转 180°）
            if (im) {
              if (c.reversed) {
                ctx.save()
                ctx.translate(cx + IMG / 2, y + IMG / 2)
                ctx.rotate(Math.PI)
                ctx.drawImage(im, -IMG / 2, -IMG / 2, IMG, IMG)
                ctx.restore()
              } else {
                ctx.drawImage(im, cx, y, IMG, IMG)
              }
            } else {
              ctx.fillStyle = '#e7def5'
              ctx.fillRect(cx, y, IMG, IMG)
            }

            // 位置标签
            ctx.textAlign = 'center'
            ctx.fillStyle = '#8e44ad'
            ctx.font = 'bold 14px sans-serif'
            ctx.fillText(c.position, W / 2, y - 8)

            // 牌名 + 正逆位
            ctx.fillStyle = '#333333'
            ctx.font = 'bold 18px sans-serif'
            ctx.fillText(c.cn + (c.reversed ? '（逆位）' : '（正位）'), W / 2, y + IMG + 22)

            // 关键词
            ctx.fillStyle = '#999999'
            ctx.font = '12px sans-serif'
            ctx.fillText('关键词：' + c.kw.join(' · '), W / 2, y + IMG + 42)

            // 解读（最多 3 行）
            ctx.fillStyle = '#666666'
            ctx.font = '12px sans-serif'
            var lines = wrapCjk(ctx, c.text, W - 48, 3)
            var ty = y + IMG + 64
            for (var li = 0; li < lines.length; li++) {
              ctx.fillText(lines[li], W / 2, ty + li * 16)
            }

            y += UNIT
          }
        })
      }
    })
  },

  // 再抽一次
  redraw: function () {
    this.doDraw()
  },

  onShareAppMessage: function () {
    var d = this.data
    if (!d.share || !d.share.ready) {
      return { title: '聚合计算 · 国潮塔罗', path: '/subpackages/tarot/pages/index/index' }
    }
    return { title: d.share.title, path: d.share.path, imageUrl: '' }
  }
})
