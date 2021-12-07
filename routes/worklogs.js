var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var express = require('express');
var router = express.Router();

var Worklog = require('../models/worklog');
var Task = require('../models/task');
var User = require('../models/user');
var Sprint = require('../models/sprint');
var SprintUserMap = require('../models/sprint_user_map');
var Reference = require('../models/reference');

var Utils = require('../util/utils');

/* GET users listing. */
router.get('/', function(req, res, next) {
  return res.json({message: 'Response worklog resource'});
});

// Get worklog for Timesheet
// Get worklog for single record
router.get('/getWorklog', function(req, res, next) {
  var reqTaskId = req.query.reqTaskId;
  var reqUserId = req.query.reqUserId;
  var reqWorklogMonth = req.query.reqWorklogMonth;
  var reqWorklogDay = req.query.reqWorklogDay; 
  Worklog.findOne({
    include: [{
      model: Task,
      attributes: ['Id', 'Name', 'Title']
    }],
    where: {
      TaskId: reqTaskId,
      UserId: reqUserId,
      WorklogMonth: reqWorklogMonth,
      WorklogDay: reqWorklogDay
    }
  }).then(function(worklog) {
    if (worklog != null) {
      var responseWorklogs = generateResponseWorklogsInfo([worklog]);
      return res.json(Utils.responseMessage(0, responseWorklogs[0], ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No worklog exist'));
    }
  });
});

function generateResponseWorklogsInfo(worklogs) {
  if (worklogs != null && worklogs.length > 0) {
    var rtnResult = [];
    for(var i=0; i<worklogs.length; i++){
      var resJson = {};
      resJson.worklogId = worklogs[i].Id;
      resJson.worklogEffort = worklogs[i].Effort;
      resJson.worklogRemark = worklogs[i].Remark;
      resJson.worklogMonth = worklogs[i].WorklogMonth;
      resJson.worklogDay = worklogs[i].WorklogDay;
      resJson.worklogDate = worklogs[i].WorklogMonth + '-' + worklogs[i].WorklogDay;
      resJson.worklogTaskId = worklogs[i].task != null? worklogs[i].task.Id: null;
      resJson.worklogTaskName = worklogs[i].task != null? worklogs[i].task.Name: null;
      resJson.worklogTaskTitle = worklogs[i].task != null? worklogs[i].task.Title: null;
      rtnResult.push(resJson);
    }
    //console.log('Return result -> ', rtnResult);
    return rtnResult;
  } else {
    return null;
  }
}


// Get worklog list for timesheet
router.post('/getWorklogForTimesheet', function(req, res, next) {
  var reqUserId = req.body.reqUserId;
  var reqMonth = req.body.reqMonth;
  var reqMonthArr = [];
  if (reqMonth.indexOf(',') != -1) {
    reqMonthArr = reqMonth.split(',')
  } else {
    reqMonthArr.push(reqMonth)
  }
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: Task,
      attributes: ['Id', 'Name', 'Title','CustomerId']
    }],
    where: {
      UserId: reqUserId,
      WorklogMonth: { [Op.in]: reqMonthArr },
      Effort: { [Op.ne]: 0 }
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(function(worklogs) {
    if( worklogs != null && worklogs.length > 0) {
      for(var i=0; i< worklogs.length; i++) {
        var resJson = {};
        var index = Utils.getIndexOfValueInArr(rtnResult, 'taskId', worklogs[i].task.Id);
        if (index == -1 ) {
          resJson['taskId'] = worklogs[i].task.Id;
          resJson['taskName'] = worklogs[i].task.Name;
          resJson['taskTitle'] = worklogs[i].task.Title;
          resJson['taskCustomerId'] = worklogs[i].task.CustomerId;
          resJson['day' + worklogs[i].WorklogMonth + '-' + worklogs[i].WorklogDay] = worklogs[i].Effort;
          rtnResult.push(resJson);
        } else {
          var item = rtnResult[index];
          if(item['taskId'] == worklogs[i].task.Id) {
            item['day' + worklogs[i].WorklogMonth + '-' + worklogs[i].WorklogDay] = worklogs[i].Effort;
          }
        }
      }
      return res.json(Utils.responseMessage(0, rtnResult, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No worklog existed'));
    }
  })
});

// Get task worklog history
router.get('/getWorklogHistoriesByTaskId', function(req, res, next) {
  var reqTaskId = Number(req.query.reqTaskId);
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: User,
      attributes: ['Name']
    }],
    where: {
      TaskId: Number(reqTaskId),
      Effort: { [Op.ne]: 0 }
    }
  }).then(function(worklogs) {
    if(worklogs != null && worklogs.length >0){
      for(var i=0; i<worklogs.length; i++){
        var resJson = {};
        resJson.worklogTimestamp = worklogs[i].WorklogMonth + '-' + worklogs[i].WorklogDay
        resJson.worklogContent = worklogs[i].user.Name + ' recorded ' + worklogs[i].Effort + ' hours'
        rtnResult.push(resJson)
      }
      rtnResult = sortArray(rtnResult, 'worklogTimestamp')
      return res.json(Utils.responseMessage(0, rtnResult, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No worklog history exist'));
    }
  })
});

function sortArray(iArray, iKey) {
  var len = iArray.length;
  for (var i = 0; i < len; i++) {
    for (var j = 0; j < len - 1 - i; j++) {
      var itemI = iArray[j]
      var itemJ = iArray[j+1]
      if (itemI[iKey] < itemJ[iKey]) {      
        var temp = iArray[j+1];       
        iArray[j+1] = iArray[j];
        iArray[j] = temp;
      }
    }
  }
  return iArray;
}

// Create or update worklog (need to update related task effort)
router.post('/updateWorklog', async function(req, res, next) {
  console.log('Start to create or update worklog');
  var reqWorklogEffort = Number(req.body.reqWorklogEffort);
  Worklog.findOrCreate({
    where: {
      TaskId: Number(req.body.reqWorklogTaskId),
      UserId: Number(req.body.reqWorklogUserId),
      WorklogMonth: req.body.reqWorklogMonth,
      WorklogDay: req.body.reqWorklogDay
    }, 
    defaults: {
      TaskId: Number(req.body.reqWorklogTaskId),
      UserId: Number(req.body.reqWorklogUserId),
      WorklogMonth: req.body.reqWorklogMonth,
      WorklogDay: req.body.reqWorklogDay,
      Effort: reqWorklogEffort,
      Remark: req.body.reqWorklogRemark
    }
  }).spread(async function(worklog, created) {
    if(created) {
      await updateTaskEffort(req.body.reqWorklogTaskId, null, reqWorklogEffort, 0);
      return res.json(Utils.responseMessage(0, worklog, 'Create worklog successfully!'));
    } 
    else if(worklog != null && !created) {
      var worklogOldEffort = worklog.Effort;
      await worklog.update({
        TaskId: Number(req.body.reqWorklogTaskId),
        UserId: Number(req.body.reqWorklogUserId),
        WorklogMonth: req.body.reqWorklogMonth,
        WorklogDay: req.body.reqWorklogDay,
        Effort: Number(req.body.reqWorklogEffort),
        Remark: req.body.reqWorklogRemark
      })
      await updateTaskEffort(req.body.reqWorklogTaskId, null, reqWorklogEffort, worklogOldEffort);
      return res.json(Utils.responseMessage(0, worklog, 'Update worklog successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated worklog fail!'));
    }
  })
});

function updateTaskEffort(iTaskId, iTaskName, iTaskNewEffort, iTaskOldEffort) {
  return new Promise((resolve,reject)=>{
    console.log('Task Effort update -> ',iTaskId, iTaskName, iTaskNewEffort, iTaskOldEffort);
    var criteria = {};
    if (iTaskId != null && iTaskId != '') {
      criteria.Id = iTaskId
    }
    if (iTaskName != null && iTaskName != '') {
      criteria.Name = iTaskName
    }
    Task.findOne({
      where: criteria
    }).then(async function(task) {
      if (task != null) {
        taskOldEffort = task.Effort;
        var taskNewEffort = task.Effort - iTaskOldEffort + iTaskNewEffort;
        await task.update({Effort: taskNewEffort});
        if (task.ReferenceTask != null && task.ReferenceTask != '') {
          await updateTaskEffort(null, task.ReferenceTask, iTaskNewEffort, iTaskOldEffort);
        }
        resolve(true);
      } else {
        resolve(false);
      }
    })
  });
}

module.exports = router;
