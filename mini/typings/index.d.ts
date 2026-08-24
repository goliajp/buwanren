/// <reference path="../node_modules/miniprogram-api-typings/index.d.ts" />

interface IAppOption {
  globalData: {
    token: string | null
    user: import('../miniprogram/types/auth').UserPublic | null
    authSource: 'wxmp' | 'anonymous' | null
    activeNatalId: string | null
  }
  broadcast(name: 'onAuthReady' | 'onNatalChanged'): void
}
