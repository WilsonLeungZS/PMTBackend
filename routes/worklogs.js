var Sequelize = require('sequelize');
const Op = Sequelize.Op;
var express = require('express');
var router = express.Router();
var Worklog = require('../model/worklog');
var Task = require('../model/task/task');
var TaskType = require('../model/task/task_type');
var Reference = require('../model/reference');
var User = require('../model/user')
var Team = require('../model/team/team')

/* GET users listing. */
router.get('/', function(req, res, next) {
  return res.json({message: 'Response worklog resource'});
});

// Get month AD effort and AD target for web
router.post('/getMonthAdEffort', function(req, res, next) {
  var reqWorklogMonth = req.body.wWorklogMonth;
  Reference.findOne({where: {Name: "ADEffortTarget"}}).then(function(reference) {
    if(reference != null) {
      var adEffortTarget = Number(reference.Value);
      var rtnResult = [];
      Worklog.findAll({
        include: [{
          model: Task,
          attributes: ['Id', 'TaskName', 'Description', 'Status', 'Effort', 'Estimation'],
          where: {
            Id: { [Op.ne]: null },
            TaskName: {[Op.notLike]: 'Dummy - %'},
            Reference:  { [Op.ne]: null }
          }
        }],
        where: {
          WorklogMonth: reqWorklogMonth,
          Effort: { [Op.ne]: 0 },
          Id: { [Op.ne]: null }
        }
      }).then(function(worklog) {
        if(worklog.length > 0) {
          var resJson = {};
          resJson.month_target = Number(adEffortTarget);
          resJson.month_effort = 0;
          for(var i = 0; i< worklog.length; i++) {
            resJson.month_effort = Number(resJson.month_effort) + worklog[i].Effort;
          }
          rtnResult.push(resJson);
          return res.json(responseMessage(0, rtnResult, ''));
        } else {
          return res.json(responseMessage(1, rtnResult, 'No worklog existed'));
        }
      })
    } else {
      return res.json(responseMessage(1, rtnResult, 'No effort target existed'));
    }
  });
}); 

//Get worklog by user id and month
router.post('/getWorklogByUserAndMonth', function(req, res, next) {
  var reqWorklogUserId = req.body.wUserId;
  var reqWorklogMonth = req.body.wWorklogMonth;
  var arr = new Array();
  arr = reqWorklogMonth.split("-");
  var month = arr[1];
  var monthLength = 32;
  if(month == '02' || month == '04' || month == '06' || month == '09' || month == '11'){
    monthLength = 31;
  }
  var rtnResult = [];
  var weekdate = 0;
  Reference.findOne({where: {Name: "WeekDate"}}).then(function(reference){
    if(reference != null) {
      var weekdateJsonArray = JSON.parse(reference.Value);
      for(var i in weekdateJsonArray){
        if(weekdateJsonArray[i].Month == reqWorklogMonth) {
          weekdate = Number(weekdateJsonArray[i].Week);
        }
      }
    }
    Worklog.findAll({
      include: [{
          model: Task,
          attributes: ['TaskName'],
          include: [{model: TaskType, attributes: ['Category'],}]
      }],
      where: {
          UserId: reqWorklogUserId,
          WorklogMonth: reqWorklogMonth
      }
    }).then(function(worklog) {
        for(var a=1; a<monthLength;a++) {
            var resJson = {};
            if(a<10){
              resJson.day = "0" + a + "";
            } else {
              resJson.day = a + "";
            }
            resJson.ad_hrs = 0;
            resJson.am_hrs = 0;
            resJson.others_hrs = 0;
            resJson.total_hrs = 0;
            resJson.week_date = weekdate;
            weekdate = weekdate + 1;
            if(weekdate == 8){
              weekdate = 1;
            }
            rtnResult.push(resJson);
        }
        console.log('Request: ' + JSON.stringify(rtnResult));
        if(worklog.length > 0) {
            for(var i=0; i<worklog.length;i++){
                for(var d=0; d<rtnResult.length;d++){
                    if(rtnResult[d].day == worklog[i].WorklogDay) {
                        if(worklog[i].task.task_type.Category == "AD") {
                            rtnResult[d].ad_hrs = rtnResult[d].ad_hrs + worklog[i].Effort;
                        }
                        if(worklog[i].task.task_type.Category == "AM") {
                            rtnResult[d].am_hrs = rtnResult[d].am_hrs + worklog[i].Effort;
                        }
                        if(worklog[i].task.task_type.Category == "Others") {
                            rtnResult[d].others_hrs = rtnResult[d].others_hrs + worklog[i].Effort;
                        }
                        rtnResult[d].total_hrs = rtnResult[d].total_hrs + worklog[i].Effort;
                    }
                }
            }
            return res.json(responseMessage(0, rtnResult, ''));
        } else {
            return res.json(responseMessage(1, rtnResult, 'No worklog existed'));
        }
    })
  });
});

