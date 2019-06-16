var express = require('express');
var router = express.Router();
var Worklog = require('../model/worklog');
var Task = require('../model/task/task');
var TaskType = require('../model/task/task_type');
var Reference = require('../model/reference');

/* GET users listing. */
router.get('/', function(req, res, next) {
  return res.json({message: 'Response worklog resource'});
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
            resJson.worklog_progress = toPercent(worklog.task.Effort / worklog.task.Estimation);
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
  var newWorklogEffort = req.body.wEffort;
  console.log('Request: ' + JSON.stringify(req.body));
  Worklog.findOrCreate({
      where: {Id: req.body.wId}, 
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
    Task.findOne({where: {Id: req.body.wTaskId}}).then(function(task){
      if(task != null) {
        var taskEffort = task.Effort;
        var parentTaskName = task.ParentTaskName;
        Task.findOne({where: {TaskName: parentTaskName}}).then(function(parentTask){
          var parentTaskEffort = "-1";
          if(parentTask != null){
            parentTaskEffort = parentTask.Effort;
          }
          if(worklog != null && !created) {
            var oldWorklogEffort = worklog.Effort;
            if(oldWorklogEffort != newWorklogEffort){
              if(parentTaskEffort != "-1"){
                parentTaskEffort = Number(parentTaskEffort) + Number(newWorklogEffort) - Number(oldWorklogEffort);
                parentTask.update({Effort: parentTaskEffort});
              }
              taskEffort = Number(taskEffort) + Number(newWorklogEffort) - Number(oldWorklogEffort);
              Task.update({Effort: taskEffort}, {where: {Id: req.body.wTaskId}});
            }
            worklog.update({
              Remark: req.body.wRemark,
              Effort: req.body.wEffort,
              WorklogMonth: req.body.wWorklogMonth,
              WorklogDay: req.body.wWorklogDay,
              TaskId: req.body.wTaskId,
              UserId: req.body.wUserId
            });
            return res.json(responseMessage(0, worklog, 'Update worklog successfully'));
          } 
          else if(created){
            if(parentTaskEffort != "-1"){
              parentTaskEffort = Number(parentTaskEffort) + Number(newWorklogEffort);
              parentTask.update({Effort: parentTaskEffort});
            }
            taskEffort = Number(taskEffort) + Number(newWorklogEffort);
            Task.update({Effort: taskEffort}, {where: {Id: req.body.wTaskId}});
            return res.json(responseMessage(0, worklog, 'Create worklog successfully'));
          }
          else {
            return res.json(responseMessage(1, null, 'Create or update worklog fail'));
          }
        });
      }
    });
  })
});

//Remove worklog
router.post('/removeWorklogById', function(req, res, next) {
  Worklog.findAll({
    where: {
        Id: req.body.wId
    },
    limit: 1
    }).then(function(worklog) {
      if(worklog != null && worklog.length >0){
        Task.findAll({
          where: {Id: worklog[0].TaskId},
          limit: 1
        }).then(function(task){
          if(task != null && task.length >0) {
            var taskEffort = Number(task[0].Effort) - Number(worklog[0].Effort);
            Task.update({Effort: taskEffort}, {where: {Id: worklog[0].TaskId}});
          }
        });
        Worklog.destroy({where: {Id: req.body.wId}});
        return res.json(responseMessage(0, null, 'Remove worklog successfully'));
      } else {
        return res.json(responseMessage(1, null, 'Remove worklog fail'));
      }
    });
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

function toPercent(point){
  var str=Number(point*100).toFixed(0);
  str+="%";
  return str;
}

module.exports = router;
