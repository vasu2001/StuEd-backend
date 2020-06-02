const teacherSlotRouter = require("express").Router();
const AWS = require("aws-sdk");
//import {v4 as uuidv4} from 'uuid'
const uuidv4 = require("uuid").v4;

const dynamodb = new AWS.DynamoDB({
     region: "local",
     endpoint: "http://127.0.0.1:8000",
     accessKeyId: "key",
     secretAccessKey: "secret",
});

teacherSlotRouter.get("/slotsList", (req, res) => {
     const userId = res.locals.Username; //cognito may provide it

     var params = (tableName) => ({
          TableName: tableName.toString(),
          KeyConditionExpression: "teacherId = :name",
          ExpressionAttributeValues: {
               ":name": {
                    S: userId,
               },
          },
     });

     var slotPromise = dynamodb.query(params("slotHashTable")).promise();
     var pastSlotPromise = dynamodb
          .query(params("pastSlotHashTable"))
          .promise();
     var payload = [];

     Promise.all([slotPromise, pastSlotPromise]).then(
          (data) => {
               data[0].Items.forEach((ele) =>
                    payload.push({
                         subject: ele.subject.S,
                         topicName: ele.topicName.S,
                         slotTime: ele.slotTime.S,
                         slotId: ele.slotId.S,
                         validated: ele.validated.N,
                         currentStudents: ele.currentStudents.N,
                         maxStudents: ele.maxStudents.N,
                         status: "upcoming",
                    })
               );

               data[1].Items.forEach((ele) =>
                    payload.push({
                         subject: ele.subject.S,
                         topicName: ele.topicName.S,
                         slotTime: ele.slotTime.S,
                         slotId: ele.slotId.S,
                         validated: ele.validated.N,
                         status: "past",
                    })
               );

               res.send(payload);
          },
          (err) => res.status(500).send({ error: "server error", payload: err })
     );
});

teacherSlotRouter.get("/slotDetails", (req, res) => {
     if (!req.body.slotId)
          res.status(400).send({ error: "must provide slotId" });
     var params = {
          TableName: "slotTable",
          Key: {
               slotId: { S: req.body.slotId },
          },
     };
     dynamodb.getItem(params, (err, data) => {
          if (err) res.status(500).send({ error: "server error" });
          else
               res.send({
                    slotId: data.Item.slotId.S,
                    fees: parseInt(data.Item.fees.N),
                    venue1: data.Item.venue1.S,
                    venue2: data.Item.venue2.S,
                    genderPreference: data.Item.genderPreference.S,
                    topicDesc: data.Item.topicDesc.S,
                    estMarks: parseInt(data.Item.estMarks.N),
                    estTime: data.Item.estTime.S,
               });
     });
});

teacherSlotRouter.get("/studentList", (req, res) => {
     if (!req.body.slotId)
          res.status(400).send({ error: "must provide slotId" });

     var params = {
          TableName: "paymentTable",
          IndexName: "studentList",
          KeyConditionExpression: "slotId = :name",
          ProjectionExpression: "userId,OTP",
          ExpressionAttributeValues: {
               ":name": {
                    S: req.body.slotId,
               },
          },
     };

     dynamodb.query(params, (err, data) => {
          if (err) res.status(500).send({ error: "server error" });
          else {
               var validated = {};
               var paramameters = {
                    RequestItems: {
                         phoneNoTable: {
                              Keys: data.Items.map((ele) => {
                                   validated[ele.userId.S] = !(
                                        ele.OTP.S.length == 4
                                   );
                                   return { userId: ele.userId };
                              }),
                         },
                    },
               };

               dynamodb.batchGetItem(paramameters, (error, nameData) => {
                    if (error) res.status(500).send({ error: "server error2" });
                    var payload = [];
                    nameData.Responses.phoneNoTable.forEach((ele) =>
                         payload.push({
                              userId: ele.userId.S,
                              phoneNo: ele.phoneNo.S,
                              validated: validated[ele.userId.S],
                              name: ele.name.S,
                         })
                    );
                    res.send(payload);
               });
          }
     });
});