//Get worklog by user id and month for web timesheet
router.post('/getWorklogByUserAndMonthForWeb', function(req, res, next) {
  var reqWorklogUserId = req.body.wUserId;
  var reqWorklogMonth = req.body.wWorklogMonth;
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: Task,
      attributes: ['Id', 'TaskName', 'Description']
    }],
    where: {
      UserId: reqWorklogUserId,
      WorklogMonth: reqWorklogMonth,
      Effort: { [Op.ne]: 0 }
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(function(worklog) {
    if(worklog.length > 0) {
      for(var i=0; i< worklog.length; i++) {
        var resJson = {};
        var index = getIndexOfValueInArr(rtnResult, 'task_id', worklog[i].task.Id);
        if (index == -1 ) {
          resJson['task_id'] = worklog[i].task.Id;
          resJson['task'] = worklog[i].task.TaskName + ' - ' + worklog[i].task.Description;
          resJson['day' + worklog[i].WorklogDay] = worklog[i].Effort;
          rtnResult.push(resJson);
        } else {
          var item = rtnResult[index];
          if(item['task_id'] == worklog[i].task.Id) {
            item['day' + worklog[i].WorklogDay] = worklog[i].Effort;
          }
        }
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No worklog existed'));
    }
  })
});

//Get team worklog by team and month for web timesheet
router.post('/getWorklogByTeamAndMonthForWeb', function(req, res, next) {
  var reqUserList = req.body.wUserList.split(',');
  var reqWorklogMonth = req.body.wWorklogMonth;
  var rtnResult = [];
  Worklog.findAll({
    include: [{
        model: Task,
        attributes: ['Id', 'TaskName', 'Description']
    },{
      model: User,
      attributes: ['Name'],
      where: {
        Id: { [Op.in]: reqUserList }
      }
    }],
    where: {
      WorklogMonth: reqWorklogMonth,
      Effort: { [Op.ne]: 0 },
      Id: { [Op.ne]: null }
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(function(worklog) {
    if(worklog != null && worklog.length > 0) {
      for(var i=0; i<worklog.length; i++) {
        var resJson = {};
        var index = getIndexOfValueInArr(rtnResult, 'user', worklog[i].user.Name);
        if (index == -1 ) {
          resJson['user'] = worklog[i].user.Name;
          resJson['month'] = worklog[i].WorklogMonth;
          resJson['timesheetData'] = [];
          rtnResult.push(resJson);
        } else {
          continue;
        }
      }
      for(var a=0; a<rtnResult.length; a++) {
        var timesheetDataArray = [];
        for(var i=0; i<worklog.length; i++) {
          if(worklog[i].user.Name == rtnResult[a].user) {
            var resJson = {};
            var index = getIndexOfValueInArr(timesheetDataArray, 'task_id', worklog[i].task.Id);
            if (index == -1 ) {
              resJson['task_id'] = worklog[i].task.Id;
              resJson['task'] = worklog[i].task.TaskName + ' - ' + worklog[i].task.Description;
              resJson['day' + worklog[i].WorklogDay] = worklog[i].Effort;
              timesheetDataArray.push(resJson);
            } else {
              var item = timesheetDataArray[index];
              if(item['task_id'] == worklog[i].task.Id) {
                item['day' + worklog[i].WorklogDay] = worklog[i].Effort;
              }
            }
            rtnResult[a].timesheetData = timesheetDataArray;
          }
        }
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No worklog existed'));
    }
  })
});

router.post('/getWorklogTaskByMonthForWeb', function(req, res, next) {
  var reqWorklogMonth = req.body.sWorklogMonth;
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: Task,
      attributes: ['Id', 'TaskName', 'Description', 'Status', 'Reference', 'Effort', 'Estimation'],
      where: {
        Id: { [Op.ne]: null },
        TaskName: {[Op.notLike]: 'Dummy - %'},
        Reference: { [Op.ne]: null }
      }
    }],
    where: {
      WorklogMonth: reqWorklogMonth,
      Effort: { [Op.ne]: 0 },
      Id: { [Op.ne]: null }
    }
  }).then( async function(worklog) {
    if(worklog.length > 0) {
      var refSet = [];
      for(var i=0; i<worklog.length; i++) {
        var resJson = {};
        var index = getIndexOfValueInArr(rtnResult, 'tl_task', worklog[i].task.Reference);
        if (index == -1 ) {
          resJson['tl_task'] = worklog[i].task.Reference;
          resJson['tl_status'] = '';
          resJson['tl_estimation'] = '';
          resJson['tl_effort'] = '';
          resJson['tl_montheffort'] = worklog[i].Effort;
          rtnResult.push(resJson);
          refSet.push(worklog[i].task.Reference);
        } else {
          rtnResult[index]['tl_montheffort'] = rtnResult[index]['tl_montheffort'] + worklog[i].Effort;
        }
      }
      if(refSet.length > 0) {
        var refTaskList = await getReferenceTaskSet(refSet);
        for (var a=0; a<refTaskList.length; a++) {
          var index1 = getIndexOfValueInArr(rtnResult, 'tl_task', refTaskList[a].TaskName);
          if (index1 > -1 ) {
            rtnResult[index1]['tl_status'] = refTaskList[a].Status;
            rtnResult[index1]['tl_effort'] = refTaskList[a].Effort;
            rtnResult[index1]['tl_estimation'] = refTaskList[a].Estimation;
          }
        }
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No worklog existed'));
    }
  })
});

function getReferenceTaskSet(iTaskReference) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      attributes: ['Id', 'TaskName', 'Status', 'Effort', 'Estimation'],
      where: {
        TaskName: { [Op.in]: iTaskReference}
      }
    }).then(function(task){
      if(task != null) {
        resolve(task);
      } else {
        resolve(null);
      }
    })
  });
}

