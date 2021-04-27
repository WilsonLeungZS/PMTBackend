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
var DailyScrum = require('../models/daily_scrum');
var Worklog = require('../models/worklog');
var Customer = require('../models/customer');
var Timeline = require('../models/timeline');

const { get } = require('.');

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
    },
    {
      model: Timeline
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

// Get active sprints list
router.get('/getActiveSprintsGroup', function(req, res, next) {
  Sprint.findAll({
    include: [{
      model: User, 
      attributes: ['Id', 'Name']
    },{
      model: Timeline
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
      var sprintsArray = await generateResponseSprintsInfo(sprints);
      var responseSprints = sortListBySprintTimeGroup(sprintsArray);
      return res.json(Utils.responseMessage(0, responseSprints, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
    }
  })
});

function sortListBySprintTimeGroup (iSprintList) {
  var result = []
  if (iSprintList != null && iSprintList.length > 0) {
    for (var i=0; i<iSprintList.length; i++) {
      var timeGroup = iSprintList[i].sprintTimeGroup
      var index = Utils.getIndexOfValueInArr(result, 'Label', timeGroup)
      if (index == -1) {
        result.push({
          Label: timeGroup,
          StartTime: iSprintList[i].sprintStartTime,
          EndTime: iSprintList[i].sprintEndTime,
          WorkingDays: iSprintList[i].sprintWorkingDays,
          PlannedCapacity: iSprintList[i].sprintPlannedCapacity != null? Number(iSprintList[i].sprintPlannedCapacity): 0,
          ContractCapacity: iSprintList[i].sprintBaseCapacity != null? Number(iSprintList[i].sprintBaseCapacity): 0,
          SprintUsers: [],
          Options: [iSprintList[i]]
        })
      } else {
        result[index].Options.push(iSprintList[i]);
        if (iSprintList[i].sprintBaseCapacity != null) {
          result[index].ContractCapacity = result[index].ContractCapacity + Number(iSprintList[i].sprintBaseCapacity);
        }
        if (iSprintList[i].sprintPlannedCapacity != null) {
          result[index].PlannedCapacity = result[index].PlannedCapacity + Number(iSprintList[i].sprintPlannedCapacity);
        }
      }
    }
  }
  return result
}

router.get('/getSprintsGroupUserList', async function(req, res, next) {
  var result = [];
  var workingDays = Number(req.query.reqWorkingDays);
  // Get sprint user map to calculate used capacity
  var sprintUserMaps = await getSpringUserMap(req.query.reqStartTime, req.query.reqEndTime);
  if (sprintUserMaps != null && sprintUserMaps.length > 0) {
    for (var i=0; i<sprintUserMaps.length; i++) {
      var resJson = {};
      var sprintUserFullName = sprintUserMaps[i].user.Name + ' (' + sprintUserMaps[i].user.Nickname + ')';
      var index = Utils.getIndexOfValueInArr(result, 'sprintUserFullName', sprintUserFullName);
      if (index == -1) {
        resJson.sprintUserId = sprintUserMaps[i].user.Id;
        resJson.sprintUserFullName = sprintUserFullName;
        resJson.sprintUserAssignToSprints = ', ' + sprintUserMaps[i].sprint.Name;
        resJson.sprintUserPlannedCapacity = Number(sprintUserMaps[i].Capacity);
        resJson.sprintUserWorkingHrs = Number(sprintUserMaps[i].user.WorkingHrs);
        result.push(resJson);
      } else {
        result[index].sprintUserAssignToSprints = result[index].sprintUserAssignToSprints + ', ' + sprintUserMaps[i].sprint.Name;
        result[index].sprintUserPlannedCapacity = result[index].sprintUserPlannedCapacity + Number(sprintUserMaps[i].Capacity);
      }
    }
  }
  if (result != null && result.length > 0) {
    for (var i=0; i<result.length; i++) {
      if(result[i].sprintUserAssignToSprints != null && result[i].sprintUserAssignToSprints != '') {
        result[i].sprintUserAssignToSprints = result[i].sprintUserAssignToSprints.slice(2);
      }
      result[i].sprintUserRemainingCapacity = workingDays * result[i].sprintUserWorkingHrs - result[i].sprintUserPlannedCapacity;
    }
  }
  var userList = await getUserList();
  var skillsList = await Utils.getAllSkillsList();
  if (userList != null && userList.length > 0) {
    for (var i=0; i<userList.length; i++) {
      var resJson = {};
      var index = Utils.getIndexOfValueInArr(result, 'sprintUserId', userList[i].Id);
      if (index == -1) {
        resJson.sprintUserId = userList[i].Id;
        resJson.sprintUserFullName = userList[i].Name + ' (' + userList[i].Nickname + ')';
        resJson.sprintUserAssignToSprints = '';
        resJson.sprintUserPlannedCapacity = 0;
        resJson.sprintUserWorkingHrs = userList[i].WorkingHrs;
        resJson.sprintUserRemainingCapacity = workingDays * userList[i].WorkingHrs;
        resJson.sprintUserSkills = Utils.getSkillsByList(Utils.handleSkillsArray(userList[i].Skills), skillsList).toString();
        result.push(resJson);
      } else {
        result[index].sprintUserSkills = Utils.getSkillsByList(Utils.handleSkillsArray(userList[i].Skills), skillsList).toString();
      }
    }
  }
  if (result != null && result.length > 0) {
    return res.json(Utils.responseMessage(0, result, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No sprint user map exist'));
  }
});

function getSpringUserMap (iStartTime, iEndTime) {
  return new Promise((resolve,reject) =>{
    SprintUserMap.findAll({
      include: [{
        model: User,
        attributes: ['Id', 'Name', 'Nickname', 'WorkingHrs']
      },
      {
        model: Sprint,
        attributes: ['Name'],
        where: {
          Status: { [Op.ne]: 'Obsolete' },
          StartTime: iStartTime,
          EndTime: iEndTime
        }
      }],
      where: {
        Id: { [Op.ne]: null }
      }
    }).then(async function(sprintUserMaps) {
      if (sprintUserMaps != null && sprintUserMaps.length > 0) {
        resolve(sprintUserMaps);
      } else {
        resolve(null);
      }
    });
  });
}

function getUserList () {
  return new Promise((resolve,reject) =>{
    User.findAll({
      where: {
        Level: { [Op.ne]: -1 },
        IsActive: 1
      }
    }).then(async function(users) {
      if (users != null && users.length > 0) {
        resolve(users);
      } else {
        resolve(null);
      }
    });
  });
}

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
    var customersList = await Utils.getAllCustomersList();
    for(var i=0; i<sprints.length; i++){
      var resJson = {};
      resJson.sprintId = sprints[i].Id;
      resJson.sprintName = sprints[i].Name;
      resJson.sprintStartTime = sprints[i].timeline.StartTime;
      resJson.sprintEndTime = sprints[i].timeline.EndTime;
      resJson.sprintTimeGroup = sprints[i].StartTime + ' ~ ' + sprints[i].EndTime;
      resJson.sprintBaseline = sprints[i].Baseline;
      resJson.sprintWorkingDays = sprints[i].timeline.WorkingDays;
      resJson.sprintBaseCapacity = sprints[i].BaseCapacity;
      var sprintPlannedCapacityObj = await getSprintUsersCapacitySumBySprintId(sprints[i].Id);
      var sprintPlannedCapacity = sprintPlannedCapacityObj[0].dataValues.CapacitySum != null? sprintPlannedCapacityObj[0].dataValues.CapacitySum: '0';
      resJson.sprintPlannedCapacity = Number(sprintPlannedCapacity);
      resJson.sprintRequiredSkills = Utils.handleSkillsArray(sprints[i].RequiredSkills).split(',').map(Number);
      resJson.sprintRequiredSkillsStr = Utils.getSkillsByList(Utils.handleSkillsArray(sprints[i].RequiredSkills), skillsList).toString();
      resJson.sprintCustomers = Utils.handleCustomersArray(sprints[i].Customers) != ''? Utils.handleCustomersArray(sprints[i].Customers).split(',').map(Number): null;
      resJson.sprintCustomersStr = Utils.getCustomersByList(Utils.handleCustomersArray(sprints[i].Customers), customersList).toString();
      resJson.sprintStatus = sprints[i].Status;
      resJson.sprintDataSource = (sprints[i].DataSource != null && sprints[i].DataSource != '')? sprints[i].DataSource.split(','): null;
      resJson.sprintLeaderId = sprints[i].user != null? sprints[i].user.Id: null;
      resJson.sprintLeader = sprints[i].user != null? sprints[i].user.Name: null;
      var sprintTotalEffort = await getTasksEffortSumBySprintId(sprints[i].Id, null);
      if (sprintTotalEffort != null) {
        resJson.sprintTotalEffort = sprintTotalEffort[0].dataValues.EffortSum;
      } else {
        resJson.sprintTotalEffort = 0;
      }
      resJson.sprintExistIndicator = 'Exist';
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
    },{
      model: Timeline
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

// Get Sprint Progress 
router.get('/getSprintProgressById', async function(req, res, next) {
  var reqSprintId = Number(req.query.reqSprintId);
  var result = [];
  // 1. Get capacity progress
  var sprintCapacityProgressObj = await getSprintCapacityProgress(reqSprintId);
  if (sprintCapacityProgressObj != null) {
    result.push(sprintCapacityProgressObj);
  } else {
    result.push({
      plannedCapacity: 0,
      usedCapacity: 0
    })
  }
  // 2. Get task completion progress
  var sprintTaskProgressObj = await getSprintTaskProgress(reqSprintId);
  if (sprintTaskProgressObj != null) {
    result.push(sprintTaskProgressObj);
  } else {
    result.push({
      totalTaskCount: 0,
      doneTaskCount: 0
    })
  }
  // 3. Get planned task effort progress
  var sprintPlannedTaskEffortProgressObj = await getTasksEffortSumBySprintId(reqSprintId, 'PLANNED');
  var sprintPlannedTaskEstProgressObj = await getTasksEstimationSumBySprintId(reqSprintId, 'PLANNED');
  if (sprintPlannedTaskEffortProgressObj != null && sprintPlannedTaskEstProgressObj != null) {
    result.push({
      plannedTaskEffort: sprintPlannedTaskEffortProgressObj[0].dataValues.EffortSum == null? 0: sprintPlannedTaskEffortProgressObj[0].dataValues.EffortSum,
      plannedTaskEst: sprintPlannedTaskEstProgressObj[0].dataValues.EstimationSum == null? 0: sprintPlannedTaskEstProgressObj[0].dataValues.EstimationSum
    })
  } else {
    result.push({
      plannedTaskEst: 0,
      plannedTaskEffort: 0
    })
  }
  // 4. Get non planned task effort progress
  var sprintUnplanTaskEffortProgressObj = await getTasksEffortSumBySprintId(reqSprintId, 'UNPLAN');
  var sprintPublicTaskEffortProgressObj = await getTasksEffortSumBySprintId(reqSprintId, 'PUBLIC');
  var sprintBuffer = 0;
  if (sprintCapacityProgressObj != null && sprintCapacityProgressObj.plannedCapacity > 0) {
    if (sprintPlannedTaskEstProgressObj != null && sprintPlannedTaskEstProgressObj[0].dataValues != null) {
      sprintBuffer = Number(sprintCapacityProgressObj.plannedCapacity) - Number(sprintPlannedTaskEstProgressObj[0].dataValues.EstimationSum);
    }
  }
  if (sprintUnplanTaskEffortProgressObj != null && sprintPublicTaskEffortProgressObj != null) {
    result.push({
      unplanTaskEffort: sprintUnplanTaskEffortProgressObj[0].dataValues.EffortSum == null? 0: sprintUnplanTaskEffortProgressObj[0].dataValues.EffortSum,
      publicTaskEffort: sprintPublicTaskEffortProgressObj[0].dataValues.EffortSum == null? 0: sprintPublicTaskEffortProgressObj[0].dataValues.EffortSum,
      sprintBuffer: sprintBuffer
    })
  } else {
    result.push({
      unplanTaskEffort: 0,
      publicTaskEffort: 0,
      sprintBuffer: sprintBuffer
    })
  }
  if (result == null || (result != null && result.length ==0)) {
    return res.json(Utils.responseMessage(1, null, 'No sprint progress exist'));
  }
  return res.json(Utils.responseMessage(0, result, ''));
});

function getSprintCapacityProgress (iSprintId) {
  return new Promise(async (resolve,reject) =>{
    var sprintPlannedCapacityResult = await getSprintUsersCapacitySumBySprintId(iSprintId);
    var sprintEffortResult = await getTasksEffortSumBySprintId(iSprintId);
    var sprintCapacityProgress = {};
    if (sprintPlannedCapacityResult != null && sprintEffortResult) {
      var sprintPlannedCapacity = sprintPlannedCapacityResult[0].dataValues.CapacitySum;
      var sprintEffort = sprintEffortResult[0].dataValues.EffortSum;
      sprintCapacityProgress.plannedCapacity = sprintPlannedCapacity;
      sprintCapacityProgress.usedCapacity = sprintEffort;
    }
    resolve(sprintCapacityProgress);
  });
}

function getSprintTaskProgress (iSprintId) {
  return new Promise(async (resolve,reject) =>{
    // Total Task Count
    var totalTaskCount = 0;
    await Task.findAll({
      where: {
        SprintId: iSprintId,
        Status: {[Op.ne]: 'Obsolete'},
        SprintIndicator: {[Op.ne]: 'PUBLIC'}
      }
    }).then(function(tasks){
      if(tasks != null && tasks.length > 0) {
        totalTaskCount = tasks.length;
      }
    });
    // Done Task Count
    var doneTaskCount = 0;
    await Task.findAll({
      where: {
        SprintId: iSprintId,
        Status: 'Done',
        SprintIndicator: {[Op.ne]: 'PUBLIC'}
      }
    }).then(function(tasks){
      if(tasks != null && tasks.length > 0) {
        doneTaskCount = tasks.length;
      }
    });
    var sprintTaskProgress = {};
    sprintTaskProgress.totalTaskCount = totalTaskCount;
    sprintTaskProgress.doneTaskCount = doneTaskCount;
    resolve(sprintTaskProgress);
  });
}

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
    var criteria = {
      SprintId: iReqSprintId,
    }
    if (iReqSprintIndicator != null && iReqSprintIndicator != '') {
      criteria.SprintIndicator = iReqSprintIndicator
    }
    Task.findAll({
      attributes: [
        [Sequelize.fn('sum', Sequelize.col('Effort')), 'EffortSum']
      ],
      where: criteria
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
  var reqScrumDate = req.query.reqScrumDate;
  if (reqScrumDate == null || reqScrumDate == '' || reqScrumDate == undefined) {
    reqScrumDate = null;
  }
  var sprintUsers = await getSprintUsersBySprintId(reqSprintId, reqScrumDate);
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

async function getSprintUsersBySprintId(iReqSprintId, iReqScrumDate) {
  return new Promise((resolve, reject) =>{
    SprintUserMap.findAll({
      include: [{
        model: User, 
        attributes: ['Id', 'Name', 'Nickname', 'WorkingHrs', 'Level', 'Skills']
      },
      {
        model: Sprint, 
        attributes: ['Id', 'LeaderId']
      }],
      where: {
        SprintId: iReqSprintId
      },
      order: [
        ['Capacity', 'DESC'],
        [{ model: User, as: 'modelUser' }, 'Level', 'DESC']
      ],
    }).then(async function(sprintUsers) {
      if (sprintUsers != null && sprintUsers.length > 0) {
        var rtnResult = [];
        var leader = {};
        var skillsList = await Utils.getAllSkillsList();
        for (var i=0; i<sprintUsers.length; i++) {
          var resJson = {};
          resJson.sprintId = sprintUsers[i].SprintId;
          resJson.sprintUserId = sprintUsers[i].UserId;
          resJson.sprintUserName = sprintUsers[i].user.Name;
          resJson.sprintUserFullName = sprintUsers[i].user.Name + ' (' + sprintUsers[i].user.Nickname + ')';
          resJson.sprintUserLevel = sprintUsers[i].user.Level;
          resJson.sprintUserNickname = sprintUsers[i].user.Nickname;
          resJson.sprintUserCapacity = sprintUsers[i].Capacity;
          resJson.sprintUserActualCapacity = await getSprintUserActualCapacity(sprintUsers[i].SprintId, sprintUsers[i].UserId);
          resJson.sprintUserMaxCapacity = sprintUsers[i].MaxCapacity;
          resJson.sprintUserWorkingHrs = sprintUsers[i].user.WorkingHrs;
          resJson.sprintUserSkillsStr = Utils.getSkillsByList(Utils.handleSkillsArray(sprintUsers[i].user.Skills), skillsList).toString();
          if (iReqScrumDate != null) {
            var dailyScrum = await getSprintUserDailyScrum(iReqScrumDate, sprintUsers[i].SprintId, sprintUsers[i].UserId);
            if (dailyScrum != null) {
              resJson.sprintDailyScrumUserCompletion = dailyScrum.Completion;
              resJson.sprintDailyScrumUserAttendance = dailyScrum.Attendance;
            } else {
              resJson.sprintDailyScrumUserCompletion = false;
              resJson.sprintDailyScrumUserAttendance = 'Absent';
            }
            // Capacity <= 18 should mark as "Optional"
            if (sprintUsers[i].Capacity <= 18 && resJson.sprintDailyScrumUserAttendance == 'Absent') {
              resJson.sprintDailyScrumUserAttendance = 'Optional';
            }
          }
          if (sprintUsers[i].sprint.LeaderId == sprintUsers[i].UserId) {
            leader = resJson;
            continue;
          }
          rtnResult.push(resJson);
        }
        if (leader != null && leader.sprintUserId > 0) {
          rtnResult.unshift(leader)
        }
        resolve(rtnResult);
      } else {
        resolve(null);
      }
    });
  });
}

async function getSprintUserActualCapacity (iSprintId, iUserId) {
  return new Promise((resolve, reject) =>{
    Worklog.findAll({
      include: [{
        model: Task,
        attributes: ['Id', 'Name', 'SprintId'],
        where: {
          SprintId: iSprintId
        }
      }],
      where: {
        UserId: iUserId,
        Id: { [Op.ne]: null }
      }
    }).then(function(worklogs) {
      if (worklogs != null && worklogs.length > 0) {
        var effortSum = 0;
        for (var i=0; i<worklogs.length; i++) {
          effortSum = effortSum + worklogs[i].Effort
        }
        resolve(effortSum);
      } else {
        resolve(0);
      }
    })
  });
}

async function getSprintUserDailyScrum (iDate, iSprintId, iUserId) {
  return new Promise((resolve, reject) =>{
    DailyScrum.findOne({
      where: {
        ScrumDate: iDate,
        SprintId: iSprintId,
        UserId: iUserId
      }
    }).then(function(dailyScrum) {
      resolve(dailyScrum);
    })
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
    Customers: iRequest.reqSprintCustomers != ''? iRequest.reqSprintCustomers: null,
    TimelineId: iRequest.reqSprintTimelineId != ''? iRequest.reqSprintTimelineId: null,
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

router.post('/updateDailyScrum', async function(req, res, next) {
  var reqSprintId = Number(req.body.reqSprintId);
  var reqScrumDate = req.body.reqScrumDate;
  var reqScrumList = JSON.parse(req.body.reqScrumList);
  if (reqScrumList != null) {
    for (var i=0; i<reqScrumList.length; i++) {
      var result = await updateDailyScrum(reqSprintId, reqScrumList[i].sprintUserId, reqScrumDate, reqScrumList[i].sprintDailyScrumUserAttendance, reqScrumList[i].sprintDailyScrumUserCompletion);
      reqScrumList[i].dailyScrumUpdateStatus = result;
    }
  }
  return res.json(Utils.responseMessage(0, reqScrumList, ''));
});

function updateDailyScrum (iSprintId, iUserId, iDate, iAttendance, iCompletion) {
  return new Promise((resolve,reject) =>{
    DailyScrum.findOrCreate({
      where: {
        SprintId: iSprintId,
        UserId: iUserId,
        ScrumDate: iDate
      }
    }).spread(async function(dailyScrum, created) {
      if (created) {
        await dailyScrum.update({Attendance: iAttendance, Completion: iCompletion});
        resolve(true);
      }
      else if (!created && dailyScrum != null) {
        await dailyScrum.update({Attendance: iAttendance, Completion: iCompletion});
        resolve(true);
      }
      else {
        resolve(false);
      }
    });
  });
}

router.post('/copySprints', async function(req, res, next) {
  var reqTargetTimelineId = Number(req.body.reqTargetTimelineId);
  var reqSourceTimelineId = Number(req.body.reqSourceTimelineId);
  var reqSprintIdArrayStr = req.body.reqSprintIdArray;
  if (reqSprintIdArrayStr != null) {
    var reqSprintIdArray = reqSprintIdArrayStr.split(',');
    // 1. Get source sprints as temples
    var targetSprintsInfo = [];
    await Sprint.findAll({
      where: {
        Id: {[Op.in]: reqSprintIdArray},
        TimelineId: reqSourceTimelineId
      }
    }).then(function (sprints) {
      if (sprints != null && sprints.length > 0) {
        for (let i=0; i<sprints.length; i++) {
          targetSprintsInfo.push(sprints[i].dataValues);
        }
        console.log('targetSprintsInfo -> ', targetSprintsInfo);
      }
    });
    // 2. Get target timeline info
    var targetTimelineStartTime = null;
    var targetTimelineEndTime = null;
    var targetTimelineWorkingDays = 0;
    await Timeline.findOne({
      where: {
        Id: reqTargetTimelineId
      }
    }).then(function (timeline) {
      if (timeline != null) {
        targetTimelineStartTime = timeline.StartTime;
        targetTimelineEndTime = timeline.EndTime;
        targetTimelineWorkingDays = timeline.WorkingDays;
      }
    });
    // 3. Copy sprints to target timeline
    if (targetSprintsInfo != null && targetSprintsInfo.length > 0) {
      if (targetTimelineStartTime != null && targetTimelineEndTime != null && targetTimelineWorkingDays != null) {
        console.log('Copy Sprints -> ', targetSprintsInfo);
        console.log('Target Timeline ', targetTimelineStartTime, targetTimelineEndTime, targetTimelineWorkingDays);
        for (var i=0; i<targetSprintsInfo.length; i++) {
          var targetSprint = targetSprintsInfo[i];
          targetSprint.StartTime = targetTimelineStartTime;
          targetSprint.EndTime = targetTimelineEndTime;
          targetSprint.WorkingDays = targetTimelineWorkingDays;
          targetSprint.Status = 'Active';
          targetSprint.TimelineId = reqTargetTimelineId;
          delete targetSprint.Id;
          delete targetSprint.createdAt;
          delete targetSprint.updatedAt;
          console.log('Target sprint -> ', targetSprint);
          await Sprint.findOrCreate({
            where: {
              Name: targetSprint.Name,
              TimelineId: reqTargetTimelineId
            },
            defaults: targetSprint
          }).spread(async function(sprint, created) {
            if (created) {
              console.log('Copy to create new sprint done');
            }
            else if (sprint != null && !created) {
              await sprint.update(targetSprint);
              console.log('Copy to update new sprint done');
            }
            else {
              console.log('Error to not create or update')
            }
          });
        }
        return res.json(Utils.responseMessage(0, null, 'Success to copy sprints!'));
      }
    }
  }
  return res.json(Utils.responseMessage(1, null, 'Fail to copy sprints!'));
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

// Customers Method
router.get('/getAllCustomersList', async function(req, res, next) {
  var result = await Utils.getAllCustomersList();
  if (result != null && result.length > 0) {
    return res.json(Utils.responseMessage(0, result, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No customer exist'));
  }
});

router.post('/updateCustomer', function(req, res, next) {
  console.log('Start to create or update customer');
  var reqCustomerId = Number(req.body.reqCustomerId);
  var reqCustomerName = req.body.reqCustomerName;
  var reqCustomerDescription = req.body.reqCustomerDescription;
  var reqCustomerHomepage = req.body.reqCustomerHomepage;
  var reqCustomerEmailDomain = req.body.reqCustomerEmailDomain;
  Customer.findOrCreate({
    where: {
      Id: reqCustomerId
    }, 
    defaults: {
      Name: reqCustomerName,
      Description: reqCustomerDescription,
      Homepage: reqCustomerHomepage,
      EmailDomain: reqCustomerEmailDomain
    }
  }).spread(async function(customer, created) {
    if(created) {
      console.log('Customer -> ', customer)
      return res.json(Utils.responseMessage(0, customer, 'Create customer successfully!'));
    } 
    else if(customer != null && !created) {
      await customer.update({
        Name: reqCustomerName,
        Description: reqCustomerDescription,
        Homepage: reqCustomerHomepage,
        EmailDomain: reqCustomerEmailDomain
      });
      return res.json(Utils.responseMessage(0, customer, 'Update customer successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated customer fail!'));
    }
  })
});

// Timeline Method
router.get('/getAllTimelinesList', async function(req, res, next) {
  var result = await Utils.getAllTimelinesList();
  if (result != null && result.length > 0) {
    for (var i=0; i<result.length; i++) {
      var sprintsArray = await getSprintsByTimelineId(result[i].timelineId);
      result[i].timelineSprints = sprintsArray;
      result[i].timelineContractCapacity = 0;
      result[i].timelinePlannedCapacity = 0;
      if (sprintsArray != null && sprintsArray.length > 0) {  
        for (var j=0; j<sprintsArray.length; j++) {
          if (sprintsArray[j].sprintBaseCapacity != null) {
            result[i].timelineContractCapacity = result[i].timelineContractCapacity + Number(sprintsArray[j].sprintBaseCapacity);
          }
          if (sprintsArray[j].sprintPlannedCapacity != null) {
            result[i].timelinePlannedCapacity = result[i].timelinePlannedCapacity + Number(sprintsArray[j].sprintPlannedCapacity);
          }
        }
      }
    }
    return res.json(Utils.responseMessage(0, result, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No timeline exist'));
  }
});

function getSprintsByTimelineId (iTimelineId) {
  return new Promise((resolve,reject) =>{
    Sprint.findAll({
      include: [{
        model: User, 
        attributes: ['Id', 'Name']
      },{
        model: Timeline
      }],
      where: {
        TimelineId: iTimelineId
      }
    }).then(function (sprints) {
      if (sprints != null && sprints.length > 0) {
        resolve(generateResponseSprintsInfo(sprints));
      } else {
        resolve(null);
      }
    })
  });
}

router.get('/getSprintsListByTimelineId', async function(req, res, next) {
  var reqTimelineId = Number(req.query.reqTimelineId);
  var sprintsArray = await getSprintsByTimelineId(reqTimelineId);
  if (sprintsArray != null && sprintsArray.length > 0) {
    return res.json(Utils.responseMessage(0, sprintsArray, ''));
  } else {
    return res.json(Utils.responseMessage(1, null, 'No sprint exist of this timeline'));
  }
});

router.post('/updateTimeline', function(req, res, next) {
  console.log('Start to create or update timeline');
  var reqTimelineId = Number(req.body.reqTimelineId);
  var reqTimelineName = req.body.reqTimelineName;
  var reqTimelineStartTime = req.body.reqTimelineStartTime;
  var reqTimelineEndTime = req.body.reqTimelineEndTime;
  var reqTimelineWorkingDays = req.body.reqTimelineWorkingDays;
  var reqTimelineStatus = req.body.reqTimelineStatus;
  Timeline.findOrCreate({
    where: {
      Id: reqTimelineId
    }, 
    defaults: {
      Name: reqTimelineName,
      StartTime: reqTimelineStartTime,
      EndTime: reqTimelineEndTime,
      WorkingDays: reqTimelineWorkingDays,
      Status: reqTimelineStatus
    }
  }).spread(async function(timeline, created) {
    if(created) {
      console.log('Customer -> ', timeline)
      return res.json(Utils.responseMessage(0, timeline, 'Create timeline successfully!'));
    } 
    else if(timeline != null && !created) {
      await timeline.update({
        Name: reqTimelineName,
        StartTime: reqTimelineStartTime,
        EndTime: reqTimelineEndTime,
        WorkingDays: reqTimelineWorkingDays,
        Status: reqTimelineStatus
      });
      return res.json(Utils.responseMessage(0, timeline, 'Update timeline successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated timeline fail!'));
    }
  })
});

module.exports = router;