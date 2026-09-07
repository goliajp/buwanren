/** @type {import('tailwindcss').Config} */

/* unmei 运营台 · 设计令牌
 *
 * 【一个主张:缺席要有重量】。这台控制台的活儿是在一万八千笔订单里
 * 认出卡住的那三笔 —— 跟产品本身同源（四十位村民，每人缺一样东西）。
 * 所以健康的数字退成灰的，欠着的、卡着的、不平的才吃墨。
 * 没出事的一屏应该看起来近乎空白，跟「每张卡都同样响」的看板正相反。
 *
 * 【三个饱和色只留给状态，不做装饰】。没有渐变、没有投影、
 * 没有为了好看而上的颜色 —— 一旦颜色可以是装饰，它就不再是信号。
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* 纸与线 —— 冷调，不是暖奶油。
           这是账纸的白，不是信笺的白:偏蓝一点点，数字压上去更黑。 */
        paper: '#fcfcfd',
        card: '#ffffff',
        sunk: '#f5f6f8',      // 凹下去的一档（表头、只读区）
        rule: '#e7e8ec',      // 发丝线
        'rule-2': '#d3d6dd',  // 需要看得见的边界（输入框、按钮）

        /* 墨 —— 四档，够用。层级靠这四档拉开，不靠字号堆。 */
        ink: '#16181d',
        'ink-2': '#4a4e57',
        'ink-3': '#797f8b',
        'ink-4': '#a8adb8',

        /* 状态三色。名字说的是【它是什么状态】，不是它什么颜色 ——
           下一个人要改配色时，不会因为「red 现在不红了」而困惑。 */
        debt: '#a6321e',        // 欠着 / 失败 / 不平 —— 会计的红字
        'debt-bg': '#fbeceb',
        settled: '#1f6b4a',     // 已结 / 已签收 / 平了
        'settled-bg': '#e6f1eb',
        pending: '#8a6a16',     // 在途 / 等着 / 处理中
        'pending-bg': '#f8f0dc',
      },
      fontFamily: {
        /* 【不用 webfont】。系统栈本身就是为界面调过的，
           而且它不会因为一次网络抖动让整台控制台先渲成宋体再跳一下。 */
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"',
          '"PingFang SC"', '"Microsoft YaHei"', '"Noto Sans SC"',
          'system-ui', 'sans-serif',
        ],
        /* 钱与 id 用等宽:数位对齐了，错的那个数才跳出来 */
        mono: [
          'ui-monospace', 'SFMono-Regular', '"SF Mono"',
          'Menlo', 'Consolas', '"Liberation Mono"', 'monospace',
        ],
      },
      fontSize: {
        /* 【12px 是地板】。上一版有 9px 的全大写标签 ——
           小到读不出来，而它占的是「这一列是什么」这么要紧的位置。
           五档，各有各的活儿:
             12 表格与元信息 · 13 正文与控件 · 15 区块标题
             20 页名 · 30 这一页最要紧的那个数 */
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['15px', { lineHeight: '22px' }],
        lg: ['20px', { lineHeight: '26px' }],
        xl: ['30px', { lineHeight: '34px' }],
        '2xl': ['44px', { lineHeight: '46px' }],
      },
      spacing: {
        rail: '208px',   // 左栏。19 个工作台加计数，208 是不折行的最小值
      },
      borderRadius: {
        DEFAULT: '4px',  // 只有一档:交互面用它，表格与分隔线不用
      },
      boxShadow: {
        /* 只有浮层有影子 —— 抽屉、弹层。卡片没有。
           每张卡都带一层灰影是「SaaS 卡片套装」最明显的一处。 */
        pop: '0 8px 28px -6px rgb(22 24 29 / 0.18), 0 2px 6px -2px rgb(22 24 29 / 0.10)',
      },
    },
  },
  plugins: [],
};