router.post('/getWorklogByMonthForWeb', function(req, res, next) {
  var reqWorklogMonth = req.body.sWorklogMonth;
  var reqTask = req.body.sWorklogTask;
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: Task,
      attributes: ['Id', 'TaskName', 'Reference', 'Status', 'Description', 'Effort', 'Estimation'],
      where: {
        Id: { [Op.ne]: null },
        Reference: reqTask
      }
    }, {
      model: User,
      attributes: ['Id', 'Name'],
    }],
    where: {
      WorklogMonth: reqWorklogMonth,
      Effort: { [Op.ne]: 0 },
      Id: { [Op.ne]: null }
    }
  }).then(async function(worklog) {
    if(worklog.length > 0) {
      var monthEffort = 0;
      var rtnResult1 = [];
      var rtnResult2 = [];
      var resJson1 = {};
      var refTask = await getReferenceTask(worklog[0].task.Reference)
      resJson1['tl_task_id'] = refTask.Id;
      resJson1['tl_task'] = refTask.TaskName;
      resJson1['tl_status'] = refTask.Status;
      resJson1['tl_desc'] = refTask.Description;
      resJson1['tl_estimation'] = refTask.Estimation;
      resJson1['tl_effort'] = refTask.Effort;
      resJson1['tl_month_effort'] = 0;
      rtnResult1.push(resJson1);
      for(var i=0; i<worklog.length; i++) {
        var resJson2 = {};
        resJson2['worklog_id'] = worklog[i].Id;
        resJson2['worklog_user'] = worklog[i].user.Name;
        resJson2['worklog_date'] = worklog[i].WorklogMonth + '-' + worklog[i].WorklogDay;
        resJson2['worklog_effort'] = worklog[i].Effort;
        resJson2['worklog_change_effort'] = worklog[i].Effort;
        monthEffort = monthEffort + worklog[i].Effort;
        rtnResult2.push(resJson2);
      }
      rtnResult1[0]['tl_month_effort'] = monthEffort;
      var resJson = {}
      resJson['task'] = rtnResult1;
      resJson['worklog'] = rtnResult2;
      rtnResult.push(resJson);
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No worklog existed'));
    }
  })
});

function getReferenceTask(iTaskReference) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {
        TaskName: iTaskReference
      }
    }).then(function(task){
      if(task != null) {
        resolve(task);
      } else {
        resolve(null);
      }
    })
  });
}

//Get worklog by worklog information
router.post('/getWorklogForWeb', function(req, res, next) {
  var reqUserId = req.body.wUserId;
  var reqTaskId = req.body.wTaskId;
  var reqWorklogMonth = req.body.wWorklogMonth;
  var reqWorklogDay = req.body.wWorklogDay;
  var rtnResult = [];
  Worklog.findOne({
    include: [{
        model: Task,
        attributes: ['Id', 'TaskName', 'Effort', 'Estimation']
    }],
    where: {
        UserId: reqUserId,
        TaskId: reqTaskId,
        WorklogMonth: reqWorklogMonth,
        WorklogDay: reqWorklogDay
    }
    }).then(function(worklog) {
      if(worklog != null) {
        var resJson = {};
        resJson.worklog_id = worklog.Id;
        resJson.worklog_task_id = worklog.task.Id;
        resJson.worklog_task_name = worklog.task.TaskName;
        resJson.worklog_effort = worklog.Effort;
        resJson.worklog_remark = worklog.Remark;
        resJson.worklog_task_effort = worklog.task.Effort == null? 0: worklog.task.Effort;
        resJson.worklog_task_estimation = worklog.task.Estimation == null? 0: worklog.task.Estimation;
        var percentage1 =  "" + toPercent(worklog.task.Effort, worklog.task.Estimation);
        resJson.worklog_task_progress_nosymbol = percentage1.replace("%","");
        rtnResult.push(resJson);
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        Task.findOne({
            attributes: ['Id', 'TaskName', 'Effort', 'Estimation'],
            where: {
              Id: reqTaskId
          }
        }).then(function(task) {
          if(task != null) {
            var resJson = {};
            resJson.worklog_task_effort = task.Effort == null? 0: task.Effort;
            resJson.worklog_task_estimation = task.Estimation == null? 0: task.Estimation;
            var percentage2 =  "" + toPercent(task.Effort, task.Estimation);
            resJson.worklog_task_progress_nosymbol = percentage2.replace("%","");
            rtnResult.push(resJson);
            return res.json(responseMessage(1, rtnResult, 'No worklog existed, but found task'));
          } else {
            return res.json(responseMessage(1, null, 'No worklog existed'));
          }
        })
      }
    })
});

