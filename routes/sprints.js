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

router.get('/getActiveSprintsListBySkills', async function(req, res, next) {
  var reqRequiredSkills = req.query.reqRequiredSkills;
  var sprints = await Utils.getSprintsByRequiredSkills(reqRequiredSkills, null, null);
  if (sprints != null && sprints.length > 0) {
    var responseSprints = await generateResponseSprintsInfo(sprints);
    return res.json(Utils.responseMessage(0, responseSprints, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
  }
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
      resJson.sprintTimeGroup = sprints[i].StartTime + ' ~ ' + sprints[i].EndTime;
      resJson.sprintBaseline = sprints[i].Baseline;
      resJson.sprintWorkingDays = sprints[i].WorkingDays;
      resJson.sprintBaseCapacity = sprints[i].BaseCapacity;
      resJson.sprintRequiredSkills = Utils.handleSkillsArray(sprints[i].RequiredSkills).split(',').map(Number);
      resJson.sprintRequiredSkillsStr = Utils.getSkillsByList(Utils.handleSkillsArray(sprints[i].RequiredSkills), skillsList).toString();
      resJson.sprintStatus = sprints[i].Status;
      resJson.sprintDataSource = (sprints[i].DataSource != null && sprints[i].DataSource != '')? sprints[i].DataSource.split(','): null;
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
  var reqSprintIndicator = req.query.reqSprintIndicator;
  var sprintTasks = await getTasksBySprintId(reqSprintId, reqSprintIndicator);
  var sprintEffortSum = await getTasksEffortSumBySprintId(reqSprintId, reqSprintIndicator);
  var sprintEstimationSum = await getTasksEstimationSumBySprintId(reqSprintId, reqSprintIndicator);
  var result = {}
  result.sprintTasks = sprintTasks
  result.sprintEffortSum = sprintEffortSum
  result.sprintEstimationSum = sprintEstimationSum
  if (sprintTasks != null && sprintTasks.length > 0) {
    return res.json(Utils.responseMessage(0, result, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No sprint task exist'));
  }
});

async function getTasksBySprintId(iReqSprintId, iReqSprintIndicator) {
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
        SprintId: iReqSprintId,
        SprintIndicator: iReqSprintIndicator
      },
      order: [
        ['IssueDate', 'ASC']
      ]
    }).then(async function(tasks) {
      var result = await Utils.generateResponseTasksInfo(tasks);
      resolve(result);
    })
  });
}

async function getTasksEffortSumBySprintId(iReqSprintId, iReqSprintIndicator) {
  return new Promise((resolve,reject) =>{
    Task.findAll({
      attributes: [
        [Sequelize.fn('sum', Sequelize.col('Effort')), 'EffortSum']
      ],
      where: {
        SprintId: iReqSprintId,
        SprintIndicator: iReqSprintIndicator
      }
    }).then(function(result) {
      resolve(result);
    })
  });
}

async function getTasksEstimationSumBySprintId(iReqSprintId, iReqSprintIndicator) {
  return new Promise((resolve,reject) =>{
    Task.findAll({
      attributes: [
        [Sequelize.fn('sum', Sequelize.col('Estimation')), 'EstimationSum']
      ],
      where: {
        ParentTaskName : null,
        SprintId: iReqSprintId,
        SprintIndicator: 'PLANNED'
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
        attributes: ['Id', 'Name', 'Nickname', 'WorkingHrs', 'Level']
      }],
      where: {
        SprintId: iReqSprintId
      },
      order: [
        [{ model: User, as: 'modelUser' }, 'Nickname', 'asc']
      ],
    }).then(function(sprintUsers) {
      if (sprintUsers != null && sprintUsers.length > 0) {
        var rtnResult = [];
        for (var i=0; i<sprintUsers.length; i++) {
          var resJson = {};
          resJson.sprintId = sprintUsers[i].SprintId;
          resJson.sprintUserId = sprintUsers[i].UserId;
          resJson.sprintUserName = sprintUsers[i].user.Name;
          resJson.sprintUserFullName = sprintUsers[i].user.Name + ' (' + sprintUsers[i].user.Nickname + ')';
          resJson.sprintUserLevel = sprintUsers[i].user.Level;
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
  // For integer type, need to format the request param to number type, otherwise the result will return string instead of integer
  // For example, if not Number(req.body.reqSprintId), the result record sprint.Id will be string type i/o integer type 
  Sprint.findOrCreate({
    where: {
      Id: Number(req.body.reqSprintId)
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
    DataSource: iRequest.reqSprintDataSource != ''? iRequest.reqSprintDataSource: null,
    LeaderId: iRequest.reqSprintLeaderId != ''? Number(iRequest.reqSprintLeaderId): null,
  }
  return reqSprintObj;
}

router.post('/updateSprintStatus', function(req, res, next) {
  console.log('Start to update sprint status');
  Sprint.findOne({
    where: {
      Id: req.body.reqSprintId
    }
  }).then(async function(sprint) {
    if(sprint != null) {
      await sprint.update({
        Status: req.body.reqSprintStatus,
        BaseCapacity: req.body.reqSprintCapacity
      });
      return res.json(Utils.responseMessage(0, sprint, 'Update sprint status successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Updated sprint status fail!'));
    }
  })
});

// Assign user to sprint
router.post('/assignUserToSprint', function(req, res, next) {
  var reqSprintId = Number(req.body.reqSprintId);
  var reqUserId = Number(req.body.reqUserId);
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
      UserId: reqUserId
    }, 
    defaults: sprintUserMapObj
  }).spread(async function(sprintUserMap, created) {
    if(created) {
      console.log('Create user map');
      return res.json(Utils.responseMessage(0, sprintUserMap, 'Create sprint user map successfully!'));
    } 
    else if(sprintUserMap != null && !created) {
      console.log('Find user map, start to update');
      sprintUserMapObj.Capacity = sprintUserMapObj.Capacity + sprintUserMap.Capacity;
      await sprintUserMap.update(sprintUserMapObj);
      return res.json(Utils.responseMessage(0, sprintUserMap, 'Update sprint user map successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated sprint user map fail!'));
    }
  })
});

router.post('/removeUserFromSprint', function(req, res, next) {
  var reqSprintId = Number(req.body.reqSprintId);
  var reqUserId = Number(req.body.reqUserId);
  SprintUserMap.findOne({
    where: {
      SprintId: reqSprintId,
      UserId: reqUserId
    }
  }).then(async function(sprintUserMap) {
    if(sprintUserMap != null) {
      console.log('Find user map, start to delete');
      await sprintUserMap.destroy();
      return res.json(Utils.responseMessage(0, null, 'Remove sprint user map successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Remove sprint user map fail!'));
    }
  })
});

module.exports = router;