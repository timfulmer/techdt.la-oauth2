/**
 * Created by timfulmer on 7/26/15.
 */
var Promise=require('bluebird'),
  oauth2orize=require('oauth2orize'),
  utils=require('../app/utils');

function initialize(options){
  options=options || {};
  function initializePromise(resolve,reject){

    var server = oauth2orize.createServer();

    server.serializeClient(function(client, done) {
      return done(null, client.clientId);
    });
    server.deserializeClient(function(id, done) {
      options.collections.client.findOne({clientId: id})
        .then(function(client) {
          return done(null, client);
        })
        .catch(function(err){
          return done(err);
        });
    });

    if(!options.collections || !options.collections.accesstoken){
      return reject(new Error('Could not find AccessToken ORM from config.'));
    }
    //Implicit grant
    var token=oauth2orize.grant.token(function (client, user, ares, done) {
      var token = utils.uid(256);
      var expirationDate = new Date(new Date().getTime() + (3600 * 1000));
      options.collections.accesstoken.create({
          token: token,
          expirationDate: expirationDate,
          userId: user.username,
          clientId: client.clientId
        })
        .then(function(accessToken) {
          return done(null, token, {expires_in: expirationDate.toISOString()});
        })
        .catch(function(err){
          return done(err);
        });
    });
    var response=token.response;
    token.response=function(txn, res, next){
      var fakeRes={
        redirect:function(url){
          if(url.indexOf('access_token')>-1){
            var start=url.indexOf('access_token')+13,
              end=url.indexOf('&');
            res.json({accessToken:url.substring(start,end)});
          }else{
            res.send(401,'Unauthorized');
          }
        }
      };
      response(txn,fakeRes,next);
    };
    server.grant(token);
    options.oauth2Server=server;
    resolve(options);
  }
  return new Promise(initializePromise);
}

module.exports={
  initialize:initialize
};