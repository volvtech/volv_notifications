const pool = require("../configs/mysqlConfig");
const clevertapController = require("./clevertapController");
const Helper = require("../utils/helpers");
var request = require('request');

async function getPublishedRepublishedArticles(req, res) {
    //Get all data from the table to display
    var fetchArticles =
      "SELECT * FROM articles where article_status='Published' OR article_status='Republished' order by updated_at desc LIMIT 0,15";
    await pool
      .getConnection()
      .then((connection) => {
        connection.changeUser({
          database: `${process.env.MYSQL_DATABASE1}`,
        });
        connection.query(fetchArticles, function (error, results, fields) {
          connection.release();
          res.render("viewArticles.ejs", {
            articles: results,
          });
        });
      })
      .catch((err) => {
        console.log("#controllers #pushNotification #getPublishedRepublishedArticles", err);
      });
}

var Promise = require("promise");

async function sendNotificationToLegacyUsers(articlePreference) {
  // This function sends the notification to Volv Legacy Users who are not on CleverTap

  var notificationArticleData;
  var fcmTokens = [];
  var usersEmail = [];
  var usersID = [];
  var NotificationResponseReport = [];
  //Query to get the articles data from database for a particular id
  let notificationArticleQuery = `SELECT * FROM articles where id = ${articlePreference[0]}`;

  pool
    .execute(notificationArticleQuery, `${process.env.MYSQL_DATABASE1}`)
    .then(([error, results, fields]) => {
      notificationArticleData = results;
      return notificationArticleData;
    })
    .then(async (notificationArticleData) => {
      if (notificationArticleData[0]["breaking_news"] == "1") {
        //Query to get all unique fcm_tokens and email asscociated with that token from database
        usersInformationQuery = `SELECT users.id,tokens.fcm_token,users.email
        FROM volv_users users
        left join app_user_notification_preferences notification
        on users.id=notification.uid
        join app_user_fcm_tokens tokens
        on users.id = tokens.uid
        where (tokens.fcm_token is not null) and (notification.breaking_news="true" or notification.breaking_news is null);`;
      } else {
        //Query to get all unique fcm_tokens and email asscociated with that token from database
        articleCategory = notificationArticleData[0]["article_category"];
        articleCategory = articleCategory.split(",").join("|");
        // console.log(articleCategory);
        usersInformationQuery = `SELECT users.id,tokens.fcm_token,users.email
                      FROM volv_users.volv_users users
                      left join app_user_notification_preferences notifications
                      on users.id=notifications.uid
                      join app_user_categories categories
                      on users.id=categories.uid
                      join app_user_fcm_tokens tokens
                      on users.id = tokens.uid 
                      where (tokens.fcm_token is not null) 
                      and 
                      (notifications.trending_headlines="true" or notifications.trending_headlines is null)
                      and 
                      (categories.categories is null or categories.categories REGEXP '${articleCategory}')`;
      }
      [err, results, fields] = await pool.execute(
        usersInformationQuery,
        `${process.env.MYSQL_DATABASE2}`
      );
      return results;
    })
    .then((usersDetail) => {
      let messages = [];
      let unqiueTokens = new Set();
      let increment = -1;
      let unqiueTokensLength = 0;
      let limit = 450;

      for (let i = 0; i < usersDetail.length; i++) {
        if (
          usersDetail[i]["fcm_token"] != "" &&
          !unqiueTokens.has(usersDetail[i]["fcm_token"])
        ) {
          unqiueTokens.add(usersDetail[i]["fcm_token"]);
          if (unqiueTokensLength % limit === 0) {
            usersID.push([usersDetail[i]["id"]]);
            fcmTokens.push([usersDetail[i]["fcm_token"]]);
            usersEmail.push([usersDetail[i]["email"]]);
            increment += 1;
          } else {
            usersID[increment].push(usersDetail[i]["id"]);
            fcmTokens[increment].push(usersDetail[i]["fcm_token"]);
            usersEmail[increment].push(usersDetail[i]["email"]);
          }
          unqiueTokensLength += 1;
        }
      }
      let start = 0;
      let end = Math.ceil(unqiueTokensLength / limit);
      articlePreference = articlePreference.toString();
      while (start < end) {
        messages.push({
          tokens: fcmTokens[start],
          content_available: true,
          mutable_content: true,
          notification: {
            body: notificationArticleData[0]["notification_text"],
          },
          android: {
            priority: "normal",
            ttl: 2224500,
          },
          apns: {
            headers: {
              "apns-priority": "5",
              "apns-expiration": "1604750400",
            },
            payload: {
              aps: {
                "content-available": 1,
              },
            },
          },
          data: {
            article_id: `(${articlePreference})`,
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            android_channel_id: "volvmedia_volvapp",
          },
        });
        start += 1;
      }
      return messages;
    })
    .then((messages) => {
      let successCount = 0;
      let failureCount = 0;
      let request = messages.map((message) =>
        admin.messaging().sendMulticast(message)
      );
      console.log(request);
      Promise.allSettled(request).then((results) => {
        console.log(results);
        for (let output = 0; output < results.length; output++) {
          fcmResults=results[output]["value"]
          if(fcmResults["responses"]){
          fcmResults["responses"].forEach((element, idx) => {
            // console.log(element)
            if (element["success"]) {
              NotificationResponseReport.push({
                notification_response: element["success"],
                userID: usersID[output][idx],
                name: usersEmail[output][idx],
              });
            } else {
              NotificationResponseReport.push({
                notification_response: element["success"],
                userID: usersID[output][idx],
                name: usersEmail[output][idx],
                errorInfo:element["error"]["errorInfo"]
              });
            }
          });
        }
          successCount += parseInt(results[output]["value"]["successCount"]);
          failureCount += parseInt(results[output]["value"]["failureCount"]);
        }
        console.log('response', NotificationResponseReport);
        notificationsReport.insertOne({
          article_id: notificationArticleData[0]["id"],
          article_image: notificationArticleData[0]["article_image"],
          article_title: notificationArticleData[0]["notification_text"],
          success_count: successCount,
          failure_count: failureCount,
          not_registered: failureCount-1,
          invalid_registration: 1,
          article_response: NotificationResponseReport,
          date: moment().format("YYYY-MM-DD HH:mm:ss"),
        },(err,docs)=>{
            if(!err){
              console.log('Inserted the document');
            }
            else{
              res.send(JSON.stringify("error"));
            }
        });
        res.send(JSON.stringify("Notification sent successfully!"));
      });
    });  
}

