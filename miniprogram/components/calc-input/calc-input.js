// components/calc-input/calc-input.js - 通用输入行组件
Component({
  properties: {
    label: { type: String, value: '' },     // 输入框上方标签
    symbol: { type: String, value: '' },     // 前缀符号，如 ¥（与 unit 二选一）
    unit: { type: String, value: '' },       // 后缀单位，如 万元（与 symbol 二选一）
    desc: { type: String, value: '' },       // 输入说明小字
    field: { type: String, value: '' },      // 字段名，透传给父页面
    value: { type: String, value: '' },      // 当前值（双向绑定，便于重置清空）
    type: { type: String, value: 'digit' }, // input type
    placeholder: { type: String, value: '0' },
    min: { type: Number, value: null },
    max: { type: Number, value: null },
    integer: { type: Boolean, value: false }
  },
  methods: {
    onInput: function (e) {
      var cleaned = this.sanitize(e.detail.value)
      this.triggerEvent('input', { field: this.data.field, value: cleaned })
    },
    sanitize: function (v) {
      if (this.data.integer) {
        v = v.replace(/[^\d]/g, '')
      } else {
        v = v.replace(/[^\d.]/g, '')
        var i = v.indexOf('.')
        if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '')
      }
      if (v === '' || v === '.') return v
      if (v.charAt(v.length - 1) === '.') return v
      var n = parseFloat(v)
      if (isNaN(n)) return ''
      var min = this.data.min, max = this.data.max
      if (min !== null && !isNaN(min) && n < min) n = min
      if (max !== null && !isNaN(max) && n > max) n = max
      return String(n)
    }
  }
})
