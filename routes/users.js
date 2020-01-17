var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var User = require('../model/user');
var Team = require('../model/team/team');
var Logger  = require("../config/logConfig");

const Op = Sequelize.Op;

/* GET users listing. */
router.get('/', function(req, res, next) {
  return res.json({message: 'Response user resource'});
});

router.get('/getUserLevelById', function(req, res, next) {
  var reqUserId = req.query.userId;
  User.findOne({
    attributes: ['Name', 'Level'],
    where: {
      Id: reqUserId
    }
  }).then(function(user) {
    if(user != null){
      return res.json(responseMessage(0, user, ''));
    } else {
      return res.json(responseMessage(1, null, 'User not exist'));
    }
  });
});

router.get('/getUserThemeStyle', function(req, res, next) {
  var reqUserName = req.query.userEid;
  User.findOne({
    attributes: ['Name', 'ThemeStyle'],
    where: {
      Name: reqUserName,
      IsActive: true }
  }).then(function(user) {
    if(user != null){
      return res.json(responseMessage(0, user, ''));
    } else {
      return res.json(responseMessage(1, null, 'User not exist'));
    }
  });
});

router.get('/setUserThemeStyle', function(req, res, next) {
  var reqThemeStyle = Number(req.query.uThemeStyle);
  var reqUserName = req.query.userEid;
  User.findOne({
    where: {
      Name: reqUserName,
      IsActive: true }
  }).then(function(user) {
    if(user != null){
      user.update({
        ThemeStyle: reqThemeStyle 
      });
      return res.json(responseMessage(0, user, ''));
    } else {
      return res.json(responseMessage(1, null, 'User not exist'));
    }
  });
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
    where: {
      Name: req.query.userEid,
      IsActive: true  
    },
  }).then(function(user) {
    if(user != null && user.Name == req.query.userEid) {
      return res.json({status: 0, user, message: ''});
    } else {
      return res.json({status: 1, message: 'No user exist with EID '+ req.query.userEid});
    }
  })
});

router.post('/loginAdmin', function(req, res, next) {
  var reqAdminPassword = req.body.adminpassword;
  User.findOne({
    where: {
      Name: "Admin",
      IsActive: false  
    },
  }).then(function(user) {
    console.log("admin: "+ user.Email + " password: "+ reqAdminPassword);
    if(user != null && user.Email == reqAdminPassword) {
      return res.json({status: 0, user, message: ''});
    } else {
      return res.json({status: 1, message: 'Admin login fail!' });
    }
  })
});

//Add or update User
router.post('/addOrUpdateUser', function(req, res, next) {
  var reqUserIsActive = true;
  var reqData = {}
  if( req.body.taskTypeId != "0"){
    reqData = { Id: req.body.reqUserId };
  } else {
    reqData = { Name: req.body.reqUserEid };
  }
  if ( req.body.reqUserIsActive == null ) {
    reqUserIsActive = true
  } else {
    reqUserIsActive = req.body.reqUserIsActive
  }
  Team.findOne({where: {Name: req.body.reqUserTeam}}).then(function(team){
    var teamId = team.Id;
    User.findOrCreate({
      where: reqData, 
      defaults: {
        Name: req.body.reqUserEid,
        Email: req.body.userEmail,
        TeamId: teamId,
        Role: req.body.reqUserRole,
        NameMapping: req.body.reqUserNameMapping,
        IsActive: reqUserIsActive,
        Level: req.body.reqUserLevel
      }})
    .spread(function(user, created) {
      if(created) {
        return res.json(responseMessage(0, user, 'Create user successfully!'));
      } 
      else if(user != null && !created) {
        user.update({
          Name: req.body.reqUserEid,
          Email: req.body.userEmail,
          TeamId: teamId,
          Role: req.body.reqUserRole,
          NameMapping: req.body.reqUserNameMapping,
          IsActive: reqUserIsActive,
          Level: req.body.reqUserLevel
        });
        return res.json(responseMessage(0, user, 'Update user successfully!'));
      }
      else {
        return res.json(responseMessage(1, null, 'Created or updated user fail!'));
      }
    })
  })
});

router.post('/inactiveUser', function(req, res, next) {
  //console.log('Request: ' + JSON.stringify(req.body));
  User.findOne({where: {Id: req.body.reqUserId}})
  .then(function(user) {
    if(user != null) {
      user.update({
        IsActive: false
      });
      return res.json(responseMessage(0, user, 'Inactive user successfully!'));
    } else {
      return res.json(responseMessage(1, null, 'Inactive user fail!'));
    }
  })
});

