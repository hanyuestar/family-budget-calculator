// utils/report.js - 通用结果报告生成（Canvas 2.0 + 品牌条 + DPR高清）
// Canvas 2.0：page 用 createSelectorQuery 取节点 → canvas.width/height = 逻辑×dpr → ctx.scale(dpr,dpr)

function getToday() {
  var now = new Date()
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0')
}

function isDark() {
  var app = getApp()
  return app && app.globalData && app.globalData.theme === 'dark'
}

function fill(key) {
  var dark = isDark()
  var map = {
    bg: dark ? '#222240' : '#ffffff',
    text: dark ? '#e0e0e0' : '#333333',
    text2: dark ? '#b0b0b0' : '#666666',
    muted: dark ? '#555555' : '#bbbbbb',
    divider: dark ? '#3a3a5a' : '#eeeeee'
  }
  return map[key] || (dark ? '#e0e0e0' : '#333333')
}

/**
 * 品牌传播条 —— 统一画在 canvas 底部
 * opts: { W, bottomY, theme, slogan, hook, qrCode }
 */
/**
 * wrapText(ctx, text, maxWidth, maxLines)  → string[]
 * 按宽度自动换行，超 maxLines 行截断加 "…"
 */
function wrapText(ctx, text, maxWidth, maxLines) {
  maxLines = maxLines || 2
  var words = '' + text
  var lines = []
  while (words.length && lines.length < maxLines) {
    var i = words.length
    while (i > 0) {
      var sub = words.substring(0, i)
      if (lines.length === maxLines - 1 && i < words.length) sub += '…'
      var m = ctx.measureText(sub).width
      if (m <= maxWidth) { lines.push(sub); break }
      i--
    }
    words = words.substring(i)
  }
  return lines.length ? lines : [text]
}

