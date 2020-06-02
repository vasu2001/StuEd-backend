const userRouter = require("express").Router();
const AWS = require("aws-sdk");

const Cognito = new AWS.CognitoIdentityServiceProvider({
     region: "ap-south-1",
     poolId: "ap-south-1_wviHpPowf",
});
const dynamodb = new AWS.DynamoDB({
     region: "local",
     endpoint: "http://127.0.0.1:8000",
     accessKeyId: "key",
     secretAccessKey: "secret",
});

userRouter.post("/changePassword", (req, res) => {
     if (!req.body.previousPassword || !req.body.proposedPassword) {
          res.status(400).send({ error: "provide passwords" });
          return;
     }

     var params = {
          AccessToken: req.headers.accesstoken,
          PreviousPassword: req.body.previousPassword,
          ProposedPassword: req.body.proposedPassword,
     };
     Cognito.changePassword(params, (err, data) => {
          if (err)
               res.status(400).send({
                    error: "something went wrong",
                    payload: err,
               });
          else res.send({ status: "password changed successfully" });
     });
});

userRouter.post("/changeEmail", (req, res) => {
     if (!req.body.email) {
          res.status(400).send({ error: "provide email" });
          return;
     }

     var params = {
          AccessToken: req.headers.accesstoken,
          UserAttributes: [
               {
                    Name: "email",
                    Value: req.body.email,
               },
          ],
     };
     Cognito.updateUserAttributes(params, (err, data) => {
          if (err)
               res.status(400).send({
                    error: "something went wrong",
                    payload: err,
               });
          else res.send({ status: "email changed successfully", data });
     });
});

userRouter.post("/changePhoneNo", (req, res) => {
     if (!req.body.phoneNo) {
          res.status(400).send({ error: "provide phoneNo" });
          return;
     }

     var params1 = {
          AccessToken: req.headers.accesstoken,
          UserAttributes: [
               {
                    Name: "phone_number",
                    Value: req.body.phoneNo,
               },
          ],
     };
     var userAttributePromise = Cognito.updateUserAttributes(params1).promise();

     var params2 = {
          TableName: "phoneNoTable",
          Key: {
               userId: { S: res.locals.Username },
          },
          UpdateExpression: "SET phoneNo = :phoneNo",
          ExpressionAttributeValues: {
               ":phoneNo": { S: req.body.phoneNo },
          },
     };
     var phoneNoTablePromise = dynamodb.updateItem(params2).promise();

     Promise.all([userAttributePromise, phoneNoTablePromise]).then(
          (data) => res.send({ status: "phoneNo changed successfully" }),
          (err) =>
               res
                    .status(400)
                    .send({ error: "something wrong happened", payload: err })
     );
});

userRouter.post("/changeName", (req, res) => {
     if (!req.body.name) {
          res.status(400).send({ error: "provide name" });
          return;
     }

     var params = {
          AccessToken: req.headers.accesstoken,
          UserAttributes: [
               {
                    Name: "name",
                    Value: req.body.name,
               },
          ],
     };
     Cognito.updateUserAttributes(params, (err, data) => {
          if (err)
               res.status(400).send({
                    error: "something went wrong",
                    payload: err,
               });
          else res.send({ status: "name changed successfully", data });
     });
});

module.exports = userRouter;