router.get('/getUserList', function(req, res, next) {
  var reqIsActive = req.query.IsActive
  var criteria = {}
  if (reqIsActive === null) {
    criteria = {IsActive: true}
  }
  var rtnResult = [];
  User.findAll({
    where: criteria,
    include: [{
      model: Team,
      attributes: ['Id', 'Name']
    }]
  })
  .then(function(user) {
    if(user != null && user.length > 0){
      for(var i=0;i<user.length;i++){
        var resJson = {};
        resJson.user_id = user[i].Id;
        resJson.user_eid = user[i].Name;
        resJson.user_email = user[i].Email;
        resJson.user_team = user[i].team.Name;
        resJson.user_role = user[i].Role;
        resJson.user_isactive = user[i].IsActive;
        resJson.user_namemapping = user[i].NameMapping;
        resJson.user_level = user[i].Level;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No active user exist'));
    }
  })
});

router.post('/getUserById', function(req, res, next) {
  var rtnResult = [];
  var reqUserId = req.body.userId;
  User.findOne({
    where: {
      Id: reqUserId
    },
    include: [{
      model: Team,
      attributes: ['Id', 'Name', 'Project']
    }]
  })
  .then(function(user) {
    Team.findAll({where: {IsActive: true}}).then(function(team){
      if(user != null){
        var resJson = {};
        resJson.user_id = user.Id;
        resJson.user_eid = user.Name;
        resJson.user_email = user.Email;
        resJson.user_team = user.team.Name;
        resJson.user_teamproject = user.team.Project;
        resJson.user_teamid = user.team.Id;
        resJson.user_role = user.Role;
        resJson.user_namemapping = user.NameMapping;
        resJson.user_level = user.Level;
        if(team != null){
          var teamArray = [];
          for(var i=0; i< team.length; i++){
            teamArray.push(team[i].Name);
          }
          resJson.user_team_array = teamArray;
          resJson.user_team_index = teamArray.indexOf(user.team.Name);
        } else {
          resJson.user_team_array = [];
          resJson.user_team_index = 0;
        }
        rtnResult.push(resJson);
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'User not exist'));
      }
    });
  })
});

router.post('/getUserListByName', function(req, res, next) {
  var rtnResult = [];
  User.findAll({
    where: {
      Name: {[Op.like]:'%' + req.body.reqUserName + '%'},
      IsActive: true
    },
    include: [{
      model: Team,
      attributes: ['Name']
    }]
  })
  .then(function(user) {
    if(user != null && user.length > 0){
      for(var i=0;i<user.length;i++){
        var resJson = {};
        resJson.user_id = user[i].Id;
        resJson.user_eid = user[i].Name;
        resJson.user_team = user[i].team.Name;
        resJson.user_role = user[i].Role;
        resJson.user_namemapping = user[i].NameMapping;
        resJson.user_level = user[i].Level;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No active user exist'));
    }
  })
});

//Team Method
router.get('/getTeamList', function(req, res, next) {
  var reqIsActive = req.query.IsActive
  var criteria = {}
  if (reqIsActive === null || reqIsActive === undefined) {
    criteria = {IsActive: true}
  }
  var rtnResult = [];
  Team.findAll({where: criteria})
  .then(function(team) {
    if(team != null && team.length > 0){
      var teamArray = [];
      var resJson1 = {};
      for(var i=0; i< team.length; i++){
        teamArray.push(team[i].Name);
      }
      resJson1.team_array = teamArray;
      rtnResult.push(resJson1);
      for(var i=0;i<team.length;i++){
        var resJson = {};
        resJson.team_id = team[i].Id;
        resJson.team_name = team[i].Name;
        resJson.team_project = team[i].Project;
        resJson.team_desc = team[i].Description;
        resJson.team_mapping = team[i].Mapping;
        resJson.team_isactive = team[i].IsActive;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No active team exist'));
    }
  })
});

//Add or update User
router.post('/addOrUpdateTeam', function(req, res, next) {
  var reqData = {};
  var reqTeamMapping = '';
  var reqTeamIsActive = true;
  if( req.body.reqTeamId != "0"){
    reqData = { Id: req.body.reqTeamId };
  } else {
    reqData = { Name: req.body.reqTeamName };
  }
  if ( req.body.reqTeamMapping == null ) {
    reqTeamMapping = ''
  } else {
    reqTeamMapping = req.body.reqTeamMapping
  }
  if ( req.body.reqTeamIsActive == null ) {
    reqTeamIsActive = true
  } else {
    reqTeamIsActive = req.body.reqTeamIsActive
  }
  Team.findOrCreate({
    where: reqData, 
    defaults: {
      Name: req.body.reqTeamName,
      Project: req.body.reqTeamProject,
      Description: req.body.reqTeamDesc,
      Mapping: reqTeamMapping,
      IsActive: reqTeamIsActive
    }})
  .spread(function(team, created) {
    if(created) {
      return res.json(responseMessage(0, team, 'Create team successfully!'));
    } 
    else if(team != null && !created) {
      team.update({
        Name: req.body.reqTeamName,
        Project: req.body.reqTeamProject,
        Description: req.body.reqTeamDesc,
        Mapping: reqTeamMapping,
        IsActive: reqTeamIsActive,
      });
      return res.json(responseMessage(0, team, 'Update team successfully!'));
    }
    else {
      return res.json(responseMessage(1, null, 'Created or updated team fail!'));
    }
  })
});

router.post('/inactiveTeam', function(req, res, next) {
  //console.log('Request: ' + JSON.stringify(req.body));
  Team.findOne({where: {Id: req.body.reqTeamId}})
  .then(function(team) {
    if(team != null) {
      team.update({
        IsActive: false
      });
      return res.json(responseMessage(0, team, 'Inactive team successfully!'));
    } else {
      return res.json(responseMessage(1, null, 'Inactive team fail!'));
    }
  })
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

module.exports = router;