//Get worklog by user id and Date
router.post('/getWorklogByUserAndDate', function(req, res, next) {
  var reqWorklogUserId = req.body.wUserId;
  var reqWorklogDate = req.body.wWorklogDate;
  var rtnResult = [];
  var arr = new Array();
  arr = reqWorklogDate.split("-");
  var reqWorklogMonth = arr[0] + "-" + arr[1];
  var reqWorklogDay = arr[2];
  Worklog.findAll({
    include: [{
        model: Task,
        attributes: ['TaskName', 'Status', 'Effort', 'Description'],
        include: [{model: TaskType, attributes: ['Name'],}]
    }],
    where: {
        UserId: reqWorklogUserId,
        WorklogMonth: reqWorklogMonth,
        WorklogDay: reqWorklogDay
    }
    }).then(function(worklog) {
        if(worklog.length > 0) {
          for(var i=0; i<worklog.length;i++){
            var resJson = {};
            resJson.worklog_id = worklog[i].Id;
            resJson.worklog_name = worklog[i].task.TaskName;
            resJson.worklog_desc = worklog[i].task.Description;
            resJson.worklog_type = worklog[i].task.task_type.Name;
            resJson.worklog_status = worklog[i].task.Status;
            resJson.worklog_hours = worklog[i].Effort;
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
        } else {
          return res.json(responseMessage(1, null, 'No worklog existed'));
        }
    })
});

//Get worklog by worklog id
router.post('/getWorklogById', function(req, res, next) {
  var reqWorklogId = req.body.wId;
  var rtnResult = [];
  Worklog.findOne({
    include: [{
      model: Task,
      attributes: ['Id', 'TaskName', 'Status', 'Effort', 'Estimation', 'Description'],
      include: [{model: TaskType, attributes: ['Name'],}]
    }],
    where: {
      Id: reqWorklogId
    }
    }).then(function(worklog) {
        if(worklog != null) {
          var resJson = {};
          resJson.worklog_id = worklog.Id;
          resJson.worklog_taskid = worklog.task.Id;
          resJson.worklog_name = worklog.task.TaskName;
          resJson.worklog_desc = worklog.task.Description;
          resJson.worklog_type = worklog.task.task_type.Name;
          resJson.worklog_status = worklog.task.Status;
          resJson.worklog_currenteffort = worklog.task.Effort;
          if(worklog.task.Estimation != null){
            resJson.worklog_totaleffort =  worklog.task.Estimation;
            resJson.worklog_progress = toPercent(worklog.task.Effort, worklog.task.Estimation);
          } else {
            resJson.worklog_totaleffort = "0"
            resJson.worklog_progress = "0";
          }
          resJson.worklog_hours = worklog.Effort;
          resJson.worklog_remark = worklog.Remark;
          rtnResult.push(resJson);
          return res.json(responseMessage(0, rtnResult, ''));
        } else {
          return res.json(responseMessage(1, null, 'No worklog existed'));
        }
    })
});

//Add New Work Log
router.post('/addOrUpdateWorklog', function(req, res, next) {
  console.log('Request: ' + JSON.stringify(req.body));
  Worklog.findOrCreate({
      where: {
        [Op.or]: [
          {
            UserId: req.body.wUserId,
            TaskId: req.body.wTaskId,
            WorklogMonth: req.body.wWorklogMonth,
            WorklogDay: req.body.wWorklogDay,
          }
        ]
      }, 
      defaults: {
        Remark: req.body.wRemark,
        Effort: req.body.wEffort,
        WorklogMonth: req.body.wWorklogMonth,
        WorklogDay: req.body.wWorklogDay,
        TaskId: req.body.wTaskId,
        UserId: req.body.wUserId
      }
    })
  .spread((worklog, created) => {
    Task.findOne({where: {Id: req.body.wTaskId}}).then(async function(task){
      if(task != null) {
        var parentTask1 = await getParentTask(task.ParentTaskName);
        var parentTask2 = null;
        if(parentTask1 != null && parentTask1.ParentTaskName != 'N/A' && parentTask1.TaskLevel != 2){
          parentTask2 = await getParentTask(parentTask1.ParentTaskName);
        }
        var taskEffort = 0;
        var newWorklogEffort = req.body.wEffort;
        //If worklog Existing
        if(worklog != null && !created) {
          var oldWorklogEffort = worklog.Effort;
          // If reference task not null, update reference task effort
          if (task.Reference != null && task.Reference != '') {
            var refTask = task.Reference;
            var refTaskUpdatedEffort = await updateReferenceTaskEffort(newWorklogEffort, oldWorklogEffort, refTask);
          }
          taskEffort = Number(task.Effort) + Number(newWorklogEffort) - Number(oldWorklogEffort);
          Task.update({Effort: taskEffort}, {where: {Id: req.body.wTaskId}}); // Update worklog related task effort
          worklog.update({
            Remark: req.body.wRemark,
            Effort: req.body.wEffort,
            WorklogMonth: req.body.wWorklogMonth,
            WorklogDay: req.body.wWorklogDay,
            TaskId: req.body.wTaskId,
            UserId: req.body.wUserId
          }); //Update worklog
          if (parentTask1 != null) {
            taskEffort = Number(parentTask1.Effort) + Number(newWorklogEffort) - Number(oldWorklogEffort);
            parentTask1.update({Effort: taskEffort}); // Update parent task 1 effort
            /* if (parentTask1.Reference != null && parentTask1.Reference != '') {
              var refTask1 = parentTask1.Reference;
              var refTaskUpdatedEffort = await updateReferenceTaskEffort(newWorklogEffort, oldWorklogEffort, refTask1);
            } */
          }
          if (parentTask2 != null) {
            taskEffort = Number(parentTask2.Effort) + Number(newWorklogEffort) - Number(oldWorklogEffort);
            parentTask2.update({Effort: taskEffort}); // Update parent task 2 effort
            /* if (parentTask2.Reference != null && parentTask2.Reference != '') {
              var refTask2 = parentTask2.Reference;
              var refTaskUpdatedEffort = await updateReferenceTaskEffort(newWorklogEffort, oldWorklogEffort, refTask2);
            } */
          }
          return res.json(responseMessage(0, worklog, 'Update worklog successfully'));
        }
        else if(created){
          if (task.Reference != null && task.Reference != '') {
            var refTask = task.Reference;
            var refTaskUpdatedEffort = await updateReferenceTaskEffort(newWorklogEffort, 0, refTask);
          }
          taskEffort = Number(task.Effort) + Number(newWorklogEffort);
          Task.update({Effort: taskEffort}, {where: {Id: req.body.wTaskId}}); // Update worklog related task effort
          if (parentTask1 != null) {
            taskEffort = Number(parentTask1.Effort) + Number(newWorklogEffort);
            parentTask1.update({Effort: taskEffort}); // Update parent task 1 effort
            /* if (parentTask1.Reference != null && parentTask1.Reference != '') {
              var refTask1 = parentTask1.Reference;
              var refTaskUpdatedEffort = await updateReferenceTaskEffort(newWorklogEffort, 0, refTask1);
            } */
          }
          if (parentTask2 != null) {
            taskEffort = Number(parentTask2.Effort) + Number(newWorklogEffort);
            parentTask2.update({Effort: taskEffort}); // Update parent task 2 effort
            /* if (parentTask2.Reference != null && parentTask2.Reference != '') {
              var refTask2 = parentTask2.Reference;
              var refTaskUpdatedEffort = await updateReferenceTaskEffort(newWorklogEffort, 0, refTask2);
            } */
          }
          return res.json(responseMessage(0, worklog, 'Create worklog successfully'));
        }
        else {
          return res.json(responseMessage(1, null, 'Create or update worklog fail'));
        }
      } else {
        return res.json(responseMessage(1, null, 'Create or update worklog fail'));
      }
    });
  })
});

//Remove worklog
router.post('/removeWorklog', function(req, res, next) {
  console.log('Request: ' + JSON.stringify(req.body));
  Worklog.findOne({
      where: {
        UserId: req.body.wUserId,
        TaskId: req.body.wTaskId,
        WorklogMonth: req.body.wWorklogMonth,
        WorklogDay: req.body.wWorklogDay
      }
    })
  .then((worklog) => {
    Task.findOne({where: {Id: req.body.wTaskId}}).then(async function(task){
      if(task != null) {
        var parentTask1 = await getParentTask(task.ParentTaskName);
        var parentTask2 = null;
        if(parentTask1 != null && parentTask1.ParentTaskName != 'N/A' && parentTask1.TaskLevel != 2){
          parentTask2 = await getParentTask(parentTask1.ParentTaskName);
        }
        var taskEffort = 0;
        if(worklog != null) {
          if (task.Reference != null && task.Reference != '') {
            var refTask1 = task.Reference;
            var refTaskUpdatedEffort = await updateReferenceTaskEffort(0, worklog.Effort, refTask1);
          }
          taskEffort = Number(task.Effort) - Number(worklog.Effort);
          Task.update({Effort: taskEffort}, {where: {Id: req.body.wTaskId}}); // Update worklog related task effort
          if (parentTask1 != null) {
            taskEffort = Number(parentTask1.Effort) - Number(worklog.Effort);
            parentTask1.update({Effort: taskEffort}); // Remove parent task 1 effort
            /* if (parentTask1.Reference != null && parentTask1.Reference != '') {
              var refTask2 = parentTask1.Reference;
              var refTaskUpdatedEffort = await updateReferenceTaskEffort(0, worklog.Effort, refTask2);
            } */
          }
          if (parentTask2 != null) {
            taskEffort = Number(parentTask2.Effort) - Number(worklog.Effort);
            parentTask2.update({Effort: taskEffort}); // Remove parent task 2 effort
            /* if (parentTask2.Reference != null && parentTask2.Reference != '') {
              var refTask3 = parentTask2.Reference;
              var refTaskUpdatedEffort = await updateReferenceTaskEffort(0, worklog.Effort, refTask3);
            } */
          }
          worklog.update({Effort: 0}); //Set worklog effort to 0
          return res.json(responseMessage(0, worklog, 'Remove worklog successfully'));
        }
        else {
          return res.json(responseMessage(1, null, 'Remove worklog fail'));
        }
      } else {
        return res.json(responseMessage(1, null, 'Remove worklog fail'));
      }
    });
  })
});

//george
router.post('/getTaskStatusAndLevel', function(req, res, next) {
  console.log('Request: ' + JSON.stringify(req.body));
  Task.findOne({
    where: {
      Id: req.body.TaskId
    }
  }).then(async function(sch){
    if(sch!=null) {
      var rtnResult = {};
      rtnResult.task_status = sch.Status;
      rtnResult.task_level = sch.TaskLevel;
      console.log("getTaskStatusAndLevel result: " + rtnResult);
      return res.json(responseMessage(0, rtnResult, ''));
    }else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  });
});

function getParentTask (iParentTaskName) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {
        TaskName: iParentTaskName
      }
    }).then(function(parentTask){
      console.log('Debug 1');
      if(parentTask != null) {
        resolve(parentTask);
      } else {
        resolve(null);
      }
    })
  });
}

