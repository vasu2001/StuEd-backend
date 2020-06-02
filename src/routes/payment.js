const paymentRouter = require("express").Router();
const AWS = require("aws-sdk");
const request = require("request");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB({
     region: "local",
     endpoint: "http://127.0.0.1:8000",
     accessKeyId: "key",
     secretAccessKey: "secret",
});

const key = "rzp_live_pPorDHaVALJCSC";
const key_secret = "H8aB2Bj9HiuBcQ5x4XGZxZ5y";

paymentRouter.post("/orderApi", (req, res) => {
     if (!req.body.amount) {
          res.status(400).send({ error: "must provide amount" });
          return;
     }
     const amount = req.body.amount;
     var options = {
          method: "POST",
          url: "https://api.razorpay.com/v1/orders",
          headers: {
               Authorization:
                    "Basic " +
                    new Buffer(key + ":" + key_secret).toString("base64"),
          },
          form: {
               amount: amount,
               currency: "INR",
               receipt: "dqwertyuioplkjhasdfcbn",
               payment_capture: 1,
          },
     };

     request(options, function (error, response, body) {
          if (error) throw new Error(error);

          res.send(body);
     });
});

paymentRouter.post("/paymentSuccessful", (req, res) => {
     if (
          !req.body.order.razorpay_order_id ||
          !req.body.order.razorpay_payment_id ||
          !req.body.order.razorpay_signature ||
          !req.body.slotId ||
          !req.body.teacherId
     ) {
          res.status(400).send({ error: "bad request" });
          return;
     }
     const order = req.body.order;
     const text = order.razorpay_order_id + "|" + order.razorpay_payment_id;
     var signature = crypto
          .createHmac("sha256", key)
          .update(text)
          .digest("hex");

     if (signature === order.razorpay_signature) {
          //payment successful
          var OTP = Math.floor(Math.random() * 10000).toString();
          var params1 = {
               TableName: "paymentTable",
               Item: {
                    userId: { S: res.locals.Username },
                    slotId: { S: req.body.slotId },
                    paymentId: { S: order.razorpay_payment_id },
                    OTP: { S: OTP },
                    teacherId: { S: req.body.teacherId },
               },
          };
          var paymentTablePromise = dynamodb.putItem(params1).promise();

          var params2 = {
               TableName: "slotHashTable",
               Key: {
                    teacherId: { S: req.body.teacherId },
                    slotId: { S: req.body.slotId },
               },
               UpdateExpression: "ADD currentStudents :one",
               ExpressionAttributeValues: {
                    ":one": { N: "1" },
               },
          };
          var slotHashTablePromise = dynamodb.updateItem(params2).promise();

          Promise.all([paymentTablePromise, slotHashTablePromise]).then(
               (data) => {
                    res.send({ status: "slot booked successfully", OTP });
               },
               (err) => {
                    res.status(500).send({ error: "server error" });
               }
          );
     } else {
          res.status(400).send({ error: "payment was unsuccessful" });
     }
});

module.exports = paymentRouter;
