import App, { loop, wrap, readXls, readJson } from './app.js'
import knex from 'knex'
import flatten from 'flatten'
import dayjs from 'dayjs'
import fs from 'fs'
import sleep from 'sleep-promise'
import schedule from 'node-schedule'

const knx = knex({
  client: 'mysql',
  connection: {
    host: '192.168.3.112',
    user: 'dj',
    password: '2!k^Fw%e',
    database: 'naicai'
  }
})

// async function t1() {
//   try {
//     const data = await readXls('elm/饿了么低质量(1)(1).xlsx', 'c2')
//     console.log(await knx('test_elm_low_temp_').insert(data))
//   } catch (error) {
//     console.error(error)
//   }
// }

function omit(obj, ks) {
  let newKs = Object.keys(obj).filter(v => !ks.includes(v))
  let newObj = newKs.reduce((res, k) => {
    return { ...res, [k]: obj[k] }
  }, {})
  return newObj
}

async function renameFood(ksid, id, oldName) {
  const app = new App(id, ksid)

  try {
    const foods = await app.food.searchFood(oldName)
    let foodUpdateNameRes = []
    for (let food of foods) {
      try {
        if (food.name.includes('鲜奶红豆') || food.name.includes('红豆鲜奶') || food.name.includes('桂圆红枣枸杞鲜奶')) continue
        let newName = food.name.replace('鲜奶', '椰奶')
        console.log(food.name, newName)
        let res = await app.food.updateName(food.id, newName)
        foodUpdateNameRes.push({ ok: 1, res })
      } catch (e) {
        foodUpdateNameRes.push({ ok: 0, e })
      }
    }
    return Promise.resolve(foodUpdateNameRes)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function updateImg(ksid, id, itemId, url) {
  const app = new App(id, ksid)

  try {
    return app.food.updateImg(itemId, url)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function updateImg3(ksid, id, name, url) {
  const app = new App(id, ksid)

  try {
    let foods = await app.food.searchFood(name)
    if (foods.length == 0) return Promise.reject('search failed')
    let res = await Promise.allSettled(foods.map(f => app.food.updateImg(f.globalId, url)))
    return res
  } catch (err) {
    return Promise.reject(err)
  }
}

async function updateImg2(ksid, name, newUrl) {
  try {
    let [data, _] = await knx.raw(
      `SELECT * FROM ele_food_manage f
       LEFT JOIN ele_info_manage r ON f.shop_id = r.shop_id
       WHERE r.shop_name LIKE '%奶茶%' AND bach_date = DATE_FORMAT(CURDATE(), '%Y%m%d') AND  name  LIKE '${name}%'`
    )
    data = data.map(v => ({
      id: v.shop_id,
      foodId: v.global_id,
      newUrl
    }))
    return Promise.all(data.map(v => new App(v.id, ksid).food.updateImg(v.foodId, v.newUrl)))
    // const foodUpdateImgRes = await fallbackApp.food.updateImg(foodId, newUrl)
    // return Promise.resolve(foodUpdateImgRes)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function test_rename() {
  try {
    let data = await knx('ele_info_manage').select().where({ status: 0 }).andWhere('shop_name', 'like', '%茶记%')

    let dat = data.map(v => [v.shop_id, '鲜奶'])
    await loop(renameFood, dat, false)
  } catch (error) {
    console.error(error)
  }
}

async function test_updateImg() {
  try {
    // let ims = await readJson('elm/pic/ims.json')

    // await loop(
    //   updateImg3,
    //   ims.map(v => [2086322543, v.name.replace(' 拷贝.jpg', ''), v.url])
    // )

    let ims = await readJson('elm/pic/ims.json')
    await loop(
      updateImg2,
      ims.map(v => [v.name.replace(' 拷贝.jpg', '').replace('600x450', ''), v.url])
    )

    // let [data, _] = await knx.raw(
    //   `SELECT * FROM ele_food_manage WHERE bach_date = DATE_FORMAT(20210419, '%Y%m%d') AND shop_id = 2077016109`
    // )

    // data = data.map(v => [
    //   v.shop_id,
    //   v.name,
    //   v.category_name,
    //   v.image_url
    // ])
    // await loop(updateImg3, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function updateFoodMinPurchase(ksid, id, name) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    const res = await app.food.updateMinPurchase([food.id], 1)
    return Promise.resolve(res)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function test_minPurchase() {
  try {
    let [data, _] = await knx.raw(
      `SELECT * FROM ele_food_manage WHERE DATE(insert_date) = CURDATE()  AND activity_price > 8 AND min_purchase_quantity >= 2`
    )
    data = data.map(v => [v.shop_id, v.name])
    await loop(updateFoodMinPurchase, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function updateAct(ksid, id, name, catName, benefit, effectTimes = 10000) {
  const app = new App(id, ksid)
  try {
    let acts = await app.act.foodAct.list()
    let act = acts.find(v => v.name == name)

    if (act) {
      const actContent = await app.act.foodAct.content(act.activityId, act.foodId)

      // const actMaxCount = await app.act.foodAct.getCount()
      // if (
      //   actMaxCount.maxActivitySkuCountPerOrder != -1 &&
      //   actMaxCount.maxActivitySkuCountPerOrder < actContent.effectTimes
      // ) {
      //   await app.act.foodAct.updateCount(actContent.effectTimes == 10000 ? -1 : actContent.effectTimes)

      // }
      await app.act.foodAct.invalid(act.activityId, act.foodId)
      await app.act.foodAct.updateCount(-1)

      const res = await app.act.foodAct.create(act.foodId, benefit, actContent.effectTimes)
      return Promise.resolve(res)
    } else {
      // let effectTimes = 10000
      if (!effectTimes) {
        if (parseFloat(benefit) < 5) effectTimes = 1
        else if (parseFloat(benefit) < 8) effectTimes = 2
      }

      // const actMaxCount = await app.act.foodAct.getCount()
      // if (actMaxCount.maxActivitySkuCountPerOrder != -1 && actMaxCount.maxActivitySkuCountPerOrder < effectTimes) {
      //   await app.act.foodAct.updateCount(effectTimes == 10000 ? -1 : effectTimes)
      // }

      await app.act.foodAct.updateCount(-1)

      const food = await app.food.find2(name, catName)
      const res = await app.act.foodAct.create(food.specs[0].id, benefit, effectTimes)
      return Promise.resolve(res)
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

async function test_act() {
  try {
    let [act_foods, _] = await knx.raw(
      "SELECT * FROM `ele_food_activi_detai` WHERE `shop_id` = '2077016109' AND `insert_date` BETWEEN '2021-04-19 00:00:38' AND '2021-04-20 00:00:47' AND activi_tags <> '超值换购' ORDER BY `insert_date` DESC LIMIT 0, 1000"
    )
    // let shops = await knx('ele_info_manage').select().where({status: 0}).andWhere('shop_name', 'like', '%茶记%')
    let shops = `2077016109`
      .split('\n')
      .map(v => v.trim())
      .map(v => ({ shop_id: v }))

    let res = await Promise.allSettled(
      shops.map(async shop => {
        let data = act_foods.map(v => [shop.shop_id, v.food_name, v.activi_price, v.effect_times])
        await loop(updateAct, data)
      })
    )
    console.log(res)
    // for(let shop of shops) {
    //   console.log(shop.shop_name)
    //   try {

    //   } catch (e) {

    //   }
    // }
  } catch (e) {
    console.error(e)
  }
}

async function updateActTime(ksid, id, activityId, foodId, name, actPrice) {
  const app = new App(id, ksid)
  try {
    const actContent = await app.act.content(activityId, foodId)
    const actMaxCount = await app.act.getCount()
    if (
      actMaxCount.maxActivitySkuCountPerOrder != -1 &&
      actMaxCount.maxActivitySkuCountPerOrder < actContent.effectTimes
    ) {
      await app.act.updateCount(actContent.effectTimes == 10000 ? -1 : actContent.effectTimes)
    }
    // const res = await app.act.create(foodId, actPrice, actContent.effectTimes)
    const res = await app.act.update(
      activityId,
      foodId,
      actPrice,
      actContent.effectTimes,
      actContent.activityTime.date.beginDate
    )
    return Promise.resolve(res)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function log_acts(ksid, id) {
  try {
    const app = new App(id, ksid)
    let acts = await app.act.foodAct.list()
    acts = acts.filter(act => act.rule.tags.find(v => v == '超值换购'))
    const res = await knx('test_el_acts_').insert(
      acts.map(v => ({
        shopId: id,
        activityId: v.activityId,
        foodId: v.foodId,
        skuId: v.skuId,
        name: v.name,
        price: v.rule.price
      }))
    )
    return Promise.resolve(res)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_acttime() {
  try {
    let shops = await knx('elm_shops_').select().where({ restaurantType: 'LEAF' })
    shops = shops.map(v => [v.id])
    await loop(log_acts, shops, false)
    // let data = await knx('test_el_acts_').select()
    // data = data.map(v => [v.shopId, v.activityId, v.foodId, v.name, v.price])
    // let data = readJson('elm/log/log.json').map(v => v.meta)
    // await loop(updateActTime, data)
  } catch (error) {
    console.error(error)
  }
}

export async function updatePlan(ksid, id, name, cateName, minPurchase, boxPrice, price, actPrice, effetcTimes) {
  const app = new App(id, ksid)
  try {
    let result = {}
    // if (!minPurchase && !boxPrice && !price && !actPrice) return Promise.resolve(result)
    // if (!price && !boxPrice) return Promise.resolve(result)
    const food = await app.food.find2(name, cateName)
    if (minPurchase && minPurchase != '') {
      const purchaseRes = await app.food.updateMinPurchase([food.id], minPurchase)
      result.purchaseRes = purchaseRes
    }

    if (boxPrice && boxPrice != '') {
      const boxRes = await app.food.updatePackageFee(
        food.id,
        food.specs.map(spec => spec.id),
        boxPrice
      )
      result.boxRes = boxRes
    }

    if (price && price != '') {
      // (skuType || food.recentSales <= 30) && price > food.specs[0].price * 1.4
      if (false) {
        const priceRes = await updateSkuPrice(id, name, null, price)
        result.priceRes = priceRes.specs
      } else {
        const priceRes = await app.food.updateFoodSpecs(
          food.id,
          food.specs.map(spec => ({ ...spec, packageFee: boxPrice, price }))
        )
        result.priceRes = priceRes.specs
      }
    }

    if (actPrice && actPrice != '') {
      const actRes = await updateAct(ksid, id, name, cateName, actPrice, effetcTimes)
      result.actRes = actRes
    }
    return Promise.resolve(result)
  } catch (err) {
    console.error(err)
    return Promise.reject(err)
  }
}

async function test_updateCount(id) {
  try {
    const app = new App(id)
    const res = await app.act.foodAct.updateCount(-1)
    return Promise.resolve(res)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_plan() {
  try {
    let data = await readXls('elm/plan/05-23饿了么低折扣商品起购错误查询(1)(1).xlsx', '饿了么低折扣商品起购错误查询')
    data = data.map(v => [v.店铺id, v.商品, v.分类, 1])

    // let data = readJson('elm/log/log.json')
    //   .filter(v => v.err.code == 'ETIMEDOUT')
    //   .map(v => v.meta)
    await loop(updatePlan, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function updateSell(ksid, id, name, sell) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    // const act = await app.act.find(name)
    // let actPrice = parseFloat(act.rule.price)
    const res = await app.food.updateSellStatus(
      food.id,
      food.specs.map(spec => spec.id),
      sell
    )
    return Promise.reject(res)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function batchRemove(ksid, id, name) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    return app.food.batchRemove([{ foodId: food.id, foodSpecIds: food.specs.map(spec => spec.id) }])
  } catch (e) {
    return Promise.reject(e)
  }
}

async function removeCat(ksid, id, name) {
  const app = new App(id, ksid)
  try {
    return app.food.removeCat(name)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_removeCat() {
  try {
    let shops = await knx('ele_info_manage').select().where({ status: 0 })
    let data = shops.map(v => [v.shop_id, '520大行动'])
    await loop(removeCat, data)
  } catch (e) {
    console.error(e)
  }
}

async function test_remove() {
  try {
    let shops = await knx('ele_info_manage').select().where({ status: 0 })
    await loop(batchRemove, shops.map(v => [v.shop_id, '送你甜蜜魔盒（生活需要仪式感）']))
    await loop(batchRemove, shops.map(v => [v.shop_id, '520爱你💖甜甜蜜蜜💖(随单附赠小礼品）']))
    await loop(batchRemove, shops.map(v => [v.shop_id, '520爱你❥甜甜蜜蜜❥(随单附赠小礼品）']))
    await loop(batchRemove, shops.map(v => [v.shop_id, '520爱你❥甜甜蜜蜜❥']))
  } catch (e) {
    console.error(e)
  }
}

async function test_offsell() {
  try {
    let [data, _] = await knx.raw(
      `SELECT * FROM ele_food_manage  WHERE DATE(insert_date) = CURDATE()  AND name LIKE '%立减%配送费%'`
    )

    data = data.map(v => [v.shop_id, v.name, false])
    await loop(updateSell, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function editFood(ksid, id, name) {
  const app = new App(id, ksid)
  try {
    let food = await app.food.find(name)
    // if (food.name.includes('扫码') || food.name.includes('红包')) continue
    let foodview = await app.food.getFoodView(food.id)
    foodview = foodview.food

    return app.food.editFood(food.id, { ...foodview, notDeliverAlone: true })
  } catch (err) {
    return Promise.reject(err)
  }
}

async function test_notdeliveralone() {
  try {
    let shops = await knx('ele_info_manage')
      .select()
      .where({ status: 0 })
      .andWhere('shop_name', 'like', '%茶记%')
      .andWhere('shop_name', 'not like', '%朝阳%')
    let names = `泰香虾饼$(1个)、客家薯饼$(1个)、川香鸡柳$【1根】、香辣翅根（1个）$、火山石烤纯肉肠【肉肉哦】$、网红柠檬鸡爪【4小个】`.split(
      '、'
    )
    let res = await Promise.allSettled(
      shops.map(async s => {
        let data = names.map(f => [s.shop_id, f])
        await loop(editFood, data, false)
      })
    )
    console.log(res)
  } catch (error) {
    console.error(error)
  }
}

async function updateActRule(ksid, id, rules) {
  const app = new App(id, ksid)
  try {
    const res = await app.shop.updateAct('店铺满减', rules)
    return Promise.resolve(res)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function test_actRule() {
  try {
    let r1 = [
      { benefit: 6, condition: 16 },
      { benefit: 10, condition: 32 },
      { benefit: 14, condition: 48 },
      { benefit: 18, condition: 60 },
      { benefit: 28, condition: 100 }
    ]
    let r2 = [
      { benefit: 4, condition: 15 },
      { benefit: 7, condition: 30 },
      { benefit: 10, condition: 45 },
      { benefit: 13, condition: 60 },
      { benefit: 28, condition: 100 }
    ]
    let r3 = [
      { benefit: 6, condition: 15 },
      { benefit: 9, condition: 30 },
      { benefit: 12, condition: 45 },
      { benefit: 15, condition: 60 },
      { benefit: 30, condition: 100 }
    ]
    let r4 = [
      { benefit: 8, condition: 16 },
      { benefit: 12, condition: 32 },
      { benefit: 16, condition: 48 },
      { benefit: 20, condition: 60 },
      { benefit: 30, condition: 100 }
    ]
    let r1ids = [500795650, 500729113, 2044188288, 2036923650, 500823702, 500626322]
    let data = r1ids.map(v => [v, r1])
    await loop(updateActRule, data)
  } catch (error) {
    console.log(error)
  }
}

async function updateDeliverActTime(ksid, id) {
  const app = new App(id, ksid)
  try {
    const act = await app.act.find('减配送费')
    const instanceId = new URL(act.url).searchParams.get('playInstanceId')
    let form = await app.act.deliverAct.getForm(instanceId)
    let newForm = flatten(
      form.map(item => item.components.map(c => ({ id: c.id, fieldName: c.fieldName, value: c.value })))
    )
    let target = newForm.findIndex(v => v.fieldName == '日期')
    newForm[target] = {
      id: newForm[target].id,
      value: JSON.stringify({ beginDate: dayjs().startOf('day').format('YYYY-MM-DD'), endDate: '2021-07-31' })
    }
    target = newForm.findIndex(v => v.fieldName == '配送方式')
    newForm[target] = {
      id: newForm[target].id,
      value: JSON.stringify({ value: newForm[target].value, standardId: newForm[target].value })
    }
    newForm = newForm.map(v => omit(v, ['fieldName']))
    const res = await app.act.deliverAct.saveForm(instanceId, newForm)
    return Promise.resolve(res)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function updateSubsidy(ksid, shopId, _1, _2, _3) {
  const app = new App(shopId, ksid)
  try {
    // const act = await app.act.find('百亿补贴')

    const act = await app.act.findFlowAct('百亿补贴')
    const instanceId = act.applyShopDtoResult.entityList[0].playInstanceId
    const globalId = act.applyShopDtoResult.entityList[0].applyInfoId

    // const instanceId = new URL(act.url).searchParams.get('playInstanceId')
    // const { globalId } = await app.act.subsidyAct.getGlobalId(instanceId)

    let { rules } = await app.act.subsidyAct.getInfo(instanceId)
    rules[6].value = JSON.parse(rules[6].value)
    rules[6].value.rule[0].benefit = parseInt(_1)
    rules[6].value.rule[1].benefit = parseInt(_2)
    rules[6].value.rule[2].benefit = parseInt(_3)
    // rules[6].value.rule[2].benefit = 14
    rules[6].value = JSON.stringify(rules[6].value)
    let formFields = [rules[0], rules[6]]

    return app.act.subsidyAct.modify(globalId, formFields)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_subsidy() {
  try {
    let data = await readXls('elm/plan/百亿补贴修改(1).xlsx', '1.饿了么满减活动检查')
    data = data.filter(v => v.第一档 != '').map(v => [v.shop_id, v.第一档, v.第二档, v.第三档])
    await loop(updateSubsidy, data, true)
  } catch (error) {
    console.error(error)
  }
}

async function createDeliverAct(ksid, id) {
  const app = new App(id, ksid)
  try {
    const act = await app.act.find('减配送费')
    const instanceId = new URL(act.url).searchParams.get('playInstanceId')
    let form = await app.act.deliverAct.getForm(instanceId)
    let newForm = flatten(
      form.map(item => item.components.map(c => ({ id: c.id, fieldName: c.fieldName, value: c.value })))
    )
    let target = newForm.findIndex(v => v.fieldName == '日期')
    newForm[target] = {
      id: newForm[target].id,
      value: JSON.stringify({ beginDate: dayjs().startOf('day').format('YYYY-MM-DD'), endDate: '2021-07-31' })
    }
    target = newForm.findIndex(v => v.fieldName == '配送方式')
    newForm[target] = {
      id: newForm[target].id,
      value: JSON.stringify({ value: newForm[target].value, standardId: newForm[target].value })
    }
    newForm = newForm.map(v => omit(v, ['fieldName']))
    await app.act.deliverAct.invalid(instanceId)
    const res = await app.act.deliverAct.create(newForm)
    return Promise.resolve(res)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_updateDeliverTime() {
  try {
    let data = await readJson('elm/log/log.json')
    data = data.map(v => v.meta)
    await loop(updateDeliverActTime, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function logLow(ksid, id) {
  const app = new App(id, ksid)

  try {
    const { infoOptimizeItems } = await app.food.listForOptimize()
    const data = infoOptimizeItems.map(v =>
      v.lowQualityIndicators.map(k => ({
        shopId: v.shopId,
        itemId: v.itemId,
        itemName: v.itemName,
        lowIndicator: k.name
      }))
    )
    console.log(data)
    const res = await knx('test_elm_low_').insert(flatten(data))
    return Promise.resolve(res)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_loglow() {
  try {
    let data = [{ id: 501823909 }]
    data = data.map(v => [v.id])
    await loop(logLow, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function updateDesc(ksid, id, name, desc) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    return app.food.updateFoodDesc(food.id, desc)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function updateMaterial(ksid, id, name, material) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    const foodView = await app.food.getFoodView(food.id)
    const m = await app.food.findMaterial(material)
    const p = foodView.food.properties.map(v => ({
      ...v,
      details:
        v.details.length == 1 ? v.details.concat([{ ...v.details[0], name: v.details[0].name + '.' }]) : v.details
    }))
    const data = { ...foodView.food, itemMaterials: [{ materialId: m.id, materialName: m.name }], properties: p }
    return app.food.editFood(food.id, data)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function updateSkuPrice(ksid, id, name, boxPrice, price) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    const foodView = await app.food.getFoodView(food.id)
    let specs = [foodView.food.specs[0]]
    specs[0].name = '1'
    specs.push({
      name: '2',
      price,
      weight: 0,
      calorie: null,
      stock: 10000,
      maxStock: 10000,
      packageFee: boxPrice || specs[0].packageFee,
      stockStatus: 0,
      onShelf: true
    })
    const edited = await app.food.editFood(food.id, { ...foodView.food, specs })
    await sleep(600)
    const editedfoodView = await app.food.getFoodView(food.id)
    let spec = editedfoodView.food.specs.find(v => v.name == '2')
    if (!spec) return Promise.reject({ err: 'spec not found' })
    spec.name = ''
    return app.food.editFood(food.id, { ...editedfoodView.food, specs: [spec] })
  } catch (e) {
    return Promise.reject(e)
  }
}

async function updateSkuAttr(ksid, id, name, specAttribute) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    const foodView = await app.food.getFoodView(food.id)
    let specs = foodView.food.specs.map(v => ({ ...v, specAttribute }))

    return app.food.editFood(food.id, { ...foodView.food, specs })
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_updateSkuAttrs() {
  try {
    let [data, _] = await knx.raw(
      `SELECT * FROM ele_food_manage WHERE bach_date = DATE_FORMAT(CURDATE(), '%Y%m%d') AND name LIKE '%杨枝甘露%'`
    )
    const attr = { weight: '500', unit: '克' }
    data = data.map(v => [v.shop_id, v.name, attr])
    await loop(updateSkuAttr, data, true)
  } catch (error) {
    console.error(error)
  }
}

async function updateLabel(ksid, id, name, label) {
  const app = new App(id, ksid)
  try {
    const labelMap = {
      新品: 'NEW',
      招牌菜: 'FEATURED',
      辣: 'SPICY'
    }
    const food = await app.food.find(name)
    const foodView = await app.food.getFoodView(food.id)

    const p = foodView.food.properties.map(v => ({
      ...v,
      details:
        v.details.length == 1 ? v.details.concat([{ ...v.details[0], name: v.details[0].name + '.' }]) : v.details
    }))
    const data = { ...foodView.food, labels: [labelMap[label]], properties: p }
    return app.food.editFood(food.id, data)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function updateCateModel(ksid, id, name, model) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find(name)
    const foodView = await app.food.getFoodView(food.id)
    const c = await app.food.findCategoryModel(model)
    const p = foodView.food.properties.map(v => ({
      ...v,
      details:
        v.details.length == 1
          ? v.details
            .map(d => ({ ...d, name: d.name.trim() }))
            .concat([{ ...v.details[0], name: v.details[0].name + '.' }])
          : v.details.map(d => ({ ...d, name: d.name.trim() }))
    }))
    const data = { ...foodView.food, categoryModel: c, properties: p }
    return app.food.editFood(food.id, data)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function updateJoinHot(ksid, id, name, catName) {
  const app = new App(id, ksid)
  try {
    const food = await app.food.find2(name, catName)
    const foodView = await app.food.getFoodView(food.id)

    const p = foodView.food.properties.map(v => ({
      ...v,
      details:
        v.details.length == 1
          ? v.details
            .map(d => ({ ...d, name: d.name.trim() }))
            .concat([{ ...v.details[0], name: v.details[0].name + '.' }])
          : v.details.map(d => ({ ...d, name: d.name.trim() }))
    }))
    const data = { ...foodView.food, joinHotGoods: true, properties: p }
    return app.food.editFood(food.id, data)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function updateJoinHot2(ksid, id) {
  const app = new App(id, ksid)
  try {
    let cats = await app.food.listFoodCat()
    let foods = await Promise.all(cats.map(cat => app.food.listFoods(cat.id)))
    foods = flatten(foods)

    let res = await Promise.allSettled(foods.map(food => helper(food)))
    if (res.map(v => v.status != 'fulfilled').length > 0) return Promise.reject(res)
    else return Promise.resolve(res)
  } catch (e) {
    return Promise.reject(e)
  }

  async function helper(food) {
    try {
      console.log(food.name)
      const foodView = await app.food.getFoodView(food.id)

      const p = foodView.food.properties.map(v => ({
        ...v,
        details:
          v.details.length == 1
            ? v.details
              .map(d => ({ ...d, name: d.name.trim() }))
              .concat([{ ...v.details[0], name: v.details[0].name + '.' }])
            : v.details.map(d => ({ ...d, name: d.name.trim() }))
      }))
      const data = { ...foodView.food, joinHotGoods: false, properties: p }
      return app.food.editFood(food.id, data)
    } catch (error) {
      return Promise.reject(error)
    }
  }
}

async function test_updateJoinHot() {
  try {
    let data = await knx('ele_info_manage').select().where({ status: 0 }).andWhere('shop_name', 'like', '%茶记%')
    let names = await readXls('elm/plan/贡茶批量添加热销.xlsx', 'Sheet1')

    data = data.map(async v => {
      let d = names.map(k => [v.shop_id, k.name, k.cat])
      await loop(updateJoinHot, d, false)
    })
  } catch (e) {
    console.error(e)
  }
}

async function test_improve_low() {
  try {
    // let data = await readXls('elm/plan/饿了么低质量(1)(1).xlsx', 'c2')
    // data = data.filter(v => v.特色 != '')
    // let data2 = await knx('test_elm_low_')
    //   .select()
    //   .whereIn(
    //     'itemName',
    //     data.map(v => v.itemName)
    //   )
    //   .andWhere('lowIndicator', 'like', '%特色%')
    //   .andWhere({ shopId: 501823909 })
    // data2 = data2
    //   // .slice(data2.length - 38000)
    //   .map(v => ({ ...v, label: data.find(k => k.itemName == v.itemName).特色 }))
    //   .map(v => [v.shopId, v.itemName, v.label])

    let ids = `501635698
    501655367
    501655374
    501660359
    2072030407
    2076485570`
      .split('\n')
      .map(v => v.trim())

    let data = await readXls('elm/plan/饿了么（大计划民治店）—商品描述.xlsx', '修改版')
    data = data.map(v => [2072030407, v.商品名称.trim(), v.商品描述.trim()])

    await loop(updateDesc, data)
  } catch (error) {
    console.error(error)
  }
}

async function test_logAppeal() {
  try {
    let data = await knx('elm_shops_').select().where({ restaurantType: 'LEAF' })
    data = data.map(v => [v.id])
    await loop(logAppeal, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function logAppeal(ksid, id) {
  try {
    const app = new App(id, ksid)
    const cats = await app.food.listFoodCat()
    let data = []
    for (let cat of cats) {
      try {
        let foods = await app.food.listFoods(cat.id)
        foods = foods
          .filter(food => food.itemAuditInfoList)
          .map(food => ({
            id: food.id,
            name: food.name,
            shopId: id,
            auditStatus: food.itemAuditInfoList[0].auditStatus,
            detail: food.itemAuditInfoList[0].detail
          }))
        data.push(foods)
      } catch (e) {
        console.error(e)
        continue
      }
    }
    return knx('test_elm_appeal_').insert(flatten(data))
  } catch (e) {
    return Promise.reject(e)
  }
}

async function appeal(ksid, id, name) {
  try {
    const app = new App(id, ksid)
    const food = await app.food.find(name)
    // APPEAL_FAILED AUDIT_FAILED
    if (!food.itemAuditInfoList || food.itemAuditInfoList[0].auditStatus == 'APPEALING')
      return Promise.reject({ err: 'no need' })
    return app.food.appeal(food.itemAuditInfoList[0])
  } catch (e) {
    return Promise.reject(e)
  }
}

async function neverAppeal(ksid, id, name) {
  try {
    const app = new App(id, ksid)
    const food = await app.food.find(name)
    // APPEAL_FAILED AUDIT_FAILED
    if (!food.itemAuditInfoList || /APPEAL_FAILED|AUDIT_FAILED/.test(food.itemAuditInfoList[0].auditStatus))
      return Promise.reject({ err: 'no need' })
    return app.food.neverAppeal(food.itemAuditInfoList[0])
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_appeal() {
  try {
    let data = await readXls('elm/plan/工作簿3.xlsx', 'Sheet1')
    data = data.map(v => [v.id, v.产品名])
    await loop(neverAppeal, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function test_invalid_update() {
  try {
    let data = await readXls('elm/plan/1-04饿了么单折扣商品起送查询(1).xlsx', '1-04饿了么单折扣商品起送查询')
    data = data.map(v => [v.shop_id, v.name, v.修改后原价, v.修改后折扣价])
    await loop(helper, data, true)
  } catch (error) {
    console.error(error)
  }

  async function helper(ksid, id, name, price, actPrice) {
    try {
      const app = new App(id, ksid)
      const food = await app.food.findInCats(name)
      const actId = food.activities[0] ? food.activities[0].activityId : null
      if (actId) {
        console.log(actId, food.name, food.specs[0].id)
        console.log(await app.act.foodAct.invalid(actId, food.specs[0].id))
      }
      await sleep(3000)
      return updatePlan(id, name, null, null, price, actPrice)
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

async function test_autotask() {
  try {
    let tasks = {
      原价扣点折扣价: async function () {
        try {
          console.log('原价扣点折扣价')
          let task = await knx('test_task_').select().where({ title: '原价扣点折扣价', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, null, null, parseFloat(v.原价) - 1])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      两份起购餐盒费: async function () {
        try {
          console.log('两份起购餐盒费')
          let task = await knx('test_task_').select().where({ title: '两份起购餐盒费', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, 1.5, null, null])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      两份起购无餐盒费: async function () {
        try {
          console.log('两份起购无餐盒费')
          let task = await knx('test_task_').select().where({ title: '两份起购无餐盒费', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, 0.5, null, null])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      常规产品无餐盒费: async function () {
        try {
          console.log('常规产品无餐盒费')
          let task = await knx('test_task_').select().where({ title: '常规产品无餐盒费', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, 1, null, null])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      非: async function () {
        try {
          console.log('非')
          let task = await knx('test_task_').select().where({ title: '≠6.9+0.5', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.shop_id, v.name, null, 0.5, 6.9, null])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      原价餐盒凑起送: async function () {
        try {
          console.log('原价餐盒凑起送')
          let task = await knx('test_task_').select().where({ title: '原价餐盒凑起送', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, 1, 13.8, null])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      甜品粉面套餐: async function () {
        try {
          console.log('甜品粉面套餐')
          let task = await knx('test_task_').select().where({ title: '甜品粉面套餐', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, 2, 27.8, 15.8])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      贡茶粉面套餐: async function () {
        try {
          console.log('贡茶粉面套餐')
          let task = await knx('test_task_').select().where({ title: '贡茶粉面套餐', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, 2, 29.6, 15.8])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      除原价扣点加料价格: async function () {
        try {
          console.log('除原价扣点加料价格')
          let task = await knx('test_task_').select().where({ title: '除原价扣点加料价格', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, null, 0, 6, null])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      },
      两份起购起购数: async function () {
        try {
          console.log('两份起购起购数')
          let task = await knx('test_task_').select().where({ title: '两份起购起购数', platform: '饿了么' })
          if (!task) return
          let [data, _] = await knx.raw(task[0].sql)
          data = data.map(v => [v.门店id, v.品名, 2, null, null, null])
          await loop(updatePlan, data, false)
        } catch (e) {
          console.error(e)
        }
      }
    }
    await tasks['原价扣点折扣价']()
    await tasks['两份起购餐盒费']()
    await tasks['两份起购无餐盒费']()
    await tasks['常规产品无餐盒费']()
    await tasks['非']()
    await tasks['原价餐盒凑起送']()
    await tasks['甜品粉面套餐']()
    await tasks['贡茶粉面套餐']()
    await tasks['除原价扣点加料价格']()
    await tasks['两份起购起购数']()
  } catch (error) {
    console.error(error)
  }
}

async function updateAttrs(ksid, id, name, catName, props) {
  try {
    const app = new App(id, ksid)
    const food = await app.food.find2(name, catName)
    return app.food.updateFoodAttrs([food.id], props)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_updateAttrs() {
  try {
    let [data, _] = await knx.raw(
      `SELECT * FROM ele_food_manage WHERE bach_date = DATE_FORMAT(CURDATE(), '%Y%m%d') AND name LIKE '%杨枝甘露%'`
    )
    const props = [
      // { name: '温度', details: ['正常冰', '多冰', '少冰', '去冰'] },
      // { name: '甜度', details: ['正常糖', '少糖', '半糖', '多糖'] }
    ]
    data = data.map(v => [v.shop_id, v.name, v.category_name, props])
    await loop(updateAttrs, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function updateStock(ksid, id) {
  try {
    let app = new App(id, ksid)
    let cats = await app.food.listFoodCat()
    return Promise.all(
      cats.map(async cat => {
        let foods = await app.food.listFoods(cat.id)
        let stocks = foods.map(v => ({
          maxStock: 10000,
          stock: 10000,
          stockStatus: 1,
          foodId: v.id,
          foodSpecIds: v.specs.map(k => k.id)
        }))
        console.log(cat.name)
        return app.food.updateStock(stocks)
      })
    )
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_updateStock() {
  try {
    let data = await await knx('ele_info_manage').where({ status: 0 })
    data = data.map(v => [v.shop_id])
    await loop(updateStock, data, false)
  } catch (error) {
    console.error(error)
  }
}

async function sortFoodCat(ksid, id, name) {
  try {
    let app = new App(id, ksid)
    let cats = await app.food.listFoodCat()
    let targetCat = cats.filter(cat => cat.name == name)
    let catOrders = targetCat.concat(cats.filter(cat => cat.name != name)).map(cat => ({
      childrenGroupIds: [],
      parentGroupId: cat.globalId
    }))
    return app.food.updateFoodCatSeq(catOrders)
  } catch (e) {
    return Promise.reject(e)
  }
}

async function test_sortFoodCat() {
  try {
    let data = await await knx('ele_info_manage').where({ status: 0 })
    data = data.map(v => [v.shop_id, '520大行动'])
    await loop(sortFoodCat, data)
  } catch (error) {
    console.error(error)
  }
}
// test_updateSkuAttrs()
// console.log('auto task ...')
// let j = schedule.scheduleJob('59 59 23 * * *', function (fireDate) {
//   console.log('This job was supposed to run at ' + fireDate + ', but actually ran at ' + new Date())
//   // await test_autotask()
//   // test_remove()
// })

// test_updateAttrs()
// test_autotask()
// test_offsell()
// test_appeal()
// test_loglow()
// test_improve_low()
// test()
// test_plan()
// test_act()
// test_notdeliveralone()

// test_invalid_update()
// test_subsidy()
// test_loglow()
// test_improve_low()
// test_logAppeal()
// test_removeCat()
// test_rename()
// test_acttime()
// test_offsell()
// test_updateJoinHot()
// test_updateImg()
// test_updateSkuAttrs()
// test_updateStock()
// test_sortFoodCat()