function updateReferenceTaskEffort (iNewEffort, iOldEffort, iRefTaskName) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {
        TaskName: iRefTaskName
      }
    }).then(function(task){
      if (task != null) {
        var taskEffort = Number(task.Effort) + Number(iNewEffort) - Number(iOldEffort);
        task.update({Effort: taskEffort});
        resolve(taskEffort);
      } else {
        resolve(null);
      }
    });
  });
}

//Get worklog history for web PMT
router.post('/getWorklogHistoryByTaskId', function(req, res, next) {
  var reqWorklogTaskId = req.body.wTaskId;
  console.log(reqWorklogTaskId)
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: User,
      attributes: ['Name']
    }],
    where: {
      TaskId: Number(reqWorklogTaskId),
      Effort: { [Op.ne]: 0 }
    }
  }).then(function(worklog) {
    if(worklog != null && worklog.length >0){
      for(var i=0; i<worklog.length;i++){
        var resJson = {};
        resJson.timestamp = worklog[i].WorklogMonth + '-' + worklog[i].WorklogDay
        resJson.content = worklog[i].user.Name + ' recorded ' + worklog[i].Effort + ' hours'
        rtnResult.push(resJson)
      }
      rtnResult = sortArray(rtnResult, 'timestamp')
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'Worklog history not found'));
    }
  })
});