teacherSlotRouter.post("/verifyotp", (req, res) => {
     if (!req.body.slotId || !req.body.userId || !req.body.OTP)
          res.status(400).send({
               error: "must provide slotId and userId and OTP to validate",
          });

     var params = {
          TableName: "paymentTable",
          Key: {
               slotId: { S: req.body.slotId },
               userId: { S: req.body.userId },
          },
          ConditionExpression: "OTP = :otp",
          ExpressionAttributeValues: {
               ":otp": { S: req.body.OTP },
               ":value": { S: "-1" },
          },
          UpdateExpression: "SET OTP = :value",
     };

     dynamodb.updateItem(params, (err, data) => {
          if (err) {
               if (err.message === "The conditional request failed")
                    res.status(400).send({ error: "wrong OTP" });
               else res.status(500).send({ error: "server error" });
          } else {
               res.send(data);
          }
     });
});

teacherSlotRouter.post("/startslot", (req, res) => {
     if (!req.body.slotId)
          res.status(400).send({ error: "must provide slotId" });

     var teacherId = res.locals.Username; //cognito here

     //modify validated to 0 in slotHashTable
     var params = {
          TableName: "slotHashTable",
          Key: {
               teacherId: { S: teacherId },
               slotId: { S: req.body.slotId },
          },
          UpdateExpression: "SET validated = :value",
          ConditionExpression: "validated = :validate",
          ExpressionAttributeValues: {
               ":value": { N: "0" },
               ":validate": { N: "-1" },
          },
     };
     dynamodb.updateItem(params, (err, data) => {
          if (err) {
               if (err.code == "ConditionalCheckFailedException")
                    res.send({ status: "slot was already started" });
               else
                    res.status(500).send({
                         error: "server error",
                         payload: err,
                    });
          } else res.send({ status: "slot started" });
     });
});

teacherSlotRouter.post("/endslot", (req, res) => {
     if (!req.body.slotId)
          res.status(400).send({ error: "must provide slotId" });

     const teacherId = res.locals.Username; //cognito userId here

     var params = {
          TableName: "paymentTable",
          KeyConditionExpression: "slotId = :slotid",
          ExpressionAttributeValues: {
               ":slotid": { S: req.body.slotId },
          },
          IndexName: "studentList",
          ProjectionExpression: "userId,OTP",
     };
     var calculateValidatedPromise = dynamodb.query(params).promise();

     var param = {
          TableName: "slotHashTable",
          Key: {
               teacherId: { S: teacherId },
               slotId: { S: req.body.slotId },
          },
          ReturnValues: "ALL_OLD",
     };
     var deleteFromHashPromise = dynamodb.deleteItem(param).promise();

     Promise.all([calculateValidatedPromise, deleteFromHashPromise]).then(
          (data) => {
               var validated = 0;
               data[0].Items.forEach((ele) => {
                    //console.log("data0 reading")
                    if (ele.OTP.S.length == 4) {
                         var paramameters = {
                              TableName: "paymentTable",
                              Key: {
                                   userId: ele.userId,
                                   slotId: { S: req.body.slotId },
                              },
                              UpdateExpression: "SET OTP = :otp",
                              ExpressionAttributeValues: {
                                   ":otp": { S: "0" },
                              },
                         };
                         dynamodb.updateItem(paramameters, (err, data) => {
                              if (err)
                                   res.send(500).send({
                                        error1: "server error",
                                   });
                         });
                    } else {
                         validated = validated + 1;
                    }
               });
               //console.log(validated.toString())
               //console.log(data)
               var params = {
                    TableName: "pastSlotHashTable",
                    Item: {
                         ...data[1].Attributes,
                         validated: { N: validated.toString() },
                    },
               };
               dynamodb.putItem(params, (error, data) => {
                    if (error)
                         res.status(500).send({
                              error: "slot doesnot exist or is already ended",
                         });
                    else res.send({ status: "done" });
               });
          },
          (err) => {
               res.status(400).send({ error: "server error3" });
          }
     );
});