async function pushNotification(req, res) {
  // This function sends the push notification to all the users
try {

  var payloadData = JSON.parse(req.body.data);
  console.log("#controllers #pushNotification #pushNotification request body data:", payloadData)

  var headersTestClevertapDashboard = {
    "X-CleverTap-Account-Id": "TEST-ZW6-K9Z-556Z",
    "X-CleverTap-Passcode": "GCC-RUD-UPUL",
    "Content-Type": "application/json; charset=utf-8",
  };
  var headersLiveClevertapDashboard = {
    "X-CleverTap-Account-Id": "WW6-K9Z-556Z",
    "X-CleverTap-Passcode": "ICC-RUD-UPUL",
    "Content-Type": "application/json; charset=utf-8",
  }

  let articleIds = Object.values(payloadData?.article_ids);
  let firstArticleId = articleIds[0]
  let notificationArticleQuery = `SELECT * FROM articles where id = ${firstArticleId}`;

  pool
    .execute(notificationArticleQuery, `${process.env.MYSQL_DATABASE1}`)
    .then(([error, results, fields]) => {
      notificationArticleData = results;

      let campaignName = "";
      if(notificationArticleData[0]?.breaking_news == 1) {
        campaignName = "Breaking News Notification"
      }
      if(notificationArticleData[0]?.trending_news == 1) {
        campaignName = "Trending News Notification"
      }

      let notificationTitle = "Breaking News";
      let notificationBody = notificationArticleData[0]?.notification_text
      let articleIdsCommaSeparated = articleIds.join([separator = ','])
      let deepLink = `article_id=${articleIdsCommaSeparated}`;
      let catListString = notificationArticleData[0]?.article_category;      

      let body = `{
      "name": "${campaignName}",
      "target_mode":"push",
      "where": {
        "common_profile_properties":{
          "profile_fields": [
            {
              "name":"uid",
              "operator": "contains",
              "value": [55155, 33, 58933, 61302]
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
            "article_id":"${firstArticleId}"
          },
          "android":{
            "wzrk_cid": "volv_app_notification",
            "article_id":"${firstArticleId}"
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

      // TEST Dashboard
      var options = {
        url: "https://eu1.api.clevertap.com/1/targets/create.json",
        method: 'POST',
        headers: headersTestClevertapDashboard,
        body: body
      };

      console.log("#controllers #pushNotification #pushNotification Test Dashboard Request options:", options)

      request(options, (error, response, body)=>{
        if (!error && response?.statusCode == 200) {
          console.log("#controllers #clevertapController #createCampaign TEST Dashboard API call success response:", response?.body, "Status code:", response?.statusCode)
          // res.send({"success": true, "message": "Create CT Campaign & sent notifications successfully" })
        }else{
            if(error){
              console.log("#controllers #clevertapController #createCampaign TEST Dashboard API call failed #Error Status code:", response?.statusCode, "Error:", error.toString())
              // res.send(errorMessage)
            }else{
              console.log("#controllers #clevertapController #createCampaign TEST Dashboard API call failed #Error Status code:", response?.statusCode)
              // res.send(errorMessage)
            }
          }
      })

      // Live Dashboard
      var options = {
        url: "https://eu1.api.clevertap.com/1/targets/create.json",
        method: 'POST',
        headers: headersLiveClevertapDashboard,
        body: body
      };

      console.log("#controllers #pushNotification #pushNotification Live Dashboard Request options:", options)

      request(options, (error, response, body)=>{
        if (!error && response?.statusCode == 200) {
          console.log("#controllers #clevertapController #createCampaign LIVE Dashboard API call success response:", response?.body, "Status code:", response?.statusCode)
          // res.send({"success": true, "message": "Create CT Campaign & sent notifications successfully" })
        }else{
            if(error){
              console.log("#controllers #clevertapController #createCampaign LIVE Dashboard API call failed #Error Status code:", response?.statusCode, "Error:", error.toString())
              // res.send(errorMessage)
            }else{
              console.log("#controllers #clevertapController #createCampaign LIVE Dashboard API call failed #Error Status code:", response?.statusCode)
              // res.send(errorMessage)
            }
          }
      });        

      // Legacy Users
      // console.log("Legacy Users**")
      // var notificationArticleData;
      // var fcmTokens = [];
      // var usersEmail = [];
      // var usersID = [];
      // var NotificationResponseReport = [];
      // //Query to get the articles data from database for a particular id
      // let notificationArticleQuery1 = `SELECT * FROM articles where id = ${firstArticleId}`;

      // pool
      //   .execute(notificationArticleQuery1, `${process.env.MYSQL_DATABASE1}`)
      //   .then(([error, results, fields]) => {
      //     notificationArticleData = results;
      //     return notificationArticleData;
      //   })
      //   .then(async (notificationArticleData) => {
      //     if (notificationArticleData[0]["breaking_news"] == "1") {
      //       //Query to get all unique fcm_tokens and email asscociated with that token from database
      //       usersInformationQuery = `SELECT users.id,tokens.fcm_token,users.email
      //       FROM volv_users users
      //       left join app_user_notification_preferences notification
      //       on users.id=notification.uid
      //       join app_user_fcm_tokens tokens
      //       on users.id = tokens.uid
      //       where (tokens.fcm_token is not null) and (notification.breaking_news="true" or notification.breaking_news is null);`;
      //     } else {
      //       //Query to get all unique fcm_tokens and email asscociated with that token from database
      //       articleCategory = notificationArticleData[0]["article_category"];
      //       articleCategory = articleCategory.split(",").join("|");
      //       // console.log(articleCategory);
      //       usersInformationQuery = `SELECT users.id,tokens.fcm_token,users.email
      //                     FROM volv_users.volv_users users
      //                     left join app_user_notification_preferences notifications
      //                     on users.id=notifications.uid
      //                     join app_user_categories categories
      //                     on users.id=categories.uid
      //                     join app_user_fcm_tokens tokens
      //                     on users.id = tokens.uid 
      //                     where (tokens.fcm_token is not null) 
      //                     and 
      //                     (notifications.trending_headlines="true" or notifications.trending_headlines is null)
      //                     and 
      //                     (categories.categories is null or categories.categories REGEXP '${articleCategory}')`;
      //     }
      //     [err, results, fields] = await pool.execute(
      //       usersInformationQuery,
      //       `${process.env.MYSQL_DATABASE2}`
      //     );
      //     return results;
      //   })
      //   .then((usersDetail) => {
      //     let messages = [];
      //     let unqiueTokens = new Set();
      //     let increment = -1;
      //     let unqiueTokensLength = 0;
      //     let limit = 450;

      //     for (let i = 0; i < usersDetail.length; i++) {
      //       if (
      //         usersDetail[i]["fcm_token"] != "" &&
      //         !unqiueTokens.has(usersDetail[i]["fcm_token"])
      //       ) {
      //         unqiueTokens.add(usersDetail[i]["fcm_token"]);
      //         if (unqiueTokensLength % limit === 0) {
      //           usersID.push([usersDetail[i]["id"]]);
      //           fcmTokens.push([usersDetail[i]["fcm_token"]]);
      //           usersEmail.push([usersDetail[i]["email"]]);
      //           increment += 1;
      //         } else {
      //           usersID[increment].push(usersDetail[i]["id"]);
      //           fcmTokens[increment].push(usersDetail[i]["fcm_token"]);
      //           usersEmail[increment].push(usersDetail[i]["email"]);
      //         }
      //         unqiueTokensLength += 1;
      //       }
      //     }
      //     let start = 0;
      //     let end = Math.ceil(unqiueTokensLength / limit);
      //     articlePreference = articlePreference.toString();
      //     while (start < end) {
      //       messages.push({
      //         tokens: fcmTokens[start],
      //         content_available: true,
      //         mutable_content: true,
      //         notification: {
      //           body: notificationArticleData[0]["notification_text"],
      //         },
      //         android: {
      //           priority: "normal",
      //           ttl: 2224500,
      //         },
      //         apns: {
      //           headers: {
      //             "apns-priority": "5",
      //             "apns-expiration": "1604750400",
      //           },
      //           payload: {
      //             aps: {
      //               "content-available": 1,
      //             },
      //           },
      //         },
      //         data: {
      //           article_id: `(${articlePreference})`,
      //           click_action: "FLUTTER_NOTIFICATION_CLICK",
      //           android_channel_id: "volvmedia_volvapp",
      //         },
      //       });
      //       start += 1;
      //     }
      //     return messages;
      //   })
      //   .then((messages) => {
      //     // let request = messages.map((message) =>
      //     //   admin.messaging().sendMulticast(message)
      //     // );
      //     // Promise.allSettled(request).then((results) => {
      //       // console.log("#Controllers #pusNotification Notification sent successfully to legacy users", messages)
      //       //   res.send(JSON.stringify("Notification sent successfully!"));
      //     // });
      //   });


  })
} catch (ex) {
    let errorMessage = {"success": false, "message": "Notification send failed on Test CleverTap Dashboard" }
    console.log("#controllers #clevertapController #createCampaign API call Exception:", ex.toString())
    return errorMessage;
  }



  // Sends the notification to Volv Legacy Users who are not on CleverTap
  // sendNotificationToLegacyUsers(articlePreference)

  res.send(JSON.stringify("Notification sent successfully!"));

}