router.post('/adjustWorklogForWeb', function(req, res, next) {
  var reqWorklogId = req.body.wWorklogId
  var reqWorklogChangeEffort = Number(req.body.wWorklogChangeEffort)
  Worklog.findOne({
    include: [{
        model: Task
      },{
        model: User,
        include: [{model: Team, attributes: ['Id','Name']}]
      }],
      where: {
        Id: reqWorklogId
      }
    }).then(async function(worklog) {
      if(worklog != null){
        // Update effort of worklog which need to be adjust
        var iEffort = Number(worklog.Effort) - reqWorklogChangeEffort
        Worklog.update({Effort: iEffort}, {where: {Id: reqWorklogId}});
        //Get reference task
        var refTask = await getReferenceTask(worklog.task.Reference)
        //Create Dummy Task
        dummyTaskName = 'Dummy - ' + refTask.TaskName
        console.log('Dummy Task Name: ' + dummyTaskName)
        Task.findOrCreate({
          where: {
            TaskName: dummyTaskName
          }, 
          defaults: {
            ParentTaskName: refTask.ParentTaskName,
            TaskName: dummyTaskName,
            Description: refTask.Description,
            TaskTypeId: Number(worklog.task.TaskTypeId),
            Status: refTask.Status,
            Creator: 'PMT:Dummy',
            Effort: reqWorklogChangeEffort,
            Estimation: 0,
            TaskLevel: refTask.TaskLevel,
            IssueDate: getNowFormatDate()
          }
        })
      .spread((task, created) => {
        var dummyTaskId = task.Id;
        if(task != null) {
          console.log('Dummy Task Id: ' + dummyTaskId)
          // Record dummy worklog of dummy task for user
          Worklog.findOrCreate({
            where: {
              WorklogMonth: worklog.WorklogMonth,
              WorklogDay: worklog.WorklogDay,
              TaskId: dummyTaskId,
              UserId: worklog.UserId
             },
            defaults: {
              Remark: worklog.Remark,
              Effort: reqWorklogChangeEffort,
              WorklogMonth: worklog.WorklogMonth,
              WorklogDay: worklog.WorklogDay,
              TaskId: dummyTaskId,
              UserId: worklog.UserId
          }}).spread((dummyWorklog, created) => {
            //console.log('Dummy Worklog: ' + dummyWorklog.Id)
            if(dummyWorklog != null) {
              if(!created) {
                var newEffort = Number(dummyWorklog.Effort) + Number(reqWorklogChangeEffort);
                Worklog.update({Effort: newEffort}, {where: {Id: dummyWorklog.Id}});
              }
              User.findOne({
                where: {
                  Name: {[Op.like]: 'team%'},
                  TeamId: worklog.user.team.Id
                }
              }).then(function(user) {
                console.log('Team User: ' + user)
                if(user != null) {
                  var iDate = worklog.WorklogMonth  
                  var arr = iDate.split("-");
                  var iYear = Number(arr[0])
                  var iMonth = Number(arr[1])
                  if(iMonth == 12) {
                    iMonth = 1
                    iYear = iYear + 1
                  } else {
                    iMonth = iMonth + 1
                  }
                  if(iMonth < 10){
                    iMonth = '0' + iMonth
                  }
                  var worklogMonth = '' + iYear + '-' + iMonth
                  // Record actual effort of actual task for team account
                  Worklog.findOrCreate({
                    where: {
                      WorklogMonth: worklogMonth,
                      WorklogDay: '01',
                      TaskId: worklog.task.Id,
                      UserId: user.Id
                    },
                    defaults: {
                      Remark: worklog.Remark,
                      Effort: reqWorklogChangeEffort,
                      WorklogMonth: worklogMonth,
                      WorklogDay: '01',
                      TaskId: worklog.task.Id,
                      UserId: user.Id
                  }}).spread((teamWorklog, created) => {
                    console.log('Team Worklog: ' + teamWorklog)
                    if(teamWorklog != null){
                      if(!created) {
                        var newEffort1 = Number(teamWorklog.Effort) + Number(reqWorklogChangeEffort);
                        Worklog.update({Effort: newEffort1}, {where: {Id: teamWorklog.Id}});
                      }
                      return res.json(responseMessage(0, null, 'Adjust worklog successfully'));
                    } else { // Team Worklog Created
                      return res.json(responseMessage(1, null, 'Adjust worklog fail: Team worklog fail to create or update'));
                    }
                  });
                } else { // Team Account found
                  return res.json(responseMessage(1, null, 'Adjust worklog fail: Team Account fail to found'));
                }
              });
            } else { // Dummy worklog created
              return res.json(responseMessage(1, null, 'Adjust worklog fail: Dummy Worklog create or update failed'));
            }
          });
        } else { // Dummy task created or found
          return res.json(responseMessage(1, null, 'Adjust worklog fail: Dummy task could not found or create failed'));
        }
      });
    } else {
      return res.json(responseMessage(1, null, 'Adjust worklog fail'));
    }
  });
});



