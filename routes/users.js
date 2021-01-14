/*
 * @Description: API route handle user related request
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */

var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var Utils = require('../util/utils');

var User = require('../models/user');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
  return res.json({message: 'Response user resource'});
});

// Get Skills List
router.get('/getAllSkillsList', async function(req, res, next) {
  var responseSkillsList = await Utils.getAllSkillsList();
  if (responseSkillsList == null) {
    return res.json(Utils.responseMessage(1, null, 'No skills exist'));
  }
  return res.json(Utils.responseMessage(0, responseSkillsList, ''));
})

//Login with user name
router.get('/login', function(req, res, next) {
  if (req.query.reqUserName == undefined || req.query.reqUserName == '') {
    return res.json({status: 1, message: 'User EID is empty'});
  }
  User.findOne({
    where: {
      Name: req.query.reqUserName,
      IsActive: true  
    },
  }).then(function(user) {
    if(user != null && user.Name == req.query.reqUserName) {
      return res.json({status: 0, user, message: ''});
    } else {
      return res.json({status: 1, message: 'No user exist with EID '+ req.query.reqUserName});
    }
  })
});

// Get Single User
router.post('/getUserById', function(req, res, next) {
  User.findOne({
    where: {
      Id: req.body.reqUserId
    }
  }).then(async function(user) {
    if(user != null){
      var users = [user]
      var responseUsers = await generateResponseUsersInfo(users);
      return res.json(Utils.responseMessage(0, responseUser[0], ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'User not exist'));
    }
  });
});

router.post('/getUserByName', function(req, res, next) {
  User.findOne({
    where: {
      Name: req.body.reqUserName
    }
  }).then(async function(user) {
    if(user != null){
      var users = [user]
      var responseUsers = await generateResponseUsersInfo(users);
      return res.json(Utils.responseMessage(0, responseUsers[0], ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'User not exist'));
    }
  });
});

// Get user list
router.get('/getAllUsersList', function(req, res, next) {
  User.findAll({
    order: [
      ['createdAt', 'DESC']
    ]
  })
  .then(async function(users) {
    if (users != null && users.length > 0) {
      var responseUsers = await generateResponseUsersInfo(users);
      return res.json(Utils.responseMessage(0, responseUsers, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No user exist'));
    }
  })
});

router.get('/getActiveUsersListByLevelLimit', function(req, res, next) {
  var reqUserLevelLimit = Number(req.query.reqUserLevelLimit);
  User.findAll({
    where: {
      IsActive: 1,
      Role: { [Op.ne]: 'Special' },
      Level: { [Op.lte]: reqUserLevelLimit }
    },
    order: [
      ['Level', 'ASC']
    ]
  })
  .then(async function(users) {
    if (users != null && users.length > 0) {
      var responseUsers = await generateResponseUsersInfo(users);
      return res.json(Utils.responseMessage(0, responseUsers, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No user exist'));
    }
  })
});

async function generateResponseUsersInfo(users) {
  if (users != null && users.length > 0) {
    var rtnResult = [];
    var skillsList = await Utils.getAllSkillsList();
    for(var i=0; i<users.length; i++){
      var resJson = {};
      resJson.userId = users[i].Id;
      resJson.userName = users[i].Name;
      resJson.userNickname = users[i].Nickname;
      resJson.userEmployeeNbr = users[i].EmployeeNbr;
      resJson.userEmail = users[i].Email;
      resJson.userRole = users[i].Role;
      resJson.userThemeStyle = users[i].ThemeStyle;
      resJson.userNameMappings = users[i].NameMappings;
      resJson.userLevel = users[i].Level;
      resJson.userEmailGroups = users[i].EmailGroups;
      resJson.userSkills = users[i].Skills.split(',').map(Number);
      resJson.userSkillsStr = Utils.getSkillsByList(users[i].Skills, skillsList).toString();
      resJson.userWorkingHrs = users[i].WorkingHrs;
      resJson.userIsActive = users[i].IsActive;
      rtnResult.push(resJson);
    }
    //console.log('Return result -> ', rtnResult);
    return rtnResult;
  } else {
    return null;
  }
}

// Handle theme style
router.get('/getUserThemeStyle', function(req, res, next) {
  var reqUserName = req.query.userEid;
  User.findOne({
    attributes: ['Name', 'ThemeStyle'],
    where: {
      Name: reqUserName,
      IsActive: true 
    }
  }).then(function(user) {
    if(user != null){
      return res.json(Utils.responseMessage(0, user, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'User not exist'));
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
      return res.json(Utils.responseMessage(0, user, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'User not exist'));
    }
  });
});

// Create or update user
router.post('/updateUser', function(req, res, next) {
  console.log('Start to create or update user');
  var reqUserObj = generateRequestUserObject(req.body);
  User.findOrCreate({
    where: {
      Name: req.body.reqUserName
    }, 
    defaults: reqUserObj
  }).spread(async function(user, created) {
    if(created) {
      return res.json(Utils.responseMessage(0, user, 'Create user successfully!'));
    } 
    else if(user != null && !created) {
      await user.update(reqUserObj);
      return res.json(Utils.responseMessage(0, user, 'Update user successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated user fail!'));
    }
  })
});

function generateRequestUserObject (iRequest) {
  var reqUserObj = {
    Name: iRequest.reqUserName != ''? iRequest.reqUserName: null,
    Nickname: iRequest.reqUserNickname != ''? iRequest.reqUserNickname: null,
    EmployeeNbr: iRequest.reqUserEmployeeNbr != ''? iRequest.reqUserEmployeeNbr: null,
    Email: iRequest.reqUserEmail != ''? iRequest.reqUserEmail: null,
    Role: iRequest.reqUserRols != ''? iRequest.reqUserRole: 'General',
    ThemeStyle: iRequest.reqUserThemeStyle != ''? iRequest.reqUserThemeStyle: 0,
    NameMappings: iRequest.reqUserNameMappings != ''? iRequest.reqUserNameMappings: null,
    Level: iRequest.reqUserLevel != ''? iRequest.reqUserLevel: -1,
    EmailGroups: iRequest.reqUserEmailGroups != ''? iRequest.reqUserEmailGroups: null,
    Skills: iRequest.reqUserSkills != ''? iRequest.reqUserSkills: null,
    WorkingHrs: iRequest.reqUserWorkingHrs != ''? iRequest.reqUserWorkingHrs: 0,
    IsActive: iRequest.reqUserIsActive != null? iRequest.reqUserIsActive: 0
  }
  return reqUserObj;
}

module.exports = router;
