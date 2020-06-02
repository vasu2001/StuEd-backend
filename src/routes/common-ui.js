const commonRouter = require("express").Router();
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB({
     region: "local",
     endpoint: "http://127.0.0.1:8000",
     accessKeyId: "key",
     secretAccessKey: "secret",
});

commonRouter.get("/subjectlist", (req, res) => {
     if (!req.body.semester || !req.body.branch)
          res.status(400).send({ error: "Must provide arguements" });

     var params = {
          TableName: "subjectListTable",
          Key: {
               Branch: {
                    S: req.body.branch,
               },
               Semester: {
                    N: req.body.semester,
               },
          },
     };

     dynamodb.getItem(params, (err, data) => {
          if (err) res.status(500).send(err);
          else {
               const rawObjects = data.Item["subjectList"].L;
               var subjectList = rawObjects.map((object) => object.S);
               res.send(subjectList);
          }
     });
});

commonRouter.get("/topicNames", (req, res) => {
     if (!req.body.subject)
          res.status(400).send({ error: "provide a subject" });

     var params = {
          TableName: "slotHashTable",
          IndexName: "forSubject",
          KeyConditionExpression: "subject = :name",
          ExpressionAttributeValues: {
               ":name": {
                    S: req.body.subject,
               },
          },
     };

     dynamodb.query(params, (err, data) => {
          if (err) res.status(500).send(err);
          else {
               var topicList = [];
               data.Items.forEach((object) => {
                    if (
                         parseInt(object.currentStudents.N) <
                         parseInt(object.maxStudents.N)
                    )
                         topicList.push(object["topicName"].S);
               });
               res.send(topicList.filter((v, i, a) => a.indexOf(v) == i));
               // var payload={}
               // data.Items.forEach((object)=>{
               //     var topicName = object["topicName"].S
               //     if(payload[topicName]==null)
               //         payload[topicName]=[object["teacherId"].S]
               //     else if(!payload[topicName].includes(object["teacherId"].S))
               //     payload[topicName]=[...payload[topicName],object["teacherId"].S]
               // })
               // res.send(payload)
          }
     });
});

commonRouter.get(
     "/teacherNames",
     (req, res, next) => {
          if (!req.body.topicName)
               res.status(400).send({ error: "provide topicName" });

          var params = {
               TableName: "slotHashTable",
               IndexName: "forTopic",
               KeyConditionExpression: "topicName = :name",
               ExpressionAttributeValues: {
                    ":name": {
                         S: req.body.topicName,
                    },
               },
          };

          dynamodb.query(params, (err, data) => {
               if (err) res.status(500).send(err);
               else {
                    res.locals.payload = {};
                    data.Items.forEach((object) => {
                         if (
                              parseInt(object.currentStudents.N) <
                              parseInt(object.maxStudents.N)
                         ) {
                              var teacherId = object["teacherId"].S;
                              if (res.locals.payload[teacherId] == null) {
                                   res.locals.payload[teacherId] = {};
                                   res.locals.payload[teacherId].sloIds = [];
                              }

                              res.locals.payload[teacherId].sloIds = [
                                   ...res.locals.payload[teacherId].sloIds,
                                   {
                                        slotId: object["slotId"].S,
                                        slotTime: object["slotTime"].S,
                                        started: !(
                                             object["validated"].N === "-1"
                                        ),
                                        currentStudents: parseInt(
                                             object.currentStudents.N
                                        ),
                                        maxStudents: parseInt(
                                             object.maxStudents.N
                                        ),
                                   },
                              ];
                         }
                    });
                    if (Object.keys(res.locals.payload).length === 0)
                         res.send(res.locals.payload);
                    else next();
               }
          });
     },
     (req, res) => {
          var params = {
               RequestItems: {
                    reviewTable: {
                         Keys: Object.keys(
                              res.locals.payload
                         ).map((teacherId) => ({ userId: { S: teacherId } })),
                    },
               },
          };

          dynamodb.batchGetItem(params, (err, data) => {
               if (err)
                    res.status(500).send({ error: "server error", error: err });
               else {
                    data.Responses.reviewTable.forEach((obj) => {
                         res.locals.payload[obj.userId.S] = {
                              ...res.locals.payload[obj.userId.S],
                              teacherName: obj.name.S,
                              rating: parseInt(obj.rating.N),
                              noOfRating: parseInt(obj.noOfRating.N),
                         };
                    });

                    res.send(res.locals.payload);
               }
          });
     }
);

//replaced its functionality in the previous endpoint itself
commonRouter.get("/teacherRating", (req, res) => {
     if (!req.body.teacherId)
          res.status(400).send({ errpr: "provide teacherUID" });

     var params = {
          TableName: "reviewTable",
          Key: {
               userId: {
                    S: req.body.teacherId,
               },
          },
     };

     dynamodb.getItem(params, (err, data) => {
          if (err)
               res.status(500).send({
                    error: "database error noteacher found",
               });
          else {
               var payload = { rating: 0, noOfRating: 0, teacherName: "" };
               payload.rating = parseInt(data.Item["rating"].N);
               payload.noOfRating = parseInt(data.Item["noOfRating"].N);
               payload.teacherName = data.Item["name"].S;
               res.send(payload);
          }
     });
});

commonRouter.get("/slotDetails", (req, res) => {
     if (!req.body.slotId) res.status(400).send({ error: "provide slotID" });

     var params = {
          TableName: "slotTable",
          Key: {
               slotId: {
                    S: req.body.slotId,
               },
          },
     };

     dynamodb.getItem(params, (err, data) => {
          if (err) res.status(500).send({ error: "server error" });
          else {
               //work here after all the code for adding sa slot through teacher ui
               res.send(data.Item);
          }
     });
});

commonRouter.get("/slotDetails", (req, res) => {
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
                    venue2: data.Item.venue2.S,
                    genderPreference: data.Item.genderPreference.S,
                    topicDesc: data.Item.topicDesc.S,
                    estMarks: parseInt(data.Item.estMarks.N),
                    estTime: data.Item.estTime.S,
               });
     });
});

module.exports = commonRouter;
