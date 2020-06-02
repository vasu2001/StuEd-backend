const studentSlotRouter = require("express").Router();
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB({
     region: "local",
     endpoint: "http://127.0.0.1:8000",
     accessKeyId: "key",
     secretAccessKey: "secret",
});

studentSlotRouter.get(
     "/slotsList",
     (req, res, next) => {
          var userId = res.locals.Username; //maybe cognito provide it future reference

          var params = {
               TableName: "paymentTable",
               KeyConditionExpression: "userId = :name",
               ExpressionAttributeValues: {
                    ":name": {
                         S: userId,
                    },
               },
          };

          dynamodb.query(params, (err, data) => {
               if (err) res.status(500), send({ error: "server error" });
               else {
                    res.locals.payload = {};
                    data.Items.forEach(
                         (object) =>
                              (res.locals.payload[object.slotId.S] = {
                                   OTP: object.OTP.S,
                                   paymentId: object.paymentId.S,
                                   teacherId: object.teacherId.S,
                              })
                    );
                    //res.send(payload)
                    if (Object.keys(res.locals.payload).length == 0)
                         res.send([]);
                    next();
               }
          });
     },
     (req, res) => {
          var params = {
               RequestItems: {
                    slotHashTable: {
                         Keys: [],
                    },
                    pastSlotHashTable: {
                         Keys: [],
                    },
               },
          };
          Object.keys(res.locals.payload).forEach((slotId) => {
               var element = res.locals.payload[slotId];
               params.RequestItems[
                    element.OTP.length == 4
                         ? "slotHashTable"
                         : "pastSlotHashTable"
               ].Keys.push({
                    teacherId: {
                         S: element.teacherId,
                    },
                    slotId: {
                         S: slotId,
                    },
               });
          });

          if (params.RequestItems.pastSlotHashTable.Keys.length == 0)
               delete params.RequestItems.pastSlotHashTable;

          dynamodb.batchGetItem(params, (err, data) => {
               if (err) res.status(500).send({ error: "server error2" });
               else {
                    var addAttributes = (element) => {
                         res.locals.payload[element.slotId.S] = {
                              ...res.locals.payload[element.slotId.S],
                              subject: element.subject.S,
                              topicName: element.topicName.S,
                              slotTime: element.slotTime.S,
                         };
                    };
                    Object.keys(data.Responses).forEach((tableName) =>
                         data.Responses[tableName].forEach(addAttributes)
                    );

                    res.send(res.locals.payload);
               }
          });
     }
);

//functionality implemented in previous endpoint
studentSlotRouter.get("/slotMicroInfo", (req, res) => {
     if (!req.body.slotId || !req.body.teacherId || !req.body.OTP)
          res.status(400).send({ error: "bad request" });

     var params = {
          TableName:
               req.body.OTP.length == 4 ? "slotHashTable" : "pastSlotHashTable",
          Key: {
               teacherId: {
                    S: req.body.teacherId,
               },
               slotId: {
                    S: req.body.slotId,
               },
          },
     };

     dynamodb.getItem(params, (err, data) => {
          if (err) res.status(500).send({ error: "servererror" });
          else {
               var payload = {
                    subject: data.Item.subject.S,
                    topicName: data.Item.topicName.S,
                    slotTime: data.Item.slotTime.S,
               };
               res.send(payload);
          }
     });
});

studentSlotRouter.get("/slotDetails", (req, res) => {
     if (!req.body.slotId || !req.body.teacherId) {
          res.status(400).send({ error: "must provide slotId and teacherId" });
          return;
     }
     var params = {
          RequestItems: {
               slotTable: {
                    Keys: [
                         {
                              slotId: { S: req.body.slotId },
                         },
                    ],
               },
               phoneNoTable: {
                    Keys: [
                         {
                              userId: { S: req.body.teacherId },
                         },
                    ],
               },
          },
     };
     dynamodb.batchGetItem(params, (err, data) => {
          if (
               err ||
               !data.Responses.slotTable[0] ||
               !data.Responses.phoneNoTable[0]
          )
               res.status(500).send({ error: "server error" });
          else
               res.send({
                    slotId: data.Responses.slotTable[0].slotId.S,
                    fees: parseInt(data.Responses.slotTable[0].fees.N),
                    venue1: data.Responses.slotTable[0].venue1.S,
                    venue2: data.Responses.slotTable[0].venue2.S,
                    genderPreference:
                         data.Responses.slotTable[0].genderPreference.S,
                    topicDesc: data.Responses.slotTable[0].topicDesc.S,
                    estMarks: parseInt(data.Responses.slotTable[0].estMarks.N),
                    estTime: data.Responses.slotTable[0].estTime.S,
                    phoneNo: data.Responses.phoneNoTable[0].phoneNo.S,
                    teacherName: data.Responses.phoneNoTable[0].name.S,
               });
     });
});

studentSlotRouter.post("/review", (req, res) => {
     if (!req.body.slotId || !req.body.rating) {
          res.status(400).send({ error: "provide slotId and rating" });
          return;
     }

     var userId = res.locals.Username; //cognito here

     var params = {
          TableName: "paymentTable",
          ConditionExpression: "OTP = :otp",
          Key: {
               userId: { S: userId },
               slotId: { S: req.body.slotId },
          },
          ExpressionAttributeValues: {
               ":otp": { S: "-1" },
               ":rating": { S: req.body.rating.toString() },
          },
          UpdateExpression: "SET OTP = :rating",
          ReturnValues: "ALL_NEW",
     };
     dynamodb.updateItem(params, (err, data) => {
          if (err) {
               res.status(500).send({
                    error: "server error or rating already submitted",
               });
               return;
          }

          var params2 = {
               TableName: "reviewTable",
               Key: {
                    userId: data.Attributes.teacherId,
               },
               UpdateExpression: "ADD rating :rating , noOfRating :one",
               ExpressionAttributeValues: {
                    ":rating": { N: req.body.rating.toString() },
                    ":one": { N: "1" },
               },
          };
          dynamodb.updateItem(params2, (err, data) => {
               if (err) {
                    res.status(500).send({
                         error: "server error",
                    });
                    return;
               }
               res.send({ status: "review submitted" });
          });
     });
});

module.exports = studentSlotRouter;