function drawBrandStrip(ctx, opts) {
  var W = opts.W || 300
  var theme = opts.theme || ['#667eea', '#764ba2']
  var bottomY = opts.bottomY || 460
  var slogan = opts.slogan || '更多实用工具等你发现'
  var hook = opts.hook || '扫码体验更多计算工具'
  var qr = opts.qrCode
  var dark = isDark()

  // 分隔线（主题色）
  var lineY = bottomY - 200
  ctx.strokeStyle = theme[0]
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(16, lineY)
  ctx.lineTo(W - 16, lineY)
  ctx.stroke()

  // 品牌卡片
  var cx = 12, cw = W - 24, ch = 122, cy = lineY + 12

  ctx.fillStyle = dark ? '#2e2e50' : '#F4F5F9'
  var cr = 12
  ctx.beginPath()
  ctx.moveTo(cx + cr, cy)
  ctx.lineTo(cx + cw - cr, cy)
  ctx.arc(cx + cw - cr, cy + cr, cr, -Math.PI / 2, 0)
  ctx.lineTo(cx + cw, cy + ch - cr)
  ctx.arc(cx + cw - cr, cy + ch - cr, cr, 0, Math.PI / 2)
  ctx.lineTo(cx + cr, cy + ch)
  ctx.arc(cx + cr, cy + ch - cr, cr, Math.PI / 2, Math.PI)
  ctx.lineTo(cx, cy + cr)
  ctx.arc(cx + cr, cy + cr, cr, Math.PI, -Math.PI / 2)
  ctx.closePath()
  ctx.fill()

  // --- 左侧：logo 圆 + 名称 + slogan + 长按引导 ---
  var lx = cx + 18, ly = cy + 22, lr = 16

  var grad = ctx.createLinearGradient(lx, ly - lr, lx + lr * 2, ly + lr)
  grad.addColorStop(0, theme[0])
  grad.addColorStop(1, theme[1])
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(lx + lr, ly + lr, lr, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('计', lx + lr, ly + lr + 5)

  var textX = lx + lr * 2 + 10
  ctx.textAlign = 'left'
  ctx.fillStyle = dark ? '#e0e0e0' : '#333333'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText('聚合计算', textX, ly + lr + 4)

  // --- 右侧：小程序码坐标先算出来，供 slogan 截断用 ---
  var qrSize = 96
  var qrX = cx + cw - 14 - qrSize, qrY = cy + 12, qrPad = 4

  // slogan 加宽度截断，避免撑到右侧小程序码区域
  ctx.fillStyle = dark ? '#888888' : '#999999'
  ctx.font = '11px sans-serif'
  var sloganMaxW = qrX - textX - 16  // 给码区域留 16px 安全间距
  var sloganText = slogan
  while (sloganText.length > 1 && ctx.measureText(sloganText).width > sloganMaxW) {
    sloganText = sloganText.substring(0, sloganText.length - 1)
  }
  if (sloganText.length < slogan.length) sloganText += '…'
  ctx.fillText(sloganText, textX, ly + lr + 22)

  // "长按识别" 合并到左侧第三行，不再画在码下方（避免跨卡片边缘）
  ctx.fillStyle = dark ? '#777777' : '#aaaaaa'
  ctx.font = '10px sans-serif'
  ctx.fillText('长按识别小程序码 →', textX, ly + lr + 40)

  // --- 右侧：小程序码（白色底框）---
  var boxX = qrX - qrPad, boxY = qrY - qrPad, boxS = qrSize + qrPad * 2, br = 8
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(boxX + br, boxY)
  ctx.lineTo(boxX + boxS - br, boxY)
  ctx.arc(boxX + boxS - br, boxY + br, br, -Math.PI / 2, 0)
  ctx.lineTo(boxX + boxS, boxY + boxS - br)
  ctx.arc(boxX + boxS - br, boxY + boxS - br, br, 0, Math.PI / 2)
  ctx.lineTo(boxX + br, boxY + boxS)
  ctx.arc(boxX + br, boxY + boxS - br, br, Math.PI / 2, Math.PI)
  ctx.lineTo(boxX, boxY + br)
  ctx.arc(boxX + br, boxY + br, br, Math.PI, -Math.PI / 2)
  ctx.closePath()
  ctx.fill()

  // 保存码坐标，exportAndSave 用 canvas.createImage 异步加载
  if (qr && qr.path) {
    ctx._qrInfo = { path: qr.path, x: qrX + qrPad, y: qrY + qrPad, w: qrSize - qrPad * 2, h: qrSize - qrPad * 2 }
  }

  // --- 卡片下方 hook 钩子（长文本自动换行，避免碰到右侧码区域）---
  ctx.fillStyle = dark ? '#b0b0b0' : '#555555'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  var hookMaxWidth = W - 32
  var hookLines = wrapText(ctx, hook, hookMaxWidth, 2)
  var hookBaseY = cy + ch + 16
  for (var hl = 0; hl < hookLines.length; hl++) {
    ctx.fillText(hookLines[hl], W / 2, hookBaseY + hl * 16)
  }
}

/**
 * drawHeader(canvas, title, dateStr, gradient, opts)
 * canvas: Canvas 2.0 节点（createSelectorQuery 取到的 res[0].node）
 * opts: { W, H } 逻辑尺寸
 * 内部设置 canvas.width/height = 逻辑×dpr，并 ctx.scale(dpr,dpr)
 */
// 取设备像素比：优先 getWindowInfo（新基础库），回退 getSystemInfoSync（兼容旧版与测试 mock）
function getDpr() {
  var dpr = 2
  try {
    if (wx.getWindowInfo) {
      var wi = wx.getWindowInfo()
      if (wi && wi.pixelRatio) dpr = wi.pixelRatio
    } else if (wx.getSystemInfoSync) {
      var si = wx.getSystemInfoSync()
      if (si && si.pixelRatio) dpr = si.pixelRatio
    }
  } catch (e) { /* 保留默认 dpr=2 */ }
  return dpr
}

function drawHeader(canvas, title, dateStr, gradient, opts) {
  opts = opts || {}
  var W = opts.W || 300
  var H = opts.H || 610
  var dpr = getDpr()
  canvas.width = W * dpr
  canvas.height = H * dpr
  var ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  ctx.fillStyle = fill('bg')
  ctx.fillRect(0, 0, W, H)

  var grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, gradient ? gradient[0] : '#667eea')
  grad.addColorStop(1, gradient ? gradient[1] : '#764ba2')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, 80)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, W / 2, 38)

  ctx.font = '12px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(dateStr || getToday(), W / 2, 62)

  return { ctx: ctx, W: W, H: H }
}

