/**
 * 全局配置 · env-aware BASE URL
 *
 * develop → wx 开发者工具本机 (host 上的 unmei-api :6028;须勾「不校验合法域名」)
 * trial   → 灰度(TODO 上线前填)
 * release → 生产(TODO)
 */

function detectBaseUrl(): string {
  try {
    const acc = wx.getAccountInfoSync()
    const env = acc.miniProgram.envVersion
    if (env === 'release') return 'https://api.buwanren.example.com'
    if (env === 'trial') return 'https://api-stg.buwanren.example.com'
  } catch (_e) {
    // basicLibrary 2.2.2+ 才有 getAccountInfoSync · 落到 dev
  }
  return 'http://localhost:6028'
}

export const CONFIG = {
  API_BASE: detectBaseUrl(),
  APP_NAME: '不完人',
  APP_NAME_EN: 'buwanren',
  APP_VERSION: '0.2.0',
  DEFAULT_REGION: 'cn',
  DEFAULT_LOCALE: 'zh-CN',
} as const
