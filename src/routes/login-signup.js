const express = require("express");
const AWS = require("aws-sdk");

const ClientId = "2pb21e84pbs574s5f68s5ps47";
const UserPoolId = "ap-south-1_wviHpPowf";

const Cognito = new AWS.CognitoIdentityServiceProvider({
     region: "ap-south-1",
     UserPoolId,
     UserPoolClientId: ClientId,
     accessKeyId: "AKIAJNZM2KUGJRCQPHSQ",
     secretAccessKey: "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",
});
const dynamodb = new AWS.DynamoDB({
     region: "local",
     endpoint: "http://127.0.0.1:8000",
     accessKeyId: "key",
     secretAccessKey: "secret",
});
const signinRouter = express.Router();

signinRouter.post("/signin", (req, res) => {
     if (!req.body.email || !req.body.password) {
          res.status(400).send({ error: "invalid form" });
          return;
     }

     var params = {
          AuthFlow: "ADMIN_NO_SRP_AUTH",
          ClientId,
          AuthParameters: {
               USERNAME: req.body.email,
               PASSWORD: req.body.password,
          },
          UserPoolId,
     };
     Cognito.adminInitiateAuth(params, (err, data) => {
          if (err)
               res.status(500).send({ error: "signin failed", payload: err });
          else res.send({ status: "signin successful", payload: data });
     });
});

signinRouter.post("/signup", (req, res) => {
     if (
          !req.body.phoneNo ||
          !req.body.email ||
          !req.body.password ||
          !req.body.name
     ) {
          res.status(400).send({ error: "invalid form" });
          return;
     }

     var params = {
          ClientId,
          Password: req.body.password,
          Username: req.body.email,
          UserAttributes: [
               {
                    Name: "name",
                    Value: req.body.name,
               },
               {
                    Name: "phone_number",
                    Value: req.body.phoneNo,
               },
               {
                    Name: "email",
                    Value: req.body.email,
               },
          ],
     };
     Cognito.signUp(params, (err, data) => {
          if (err)
               res.status(500).send({ error: "signup failed", payload: err });
          else {
               var params = {
                    TableName: "phoneNoTable",
                    Item: {
                         userId: { S: data.UserSub },
                         phoneNo: { S: req.body.phoneNo },
                         name: { S: req.body.name },
                    },
               };
               dynamodb.putItem(params, (err, success) => {
                    if (err)
                         res.status(500).send({
                              error: "server error",
                              payload: err,
                         });
                    else
                         res.send({
                              status: "signup succcessful",
                              payload: data,
                         });
               });
          }
     });
});

signinRouter.post("/verify", (req, res) => {
     if (!req.body.email || !req.body.OTP || !req.body.password) {
          res.status(400).send({ error: "incomplete form" });
          return;
     }

     var params = {
          ClientId,
          ConfirmationCode: req.body.OTP,
          Username: req.body.email,
     };
     Cognito.confirmSignUp(params, (err, data) => {
          if (err)
               res.status(500).send({ error: "signup failed", payload: err });
          else {
               var params = {
                    AuthFlow: "USER_PASSWORD_AUTH",
                    ClientId,
                    AuthParameters: {
                         USERNAME: req.body.email,
                         PASSWORD: req.body.password,
                    },
               };
               Cognito.initiateAuth(params, (err, data) => {
                    if (err)
                         res.status(500).send({
                              error: "signin failed",
                              payload: err,
                         });
                    else
                         res.send({
                              status: "signup successful",
                              payload: data,
                         });
               });
          }
     });
});

signinRouter.post("/resendVerificationCode", (req, res) => {
     if (!req.body.email) {
          res.status(400).send({ error: "provide email address" });
          return;
     }

     var params = {
          ClientId,
          Username: req.body.email,
     };
     Cognito.resendConfirmationCode(params, (err, data) => {
          if (err)
               res.status(500).send({ error: "server error", payload: err });
          else res.send({ status: "OTP resend successful", payload: data });
     });
});

signinRouter.post("/refreshToken", (req, res) => {
     if (!req.body.RefreshToken) {
          res.status(400).send({ error: "provide refresh token" });
          return;
     }

     var params = {
          ClientId,
          AuthFlow: "REFRESH_TOKEN_AUTH",
          AuthParameters: {
               REFRESH_TOKEN: req.body.RefreshToken,
          },
     };
     Cognito.initiateAuth(params, (err, data) => {
          if (err)
               res.status(500).send({ error: "signin failed", payload: err });
          else res.send({ status: "signin successful", payload: data });
     });
});

module.exports = signinRouter;
