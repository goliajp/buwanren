/**
 * 商品 API 封装 · 对应后端 /v1/products、/v1/products/:id
 *
 * `region` / `platform` 一律由这里带上，不让每个页面各写一遍 ——
 * 忘带的后果不是报错，是**拿到别的区的价格**，而那看起来完全正常。
 */

import { api } from './api'
import { CONFIG } from '../config/index'
import type {
  CreatedOrder, OrderDetail, OrderPage, OrderPreview, PayStarted, ProductCard, ProductDetail,
  MyCoupon, Shipment, ShipmentTrace,
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

  /* 【能订的东西，问的是 `kind` 不是 `category`】（2026-09-05）。
     两处都栽在同一个地方:「我的」问 `products('service')`,
     「订着的」问 `products('subscription')` —— 而上面那个 `products()`
     把参数发在 `category` 上。

     `category` 是货架分类（charm / report / omamori / service…），
     `kind` 才是「它是不是一件订阅」（one_shot / subscription /
     digital_goods / service）。**两边都有 `service` 这个值**,
     所以写错了也不报错、也不是空 —— 它只是永远问一个没有货的分类。

     2026-09-05 早些时候修过一次「问的是 subscription，不是 service」:
     那次改对了值，没改参数名，于是问题原样留着。
     现在单开一支，名字里就说清它问的是什么。 */
  subscribable: (): Promise<ProductCard[]> =>
    api.get<ProductCard[]>('/v1/products?' + scope() + '&kind=subscription'),

  /* 【我手里有哪些券】（2026-09-05）。在这之前用户那一侧看不见任何一张:
     后台发得出绑人的券、库里 `coupon.owner_user_id` 也一直存着，
     而客户端唯一跟券有关的东西是确认页上那个「有券码就填这儿」的格子 ——
     也就是**他得先知道那串码**。运营补一张券，用户打开什么都看不到，
     券得另找一条路送到他眼前（短信 / 客服 / 二维码），那条路一断，
     这张券就等于没发。 */
  coupons: (): Promise<MyCoupon[]> =>
    api.get<MyCoupon[]>('/v1/coupons?region=' + CONFIG.DEFAULT_REGION),

  /** 商品详情，价格在 `skus[].current_price_minor` 上 */
  product: (id: string): Promise<ProductDetail> =>
    api.get<ProductDetail>('/v1/products/' + id + '?' + scope()),

  /** 下单。`idemKey` 由调用方生成并在重试时复用 —— 见 `newIdemKey` */
  /* 【地址要发在发货那一步真读的那个字段上】。
     原先只发 `contact`，而 `unmei-app/src/fulfillment.rs` 建运单时
     收件人快照取的是 `order_meta.shipping_address_json`，外面还套着
     `COALESCE(…, '{}')` —— 于是每一张实物单的面单都是空的:
     没有姓名、没有电话、没有地址，而买家刚被强制选过一次地址，
     全程一处不报错。库里 61 单 contact 带地址、shipping_address 全为 NULL。
     （2026-09-01 五路评审 · 工程审计抓到。`check-bodies.py` 的判据是单向的
      —— 它只报「前端发了后端不认的字段」，漏发按设计不报。）
     两个都发:`contact` 是联系人（姓名电话），`shipping_address` 是寄到哪。 */
  /* 下单之前先算一遍：这些东西加上这张券，一共多少。
     【折扣只有服务端算得准】——封顶、余额、活动有效期。
     客户端自己算一遍必然跟服务端不一致，而不一致的那一刻，
     人是看着客户端那个数按下付款的。 */
  previewOrder: (
    skuId: string,
    qty: number,
    couponCodes: string[],
  ): Promise<OrderPreview> =>
    api.post<OrderPreview>('/v1/orders/preview', {
      lines: [{ sku_id: skuId, qty }],
      coupon_codes: couponCodes,
      region: CONFIG.DEFAULT_REGION,
    }),

  createOrder: (
    skuId: string,
    qty: number,
    idemKey: string,
    contact?: Record<string, unknown>,
    couponCodes?: string[],
  ): Promise<CreatedOrder> =>
    api.post<CreatedOrder>(
      '/v1/orders',
      {
        lines: [{ sku_id: skuId, qty }],
        region: CONFIG.DEFAULT_REGION,
        ...(couponCodes && couponCodes.length ? { coupon_codes: couponCodes } : {}),
        ...(contact ? { contact } : {}),
        ...(contact && contact.address ? { shipping_address: contact } : {}),
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
