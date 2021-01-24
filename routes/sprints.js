/*
 * @Description: API route handle sprint related request
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */

var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var Utils = require('../util/utils');

var Sprint = require('../models/sprint');
var User = require('../models/user');
var Task = require('../models/task');
var SprintUserMap = require('../models/sprint_user_map');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
  return res.json({message: 'Response sprint resource'});
});

// Get active sprints list
router.get('/getActiveSprintsList', function(req, res, next) {
  Sprint.findAll({
    include: [{
      model: User, 
      attributes: ['Id', 'Name']
    }],
    where: {
      Status: { [Op.ne]: 'Obsolete' }
    },
    order: [
      ['StartTime', 'DESC']
    ]
  })
  .then(async function(sprints) {
    if (sprints != null && sprints.length > 0) {
      var responseSprints = await generateResponseSprintsInfo(sprints);
      return res.json(Utils.responseMessage(0, responseSprints, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
    }
  })
});

async function generateResponseSprintsInfo(sprints) {
  if (sprints != null && sprints.length > 0) {
    var rtnResult = [];
    var skillsList = await Utils.getAllSkillsList();
    for(var i=0; i<sprints.length; i++){
      var resJson = {};
      resJson.sprintId = sprints[i].Id;
      resJson.sprintName = sprints[i].Name;
      resJson.sprintStartTime = sprints[i].StartTime;
      resJson.sprintEndTime = sprints[i].EndTime;
      resJson.sprintBaseline = sprints[i].Baseline;
      resJson.sprintWorkingDays = sprints[i].WorkingDays;
      resJson.sprintBaseCapacity = sprints[i].BaseCapacity;
      resJson.sprintRequiredSkills = Utils.handleSkillsArray(sprints[i].RequiredSkills).split(',').map(Number);
      resJson.sprintRequiredSkillsStr = Utils.getSkillsByList(Utils.handleSkillsArray(sprints[i].RequiredSkills), skillsList).toString();
      resJson.sprintStatus = sprints[i].Status;
      resJson.sprintLeaderId = sprints[i].user.Id;
      resJson.sprintLeader = sprints[i].user.Name;
      rtnResult.push(resJson);
    }
    // console.log('Return result -> ', rtnResult);
    return rtnResult;
  } else {
    return null;
  }
}

// Get Sprint Information 
router.get('/getSprintById', function(req, res, next) {
  var reqSprintId = Number(req.query.reqSprintId);
  Sprint.findOne({
    include: [{
      model: User, 
      attributes: ['Id', 'Name']
    }],
    where: {
      Id: reqSprintId
    }
  })
  .then(async function(sprint) {
    if (sprint != null) {
      var sprintArray = [sprint]
      var responseSprints = await generateResponseSprintsInfo(sprintArray);
      return res.json(Utils.responseMessage(0, responseSprints[0], ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
    }
  })
});

// Get Sprint Task Information 
router.get('/getSprintTasksById', async function(req, res, next) {
  var reqSprintId = Number(req.query.reqSprintId);
  var sprintTasks = await getTasksBySprintId(reqSprintId);
  var sprintEffortAndEstSum = await getTasksEffortAndEstSumBySprintId(reqSprintId);
  var result = {}
  result.sprintTasks = sprintTasks
  result.sprintEffortAndEstSum = sprintEffortAndEstSum
  if (sprintTasks != null && sprintTasks.length > 0) {
    return res.json(Utils.responseMessage(0, result, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No sprint task exist'));
  }
});

async function getTasksBySprintId(iReqSprintId) {
  return new Promise((resolve,reject) =>{
    Task.findAll({
      include: [{
        model: User, 
        attributes: ['Id', 'Name', 'Nickname']
      },
      {
        model: Sprint, 
        attributes: ['Id', 'Name']
      }],
      where: {
        ParentTaskName : null,
        Status: {[Op.ne]: 'Obsolete'},
        SprintId: iReqSprintId
      }
    }).then(async function(tasks) {
      var result = await Utils.generateResponseTasksInfo(tasks);
      resolve(result);
    })
  });
}

async function getTasksEffortAndEstSumBySprintId(iReqSprintId) {
  return new Promise((resolve,reject) =>{
    Task.findAll({
      attributes: [
        [Sequelize.fn('sum', Sequelize.col('Effort')), 'EffortSum'],
        [Sequelize.fn('sum', Sequelize.col('Estimation')), 'EstimationSum'],
      ],
      where: {
        SprintId: iReqSprintId
      }
    }).then(function(result) {
      resolve(result);
    })
  });
}

// Get Sprint User Information 
router.get('/getSprintUsersById', async function(req, res, next) {
  var reqSprintId = Number(req.query.reqSprintId);
  var sprintUsers = await getSprintUsersBySprintId(reqSprintId);
  var sprintUsersCapacitySum = await getSprintUsersCapacitySumBySprintId(reqSprintId);
  var result = {}
  result.sprintUsers = sprintUsers
  result.sprintUsersCapacitySum = sprintUsersCapacitySum
  if (sprintUsers != null && sprintUsers.length > 0) {
    return res.json(Utils.responseMessage(0, result, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No sprint task exist'));
  }
});

async function getSprintUsersBySprintId(iReqSprintId) {
  return new Promise((resolve, reject) =>{
    SprintUserMap.findAll({
      include: [{
        model: User, 
        attributes: ['Id', 'Name', 'Nickname', 'WorkingHrs']
      }],
      where: {
        SprintId: iReqSprintId
      }
    }).then(function(sprintUsers) {
      if (sprintUsers != null && sprintUsers.length > 0) {
        var rtnResult = [];
        for (var i=0; i<sprintUsers.length; i++) {
          var resJson = {};
          resJson.sprintId = sprintUsers[i].SprintId;
          resJson.sprintUserId = sprintUsers[i].UserId;
          resJson.sprintUserName = sprintUsers[i].user.Name;
          resJson.sprintUserNickname = sprintUsers[i].user.Nickname;
          resJson.sprintUserCapacity = sprintUsers[i].Capacity;
          resJson.sprintUserMaxCapacity = sprintUsers[i].MaxCapacity;
          resJson.sprintUserWorkingHrs = sprintUsers[i].user.WorkingHrs;
          rtnResult.push(resJson);
        }
        resolve(rtnResult);
      } else {
        resolve(null);
      }
    });
  });
}

async function getSprintUsersCapacitySumBySprintId(iReqSprintId) {
  return new Promise((resolve,reject) =>{
    SprintUserMap.findAll({
      attributes: [
        [Sequelize.fn('sum', Sequelize.col('Capacity')), 'CapacitySum']
      ],
      where: {
        SprintId: iReqSprintId
      }
    }).then(function(result) {
      resolve(result);
    });
  });
}

// Create or update sprint
router.post('/updateSprint', function(req, res, next) {
  console.log('Start to create or update sprint');
  var reqSprintObj = generateRequestSprintObject(req.body);
  Sprint.findOrCreate({
    where: {
      Name: req.body.reqSprintName
    }, 
    defaults: reqSprintObj
  }).spread(async function(sprint, created) {
    if(created) {
      return res.json(Utils.responseMessage(0, sprint, 'Create sprint successfully!'));
    } 
    else if(sprint != null && !created) {
      await sprint.update(reqSprintObj);
      return res.json(Utils.responseMessage(0, sprint, 'Update sprint successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated sprint fail!'));
    }
  })
});

function generateRequestSprintObject (iRequest) {
  var reqSprintObj = {
    Name: iRequest.reqSprintName != ''? iRequest.reqSprintName: null,
    StartTime: iRequest.reqSprintStartTime != ''? iRequest.reqSprintStartTime: null,
    EndTime: iRequest.reqSprintEndTime != ''? iRequest.reqSprintEndTime: null,
    Baseline: iRequest.reqSprintBaseline != ''? iRequest.reqSprintBaseline: null,
    WorkingDays: iRequest.reqSprintWorkingDays != ''? iRequest.reqSprintWorkingDays: 0,
    BaseCapacity: iRequest.reqSprintBaseCapacity != ''? iRequest.reqSprintBaseCapacity: null,
    RequiredSkills: iRequest.reqSprintRequiredSkills != ''? iRequest.reqSprintRequiredSkills: null,
    Status: iRequest.reqSprintStatus != ''? iRequest.reqSprintStatus: 'Active',
    LeaderId: iRequest.reqSprintLeaderId != ''? iRequest.reqSprintLeaderId: null,
  }
  return reqSprintObj;
}

// Assign user to sprint
router.post('/assignUserToSprint', function(req, res, next) {
  var reqSprintId = Number(req.body.reqSprintId);
  var reqUserId = Number(req.body.reqSprintId);
  var reqCapacity = Number(req.body.reqCapacity);
  var reqMaxCapacity = Number(req.body.reqMaxCapacity);
  var sprintUserMapObj = {
    SprintId: reqSprintId,
    UserId: reqUserId,
    Capacity: reqCapacity,
    MaxCapacity: reqMaxCapacity
  }
  SprintUserMap.findOrCreate({
    where: {
      SprintId: reqSprintId,
      reqUserId: reqUserId
    }, 
    defaults: sprintUserMapObj
  }).spread(async function(sprintUserMap, created) {
    if(created) {
      return res.json(Utils.responseMessage(0, sprintUserMap, 'Create sprint user map successfully!'));
    } 
    else if(sprintUserMap != null && !created) {
      await sprintUserMap.update(sprintUserMapObj);
      return res.json(Utils.responseMessage(0, sprintUserMap, 'Update sprint user map successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated sprint user map fail!'));
    }
  })
});

module.exports = router;