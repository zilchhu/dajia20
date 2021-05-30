import axios from 'axios'
import urls_ from './url.js'
import knex from 'knex'

const knx = knex({
  client: 'mysql',
  connection: {
    host: '192.168.3.112',
    user: 'dj',
    password: '2!k^Fw%e',
    database: 'naicai'
  }
})

export class ElmRequest {
  constructor(ks_id) {
    this.ks_id = ks_id

    const namespace = 'axios-retry'
    const id = 'ECC07A81FECF4AB2B36E70CEE050E921|1615185495921'
    const metas = {
      appName: 'melody',
      appVersion: '4.4.0',
      ksid: this.ks_id
    }
    const ksid = metas.ksid
    const ncp = '2.0.0'

    this.instance = axios.create({
      baseURL: 'https://app-api.shop.ele.me/',
      timeout: 3000,
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'zh-CN,zh;q=0.9',
        'content-length': '280',
        'content-type': 'application/json;charset=UTF-8',
        'invocation-protocol': 'Napos-Communication-Protocol-2',
        origin: 'https://melody-goods.faas.ele.me',
        referer: 'https://melody-goods.faas.ele.me/',
        'sec-ch-ua': `"Google Chrome";v="87", " Not;A Brand";v="99", "Chromium";v="87"`,
        'sec-ch-ua-mobile': '?0',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        'x-eleme-requestid': `${id}`
      }
    })

    this.instance.interceptors.request.use(
      config => {
        if (config.method == 'post') {
          config[namespace] = config[namespace] || {}
          config[namespace].data = config.data
          config[namespace].retryCount = config[namespace].retryCount || 0

          config.data = {
            id,
            metas: { ...metas, shopId: config.data.shopId },
            ncp,
            ...config.data
          }
        }
        // console.log(config)
        return config
      },
      err => Promise.reject(err)
    )

    this.instance.interceptors.response.use(
      res => {
        if (res.data.error != null || res.data.error != undefined) {
          return Promise.reject(res.data.error)
        }
        return res.data.result == null ? Promise.resolve(res.data) : Promise.resolve(res.data.result)
      },
      error => {
        const config = error.config

        if (!config || !config[namespace]) {
          return Promise.reject(error)
        }

        const shouldRetry = /ETIMEDOUT|ECONNRESET|ECONNABORTED/.test(error.code) && config[namespace].retryCount < 20

        if (shouldRetry) {
          config[namespace].retryCount += 1

          console.log('retry...', config[namespace].retryCount)
          return new Promise(resolve =>
            resolve(instance({ ...config, data: config[namespace].data }))
          )
        }

        return Promise.reject(error)
      }
    )
  }
}

export const urls = urls_