function drawRow(ctx, o) {
  ctx.fillStyle = o.labelColor || fill('text2')
  ctx.font = (o.labelSize || 14) + 'px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(o.label, 30, o.y)
  ctx.fillStyle = o.valueColor || fill('text')
  ctx.font = 'bold ' + (o.valueSize || 20) + 'px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(o.value, o.valueX || 270, o.y)
}

function drawDivider(ctx, x1, y, x2) {
  ctx.strokeStyle = fill('divider')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

function drawBadge(ctx, o) {
  var x = o.x, y = o.y, w = o.w, h = o.h, r = o.r || 18
  var fz = o.fontSize || 16
  ctx.fillStyle = o.bg
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  ctx.lineTo(x + w, y + h - r)
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  ctx.lineTo(x + r, y + h)
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + r)
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = o.textColor || '#ffffff'
  ctx.font = 'bold ' + fz + 'px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(o.text, x + w / 2, y + h / 2 + fz * 0.35)
}

/**
 * 底部声明
 */
function drawFooter(ctx, text, H) {
  if (!text) return
  ctx.fillStyle = fill('muted')
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(text, 150, (H || 610) - 20)
}

/**
 * 导出 → 存相册。
 * canvas: Canvas 2.0 节点
 * ctx: canvas.getContext('2d') 上下文
 */
function exportAndSave(canvas, ctx, opts) {
  opts = opts || {}
  var qrInfo = ctx._qrInfo

  function doExport() {
    wx.canvasToTempFilePath({
      canvas: canvas,
      // 显式传宽高（canvas 像素坐标，已含 dpr），部分真机缺省会导出空白/失败
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      destWidth: canvas.width,
      destHeight: canvas.height,
      success: function (res) {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: function () {
            wx.showToast({ title: '已保存到相册', icon: 'success' })
            if (opts.onSaved) opts.onSaved()
          },
          fail: function (err) {
            var msg = err && err.errMsg ? err.errMsg : ''
            // 覆盖更多真机文案：auth / deny / permission / cancel / not allow / no perm
            var needAuth = /auth|deny|permission|cancel|not\s*allow|no\s*perm/i.test(msg)
            if (needAuth) {
              wx.showModal({
                title: '需要相册权限',
                content: '保存图片需要相册权限，请在设置中开启',
                confirmText: '去设置',
                success: function (r) { if (r.confirm) wx.openSetting() },
                fail: function () { wx.showToast({ title: '保存失败', icon: 'none' }) }
              })
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' })
            }
            if (opts.onFail) opts.onFail()
          }
        })
      },
      fail: function () {
        wx.showToast({ title: '图片生成失败', icon: 'none' })
        if (opts.onFail) opts.onFail()
      }
    })
  }

  if (qrInfo && qrInfo.path) {
    var img = canvas.createImage()
    img.onload = function () {
      ctx.drawImage(img, qrInfo.x, qrInfo.y, qrInfo.w, qrInfo.h)
      doExport()
    }
    img.onerror = function () {
      // 码加载失败，跳过继续导出
      doExport()
    }
    img.src = qrInfo.path
  } else {
    doExport()
  }
}

module.exports = {
  getToday: getToday,
  getDpr: getDpr,
  drawHeader: drawHeader,
  drawRow: drawRow,
  drawDivider: drawDivider,
  drawBadge: drawBadge,
  drawBrandStrip: drawBrandStrip,
  drawFooter: drawFooter,
  exportAndSave: exportAndSave,
  QR_PATH: '/assets/qrcode.jpg',
  QR_LABEL: '长按识别'
}