teacherSlotRouter.post("/createSlot", (req, res) => {
     if (
          !req.body.fees ||
          !req.body.maxStudents ||
          !req.body.slotTime ||
          !req.body.subject ||
          !req.body.topicName ||
          !req.body.venue1 ||
          !req.body.venue2 ||
          !req.body.genderPreference ||
          !req.body.topicDesc ||
          !req.body.estMarks ||
          !req.body.estTime
     )
          res.status(400).send({ error: "incomplete form data" });

     var teacherId = res.locals.Username; //cognito here
     var slotId = uuidv4();

     var params = {
          RequestItems: {
               slotHashTable: [
                    {
                         PutRequest: {
                              Item: {
                                   slotId: { S: slotId },
                                   subject: { S: req.body.subject },
                                   topicName: { S: req.body.topicName },
                                   teacherId: { S: teacherId },
                                   validated: { N: "-1" },
                                   currentStudents: { N: "0" },
                                   maxStudents: {
                                        N: req.body.maxStudents.toString(),
                                   },
                                   slotTime: { S: req.body.slotTime },
                              },
                         },
                    },
               ],
               slotTable: [
                    {
                         PutRequest: {
                              Item: {
                                   slotId: { S: slotId },
                                   fees: { N: req.body.fees.toString() },
                                   venue1: { S: req.body.venue1 },
                                   venue2: { S: req.body.venue2 },
                                   genderPreference: {
                                        S: req.body.genderPreference,
                                   },
                                   topicDesc: { S: req.body.topicDesc },
                                   estMarks: {
                                        N: req.body.estMarks.toString(),
                                   },
                                   estTime: { S: req.body.estTime },
                              },
                         },
                    },
               ],
          },
     };
     dynamodb.batchWriteItem(params, (err, data) => {
          if (err) res.status(500).send({ error: "server error" });
          else res.send({ slotId });
     });
});

teacherSlotRouter.post("/updateVenue", (req, res) => {
     if (!req.body.newVenue || !req.body.slotId) {
          res.status(400).send({ error: "provide new venue and slotId" });
          return;
     }

     var params = {
          TableName: "slotTable",
          Key: {
               slotId: { S: req.body.slotId },
          },
          UpdateExpression: "SET venue1 = :newVenue",
          ExpressionAttributeValues: {
               ":newVenue": { S: req.body.newVenue },
          },
     };
     dynamodb.updateItem(params, (err, data) => {
          if (err) res.status(500).send({ error: "server error" });
          else res.send({ status: "venue changed successfully" });
     });
});

teacherSlotRouter.post("/updateTime", (req, res) => {
     if (!req.body.newTime || !req.body.slotId) {
          res.status(400).send({ error: "provide new time and slotId" });
          return;
     }

     var params = {
          TableName: "slotHashTable",
          Key: {
               slotId: { S: req.body.slotId },
               teacherId: { S: res.locals.Username },
          },
          UpdateExpression: "SET slotTime = :newTime",
          ExpressionAttributeValues: {
               ":newTime": { S: req.body.newTime },
          },
     };
     dynamodb.updateItem(params, (err, data) => {
          if (err) res.status(500).send({ error: "server error" });
          else res.send({ status: "time changed successfully" });
     });
});

teacherSlotRouter.post("/updateMaxStudents", (req, res) => {
     if (!req.body.newMaxStudents || !req.body.slotId) {
          res.status(400).send({
               error: "provide new max students and slotId",
          });
          return;
     }

     var params = {
          TableName: "slotHashTable",
          Key: {
               slotId: { S: req.body.slotId },
               teacherId: { S: res.locals.Username },
          },
          UpdateExpression: "SET maxStudents = :newMax",
          ExpressionAttributeValues: {
               ":newMax": { N: req.body.newMaxStudents.toString() },
          },
     };
     dynamodb.updateItem(params, (err, data) => {
          if (err) res.status(500).send({ error: "server error" });
          else res.send({ status: "maxStudents changed successfully" });
     });
});

module.exports = teacherSlotRouter;
