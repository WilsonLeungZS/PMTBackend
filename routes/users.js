var express = require('express');
var router = express.Router();
var User = require('../model/user');
var Team = require('../model/team/team');

/* GET users listing. */
router.get('/', function(req, res, next) {
  return res.json({message: 'Response user resource'});
});

//Login
router.get('/login', function(req, res, next) {
  if (req.query.userEid == undefined || req.query.userEid == '') {
    return res.json({status: 1, message: 'User EID is empty'});
  }
  User.findOne({
    include: [{
      model: Team,
      attributes: ['Name']
    }],
    where: {Name: req.query.userEid},
  }).then(function(user) {
    if(user != null && user.Name == req.query.userEid) {
      return res.json({status: 0, user, message: ''});
    } else {
      return res.json({status: 1, message: 'No user exist with EID '+ req.query.userEid});
    }
  })
});

//Add New User
router.post('/addUser', function(req, res, next) {
  //console.log('Request: ' + JSON.stringify(req.body));
  if (req.body.userName == undefined || req.body.userName == ''
      || req.body.userAdmin == undefined || req.body.userAdmin == ''
      || req.body.userTeam == undefined || req.body.userTeam == '') {
      return res.json({status: 1, message: 'User name/Team/admin privilege is empty'});
  }
  var reqEmail = req.body.userEmail != ''? req.body.userEmail: '';
  var reqAdmin = req.body.userAdmin == 'true'? true: false;
  User.findOrCreate({
    where: {Name: req.body.userName}, 
    defaults: {
      Name: req.body.userName,
      Email: reqEmail,
      Team: req.body.userTeam,
      Enabled: true,
      Admin: reqAdmin
    }})
  .spread(function(user, created) {
    if(created) {
      console.log("User created");
      return res.json({status: 0, user, message: ''});
    } else {
      console.log("User existed");
      return res.json({status: 1, message: 'Created failed: user existed'});
    }
  })
});

module.exports = router;