//Extract report1(only AD/AM/BD for task category) for web PMT
router.post('/extractReport1ForWeb', function(req, res, next) {
  console.log("Start to extractReport1ForWeb")
  var reqReportStartMonth = req.body.wReportStartMonth;
  var reqReportEndMonth = req.body.wReportEndMonth;
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: User,
      attributes: ['Name'],
      where: {
        Id: { [Op.ne]: null }
      }
    }, {
      model: Task,
      attributes: ['TaskName', 'Description', 'Reference', 'BizProject'],
      where: {
        Id: { [Op.ne]: null },
        [Op.or]: [
          { TaskName: { [Op.like]: 'MTL19.1%'} },
          { TaskName: { [Op.like]: 'MTL19.2%'} }
        ]
      },
      include: [{
        model: TaskType, 
        attributes: ['Name'],
        where: {
          Name: 'Business-AD',
          Id: { [Op.ne]: null }
        }
      }]
    }],
    where: {
      [Op.and]: [
        { WorklogMonth: { [Op.gte]:  reqReportStartMonth }},
        { WorklogMonth: { [Op.lte]:  reqReportEndMonth }}
      ],
      Effort: { [Op.ne]: 0 },
      Id: { [Op.ne]: null }
    }
  }).then(function(worklog) {
     console.log(worklog)
     if(worklog != null && worklog.length >0){
      for(var i=0; i<worklog.length;i++){
        var resJson = {};
        resJson.report_username = worklog[i].user.Name
        resJson.report_date = worklog[i].WorklogMonth + '-' + worklog[i].WorklogDay
        resJson.report_month = worklog[i].WorklogMonth
        resJson.report_task = worklog[i].task.TaskName
        resJson.report_taskdesc = worklog[i].task.Description
        resJson.report_worklogremark = worklog[i].Remark
        resJson.report_ref = worklog[i].task.Reference
        resJson.report_manhours = Number(worklog[i].Effort)
        resJson.report_mandays = (Number(worklog[i].Effort) / 8).toFixed(2)
        resJson.report_bizproject = worklog[i].task.BizProject
        resJson.report_taskcategory = worklog[i].task.task_type.Name
        rtnResult.push(resJson)
      }
      rtnResult = sortArray(rtnResult, 'report_date')
      return res.json(responseMessage(0, rtnResult, ''));
     } else {
       return res.json(responseMessage(1, null, 'Worklog not found'));
     }
  })
});

