/**
 * 商品 API 封装 · 对应后端 /v1/products、/v1/products/:id
 *
 * `region` / `platform` 一律由这里带上，不让每个页面各写一遍 ——
 * 忘带的后果不是报错，是**拿到别的区的价格**，而那看起来完全正常。
 */

import { api } from './api'
import { CONFIG } from '../config/index'
import type {
  CreatedOrder, OrderDetail, OrderPage, PayStarted, ProductCard, ProductDetail,
  Shipment, ShipmentTrace,
} from '../types/commerce'

const scope = () => 'region=' + CONFIG.DEFAULT_REGION + '&platform=mini'

/* 幂等键。**服务端一直要求它，而在这之前没有任何客户端在发**
   （README 那张「实现完整、零调用方」的表第 2 条）。
   一次点击一个键：重复提交（手抖、断网重试）会撞上同一个键，
   服务端原样回上一次的结果，而不是再扣一次钱。
   所以键要按「这一次操作」生成，不是按请求 —— 重试要复用同一个。 */
export function newIdemKey(what: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return 'mini-' + what + '-' + Date.now().toString(36) + '-' + rand
}
const idem = (key: string) => ({ 'idempotency-key': key })

export const commerceApi = {
  /** 上架商品。`category` 可选：report / omamori / service / charm */
  /** 上架商品。`category` 可选：report / omamori / service / charm；
   *  `villagerId` 按不完人筛（绑在 `sku.villager_id` 上，一件御守对一位） */
  products: (category?: string, villagerId?: string): Promise<ProductCard[]> =>
    api.get<ProductCard[]>(
      '/v1/products?' + scope()
        + (category ? '&category=' + category : '')
        + (villagerId ? '&villager_id=' + villagerId : ''),
    ),

  /** 商品详情，价格在 `skus[].current_price_minor` 上 */
  product: (id: string): Promise<ProductDetail> =>
    api.get<ProductDetail>('/v1/products/' + id + '?' + scope()),

  /** 下单。`idemKey` 由调用方生成并在重试时复用 —— 见 `newIdemKey` */
  createOrder: (
    skuId: string,
    qty: number,
    idemKey: string,
    contact?: Record<string, unknown>,
  ): Promise<CreatedOrder> =>
    api.post<CreatedOrder>(
      '/v1/orders',
      {
        lines: [{ sku_id: skuId, qty }],
        region: CONFIG.DEFAULT_REGION,
        ...(contact ? { contact } : {}),
      },
      idem(idemKey),
    ),

  orders: (): Promise<OrderPage> => api.get<OrderPage>('/v1/orders'),

  order: (id: string): Promise<OrderDetail> => api.get<OrderDetail>('/v1/orders/' + id),

  cancelOrder: (id: string, idemKey: string): Promise<unknown> =>
    api.post('/v1/orders/' + id + '/cancel', {}, idem(idemKey)),

  shipments: (orderId: string): Promise<Shipment[]> =>
    api.get<Shipment[]>('/v1/orders/' + orderId + '/shipments'),

  /** 一件包裹走到哪儿了。轨迹里认不出的类型后端记 `unknown`，不编成「在途」 */
  trace: (orderId: string, shipmentId: string): Promise<ShipmentTrace> =>
    api.get<ShipmentTrace>('/v1/orders/' + orderId + '/shipments/' + shipmentId + '/trace'),

  /** 申请退款。`reasonCode` 后端只留档，不参与判断 */
  refund: (orderId: string, reasonCode: string, idemKey: string): Promise<{ refund_id: string }> =>
    api.post<{ refund_id: string }>(
      '/v1/orders/' + orderId + '/refund',
      { reason_code: reasonCode },
      idem(idemKey),
    ),

  /** 发起支付。返回的 `outcome` 交给 `wx.requestPayment` —— 那一步只有真机有 */
  pay: (id: string, openid: string, idemKey: string): Promise<PayStarted> =>
    api.post<PayStarted>(
      '/v1/orders/' + id + '/pay',
      { channel: 'wechat_jsapi', openid },
      idem(idemKey),
    ),
}
