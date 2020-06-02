const AWS = require("aws-sdk");

const Cognito = new AWS.CognitoIdentityServiceProvider({
     region: "ap-south-1",
     poolId: "ap-south-1_wviHpPowf",
});
const ClientId = "2pb21e84pbs574s5f68s5ps47";

const auth = async (req, res, next) => {
     if (!req.headers.accesstoken) {
          res.status(401).send({
               error: "Unauthorized",
               message: "no access token",
          });
          return;
     }
     var params = {
          AccessToken: req.headers.accesstoken,
     };
     Cognito.getUser(params, (err, data) => {
          if (err)
               res.status(401).send({
                    error: "Unauthorized",
                    code: err.code,
                    message: err.message,
               });
          else {
               res.locals.Username = data.Username;
               next();
          }
     });
};

module.exports = auth;