//Extract report2(cover all projects/members) for web PMT
router.post('/extractReport2ForWeb', function(req, res, next) {
  console.log("Start to extractReport2ForWeb")
  var reqReportStartMonth = req.body.wReportStartMonth;
  var reqReportEndMonth = req.body.wReportEndMonth;
  var rtnResult = [];
  Worklog.findAll({
    include: [{
      model: User,
      attributes: ['Name']
    }, {
      model: Task,
      attributes: ['TaskLevel', 'ParentTaskName', 'TaskName', 'Description', 'Estimation', 'Reference', 'IssueDate', 'TargetCompleteDate', 'ActualCompleteDate', 'BizProject'],
      where: {
        //TaskName: {[Op.notLike]: 'Dummy - %'},
        Id: { [Op.ne]: null }
      },      
      include: [{
        model: TaskType, 
        attributes: ['Name'],
        where: {
          Id: { [Op.ne]: null }
        }
      }]
    }],
    where: {
      [Op.and]: [
        { WorklogMonth: { [Op.gte]:  reqReportStartMonth }},
        { WorklogMonth: { [Op.lte]:  reqReportEndMonth }}
      ],
      Effort: { [Op.ne]: 0 },
      Id: { [Op.ne]: null }
    }
  }).then(async function(worklog) {
    if(worklog!=null && worklog.length>0){
      var response = await reportTaskInfo(worklog);     
      return res.json(responseMessage(0, response, ''));
    }else{
      return res.json(responseMessage(1, null, 'Worklog not found'));
    }
  })
});

function reportTaskInfo(worklog){
  return new Promise(async(resolve,reject)=>{
    var rtnResult = []
    for(var i=0; i<worklog.length;i++){
      var resJson = {};
      resJson.report_username = worklog[i].user.Name
      resJson.report_date = worklog[i].WorklogMonth + '-' + worklog[i].WorklogDay
      resJson.report_month = worklog[i].WorklogMonth
      resJson.report_task = worklog[i].task.TaskName
      resJson.report_ref = worklog[i].task.Reference
      resJson.report_taskdesc = worklog[i].task.Description
      resJson.report_worklogremark = worklog[i].Remark
      resJson.report_manhours = Number(worklog[i].Effort)
      resJson.report_mandays = (Number(worklog[i].Effort) / 8).toFixed(2)
      resJson.report_Estimation = worklog[i].task.Estimation
      resJson.report_issuedate = worklog[i].task.IssueDate
      resJson.report_targetCom = worklog[i].task.TargetCompleteDate
      resJson.report_actCom = worklog[i].task.ActualCompleteDate
      resJson.report_bizproject = worklog[i].task.BizProject
      resJson.report_taskcategory = worklog[i].task.task_type.Name
      var taskLevel = worklog[i].task.TaskLevel
      if(worklog[i].task.ParentTaskName!=null && worklog[i].task.ParentTaskName!='N/A'){
        if (taskLevel == 3) {
          resJson.report_l2TaskNumber = worklog[i].task.ParentTaskName
          var lv2Task = await findTask(worklog[i].task.ParentTaskName)
          resJson.report_l1TaskNumber = lv2Task.ParentTaskName
        }
        if (taskLevel == 4) {
          var lv3Task = await findTask(worklog[i].task.ParentTaskName)
          resJson.report_l2TaskNumber = lv3Task.ParentTaskName
          var lv2Task = await findTask(lv3Task.ParentTaskName)
          resJson.report_l1TaskNumber = lv2Task.ParentTaskName
        }
      }
      rtnResult.push(resJson)
    }
      rtnResult = sortArray(rtnResult, 'report_date')
      resolve(rtnResult)
   })
}

function findTask(iTaskName){
  return new Promise((resolve,reject)=>{
   Task.findOne({
      attributes: ['ParentTaskName', 'TaskName'],
      where:{
        TaskName: iTaskName
      }      
   }).then(async function(task){
      if(task!=null){
        resolve(task)          
      }
    });  
  });
}


function sortArray(iArray, iKey)
{
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

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

function toPercent(numerator, denominator){
  var point = Number(numerator) / Number(denominator);
  if (point > 1) {
    point = 1;
  }
  var str=Number(point*100).toFixed(0);
  str+="%";
  return str;
}

function getIndexOfValueInArr(iArray, iKey, iValue) {
  for(var i=0; i<iArray.length;i++) {
    var item = iArray[i];
    if(item[iKey] == iValue){
      return i;
    }
  }
  return -1;
}

function getNowFormatDate() {
  var date = new Date();
  var seperator1 = "-";
  var seperator2 = ":";
  var month = date.getMonth() + 1;
  var strDate = date.getDate();
  if (month >= 1 && month <= 9) {
      month = "0" + month;
  }
  if (strDate >= 0 && strDate <= 9) {
      strDate = "0" + strDate;
  }
  var currentdate = date.getFullYear() + seperator1 + month + seperator1 + strDate
          + " " + date.getHours() + seperator2 + date.getMinutes()
          + seperator2 + date.getSeconds();
  return currentdate;
} 

module.exports = router;
