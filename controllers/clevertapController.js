const Helper = require("../utils/helpers");
var request = require('request');

let createCampaign = function(headers, articlePreference) {
  // This function creates a campaign on CT Dashboard & sends the notification
    try {
      console.log("#controllers #clevertapController #createCampaign headers:", headers, "articlePreference: ", articlePreference)

      let campaignName = articlePreference.campaign_name 
      let articleId = articlePreference.articleId 
      let deepLink = 'article_id=0'
      let categoryList = articlePreference.categories

      let notificationTitle = articlePreference.notificationTitle 
      let notificationBody = articlePreference.notificationBody 

      let formattedList = categoryList.map((value)=>`"${value}"`)
      let catListString = formattedList.join(",")
      let body = `{
        "name": "${campaignName}",
        "target_mode":"push",
        "where": {
          "common_profile_properties":{
            "profile_fields": [
              {
                "name":"uid",
                "operator": "equals",
                "value": "58933"
              }
            ]
          }
        },
        "content":{
          "title": "${notificationTitle}",
          "body": "${notificationBody}",
          "platform_specific": {
            "ios":{
              "mutable-content": "true", 
              "deep_link": "${deepLink}",
              "article_id":"${articleId}"
            },
            "android":{
              "wzrk_cid": "volv_app_notification",
              "article_id":"${articleId}"
            }
          }
        },
        "devices": [
          "android",
          "ios"
      ],
      "users_limit_overall": 1000,
      "when": "now"
      }`
  
      var options = {
        url: "https://eu1.api.clevertap.com/1/targets/create.json",
        method: 'POST',
        headers: headers,
        body:body
      };
      console.log("#controllers #clevertapController #createCampaign options:", options, "body: ", body)


      let errorMessage = {"success": false, "message": "Notification send failed on CleverTap Dashboard" }


        request(options, (error, response, body)=>{
          if (!error && response?.statusCode == 200) {
            console.log("#controllers #clevertapController #createCampaign API call success response:", response?.body, "Status code:", response?.statusCode)
            // return response.body
            return {"success": true, "message": "Create CT Campaign & sent notifications successfully" }
          }else{
              if(error){
                console.log("#controllers #clevertapController #createCampaign API call failed #Error Status code:", response?.statusCode, "Error:", error.toString())
                return errorMessage;
  
              }else{
                console.log("#controllers #clevertapController #createCampaign API call failed #Error Status code:", response?.statusCode)
                return errorMessage;
              }
            }
        });
  
        

    } catch (ex) {
      console.log("#controllers #clevertapController #createCampaign API call Exception:", ex.toString())
      return errorMessage;
    }
}

module.exports= {
  createCampaign
}
