const express = require("express");
const router = express.Router();
const pushController=require("../controllers/pushNotification");

// Routes Starts Here
router.get("/getPublishedRepublishedArticles", pushController.getPublishedRepublishedArticles);

router.post("/pushnotication/", pushController.pushNotification);

router.get('/scroll_articles/:data',pushController.scroll_articles);

router.get("/delete_article/:id", pushController.article_delete);

router.post("/update_article/:id", pushController.article_update);

// router.get("/user_stats", pushController.usersStats);

// router.get("/notification_stats", pushController.notificationStats);

// router.get("/notification_report/", pushController.notificationReport);

// router.get("/notification_report/stats/:article_id/:_id?",pushController.notificationReportStats);

// router.get("/test_query", pushController.testQuery);
//Routes End Here

module.exports = router;
