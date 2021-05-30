const urls = {
  food: {
    search: 'nevermore.goods/invoke/?method=FoodService.getItemForSearch',
    updateAttr: 'nevermore.goods/invoke/?method=FoodService.updateGoodsAttr',
    updateStock: 'nevermore.goods/invoke/?method=FoodService.updateFoodsStock',
    batchRemove: 'nevermore.goods/invoke/?method=FoodService.batchRemoveFoods',
    updateFoodCatSeq: 'nevermore.goods/invoke/?method=FoodService.setGroupPosition',
    listFoodCat: 'nevermore.goods/invoke/?method=FoodService.queryCategoryWithFoodFilter',
    removeCat: 'nevermore.goods/invoke/?method=FoodService.removeGroupByGroupId',
    listFoods: 'nevermore.goods/invoke/?method=FoodService.queryFoodsByCategoryIdWithFoodFilter',
    batchUpdate: 'nevermore.goods/invoke/?method=BatchFoodService.batchUpdateFood',
    bupdatePackageFee: 'nevermore.goods/invoke/?method=FoodService.batchUpdatePackageFee',
    bupdateSell: 'nevermore.goods/invoke/?method=FoodService.batchUpdateSellStatus',
    getFoodView: 'nevermore.goods/invoke/?method=FoodService.getFoodView',
    editFood: 'nevermore.goods/invoke/?method=FoodService.updateFood',
    forOptimize: 'nevermore.goods/invoke/?method=AssistantService.queryWaitForOptimizeItem',
    categoryModels: 'nevermore.goods/invoke/?method=CategoryService.getCategoryList',
    getMaterialTree: 'nevermore.goods/invoke/?method=MenuDataService.getMaterialTreeByShopId',
    appeal: 'nevermore.goods/invoke/?method=IllegalItemService.appealForControl',
    neverAppeal: 'nevermore.goods/invoke/?method=IllegalItemService.neverShowAuditTips',
    updateCat: 'nevermore.goods/invoke/?method=FoodService.updateFirstGroup',
    updateImg: 'nevermore.goods/invoke/?method=ItemPhotoService.updateItemPhotoHash'
  },
  act: {
    foodAct: {
      invalid: 'marketing/invoke/?method=ActivityNcpService.invalidActivity',
      create: 'marketing/invoke/?method=SkuActivityNcpService.createAndParticipatePriceActivity',
      content: 'marketing/invoke/?method=SkuActivityNcpService.getSkuActivityContent',
      list: 'marketing/invoke/?method=MarketingCenterService.getFoods',
      updateCount: 'marketing/invoke/?method=ActivityShowService.updateShopShareMaxCount',
      getCount: 'marketing/invoke/?method=ActivityRegulationService.getMaxActivitySkuCountPerOrderRule',
      update: 'marketing/invoke/?method=SkuActivityNcpService.updateSkuActivityItem',
      listFlowAct: 'zelda/CampaignNaposService/pageQuerySubCampaignWithApply?currentPage=1&pageSize=10&applyStatusSet=%5B%22APPROVED%22%5D'
    },
    foodAct2: {
      create: 'marketing/invoke/?method=SkuActivityManageService.createSingleExchangeSkuActivity',
      bind: 'marketing/invoke/?method=SkuActivityManageService.bindSingleSkuActivity'
    },
    deliverAct: {
      getForm: 'play.everything/PlayInstanceService/getSelfPlayForm',
      saveForm: 'activity-tool/updateSelfPlay',
      invalid: 'activity-tool/invalidActivityByInstanceId',
      create: 'activity-tool/createSelfPlay',
      withdraw: 'zelda/withdraw-napos-apply'
    },
    subsidy: {
      globalId: 'zelda/query-global-id',
      getInfo: 'zelda/getPlayInstanceInfoById',
      modify: 'zelda/melody/modifyPlayRule'
    },
    list: 'marketing/invoke/?method=MarketingCenterService.getActivities'
  },
  shop: {
    list: 'shop/invoke/?method=shop.getRestaurantTree',
    updateAct: 'marketing/invoke/?method=ShopActivityNcpService.updateShopActivityInfoWithAutoDelay',
    getAct: 'marketing/invoke/?method=ShopActivityNcpService.getShopActivityDetail',
    listActs: 'marketing/invoke/?method=MarketingCenterService.getActivities'
  }
}

export default urls