async function article_delete(req, res) {
  let article_id = req.params.id;
  let deleteArticle = `DELETE FROM articles where id=${article_id}`;

  await pool
    .getConnection()
    .then((connection) => {
      connection.changeUser({
        database: `${process.env.MYSQL_DATABASE1}`,
      });

      connection.query(deleteArticle, function (error, results, fields) {
        connection.release();

        if (error) {
          res.send("error");
        } else {
          res.send(JSON.stringify("success"));
        }
      });
    })
    .catch((err) => {
      console.log("err", err);
    });
}

async function article_update(req, res) {
  let article_id = req.params.id;
  let article_status = JSON.parse(req.body.data);

  let updateArticle = `UPDATE articles SET article_status='${article_status}' , updated_at='${moment().format(
    "YYYY-MM-DD HH:mm:ss"
  )}' where id=${article_id}`;

  await pool
    .getConnection()
    .then((connection) => {
      connection.changeUser({
        database: `${process.env.MYSQL_DATABASE1}`,
      });

      connection.query(updateArticle, function (error, results, fields) {
        connection.release();
        if (error) {
          res.send("error");
        } else {
          res.send(JSON.stringify("success"));
        }
      });
    })
    .catch((err) => {
      console.log("err", err);
    });
}

//Ajax request on articles scroll/loading
async function scroll_articles(req, res) {
  start_index = Number(req.params.data);
  var fetchNextArticles = `SELECT * FROM articles where article_status='Published' OR article_status='Republished' order by updated_at desc LIMIT ${start_index},15`;
  await pool
    .getConnection()
    .then((connection) => {
      connection.changeUser({
        database: `${process.env.MYSQL_DATABASE1}`,
      });

      connection.query(fetchNextArticles, function (error, results, fields) {
        connection.release();

        if (error) {
          res.send("Error while fetching");
        }

        res.render("articles_load.ejs", {
          articles: results,
        });
      });
    })
    .catch((err) => {
      console.log("err", err);
    });
}
  


  module.exports = {
    getPublishedRepublishedArticles,
    pushNotification,
    scroll_articles,
    article_delete,
    article_update,
    // usersStats,
    // notificationStats,
    // notificationReport,
    // notificationReportStats,
    // testQuery,
  };