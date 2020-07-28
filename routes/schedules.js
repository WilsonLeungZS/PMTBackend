var Sequelize = require('sequelize');
var db = require('../config/db');
var express = require('express');
var router = express.Router();
var Schedule = require('../model/schedule');
var nodeSchedule = require('node-schedule');
var dateFormat = require('dateformat');
var Task = require('../model/task/task');
var taskItem = require('../services/taskItem');
var dateConversion = require('../util/dataConversion');
const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response formats resource'});
});

router.post('/saveRegularTask',async function(req,res,next){
  console.log('saveRegularTask')
  var tTaskName = req.body.reqTaskName;
  console.log(req.body);
  var jobId = 'PMT' + tTaskName;
  var tTaskId = null;
  var tRegularTaskTime = req.body.reqRegularTaskTime;
  tTaskId = await taskItem.getTaskId(tTaskName);
  Schedule.findOrCreate({
    where: { TaskName : tTaskName}, 
    defaults: {
    Schedule: req.body.reqSchedule,
    RegularTime: tRegularTaskTime,
    StartTime: req.body.reqStartTime,
    JobId: jobId,
    TaskName : tTaskName,
    TaskId: tTaskId,
    Status: 'Planning',
    EndTime: req.body.reqEndTime
  }})
  .spread(async function(schedule, created) {
    console.log(schedule)
    if(created) {
      return res.json(responseMessage(0, schedule, 'Create schedule successfully!'));
    }
    else if(schedule != null && !created) {
      schedule.update({
        TaskId: tTaskId,
        Schedule: req.body.reqSchedule,
        RegularTime: tRegularTaskTime,
        StartTime: req.body.reqStartTime,
        EndTime: req.body.reqEndTime
      });
      return res.json(responseMessage(0, schedule, 'Update schedule successfully!'));
    }
    else {
      return res.json(responseMessage(1, null, 'Created or updated schedule fail!'));
    }
  })
});

router.post('/getSchedulesByTaskName',function(req,res,next){
  console.log('getSchedulesByTaskName')
  Schedule.findOne({
    where: {TaskName: req.body.reqTaskName}
  }).then(async function(schedule) {
    if(schedule!=null) {
      console.log(schedule)
      var rtnResult = {}
      rtnResult.task_startTime = schedule.StartTime
      rtnResult.task_RegularTaskTime = schedule.RegularTime
      rtnResult.task_endTime = schedule.EndTime
      rtnResult.task_scheduletime = schedule.Schedule
      return res.json(responseMessage(0, rtnResult, ''));
    } 
    else {
      return res.json(responseMessage(1, null, 'No sub task exist'));
    }
  })
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

router.get('/startBackgroundJob', function(req, res, next) {
  console.log('Start to Schedule background Job');
  var reqJobId = 'BackGroundJob';
  var runningJob = nodeSchedule.scheduledJobs[reqJobId];
  if (runningJob != null) {
      runningJob.cancel();
  }
  //var iJobConfiguration = '0,10,20,30,40,50 * * * * *';
  var iJobConfiguration = '0 0 1-23 * * *';
  nodeSchedule.scheduleJob(reqJobId, iJobConfiguration, function(){
    console.log("The Schedule background Job start to run. time: " + new Date());
    ReActiveRegularJob();
    AutoCreateRegularTask();
    cancelScheduleJob();
  }); 
  console.log('Schedule background Job End');
  return res.json({message: 'Schedule background Job'});
});

router.get('/cancelBackgroundJob', function(req, res, next) {
  console.log('Start to cancel background Job');
  var reqJobId = 'BackGroundJob';
  var runningJob = nodeSchedule.scheduledJobs[reqJobId];
  console.log('Cancel Job ----------------------------->');
  console.log(runningJob.cancel());
  console.log('Cancel Job <-----------------------------');
  return res.json({message: 'Cancel Schedule Job end'});
});

router.get('/getSchedulejobList', function(req, res, next) {
  var allJobList = nodeSchedule.scheduledJobs
  console.log(allJobList);
  return res.json({message: 'Start to get Schedule Job List' + allJobList});
});

function ReActiveRegularJob(){
  console.log('Start to Re-Schedule Regular Job');
  var today = dateFormat(new Date(), "yyyy-mm-dd");
  console.log('Current day: ' + today);
  Schedule.findAll({
    attributes: ['JobId','TaskName','cronJonTime','Schedule','RegularTime','StartTime'],
    where: { 
      EndTime: { [Op.gt]: today},
      Status: 'Running'
    },
  }).then(function(sch) {
    if(sch.length === 0){
      console.log('No regular Job End time is: ' + today + ', list size: ' + sch.length);
      return false;
    }
    for(var i = 0; i < sch.length; i++){
      var tempJobId = sch[i].JobId;
      var tTaskName = sch[i].TaskName;
      var tSchedule = sch[i].Schedule;
      var tRegularTime = sch[i].RegularTime;
      var tStartTime = sch[i].StartTime;
      var crossbar = tStartTime.split("-");
      var day = crossbar[2];
      console.log("Job " +  tempJobId + 'start day is ' + day);
      console.log('JobId: ' + tempJobId);
      createScheduleJob(tempJobId,tTaskName,tSchedule,tRegularTime,day)
    }
  });
}

function AutoCreateRegularTask() {
  console.log('Create Or Update schedule Job Start: ------------->');
  var today = new Date();
  var tDay = dateFormat(today, "yyyy-mm-dd");
  var day = today.getDay();
  console.log('Current day: ' + tDay + ', and the day is ' + day);
  Schedule.findAll({
    attributes: ['JobId','TaskName','Schedule','RegularTime'],
    where: { 
      StartTime: { [Op.lte]: tDay },
      Status: 'Planning'
    },
  }).then(function(sch) {
    if(sch.length === 0){
      console.log('No regular Start time is: ' + tDay + ', list size: ' + sch.length);
      return false;
    } 
    for(var i = 0; i < sch.length; i++){
      var tempJobId = sch[i].JobId;
      var tTaskName = sch[i].TaskName;
      var tSchedule = sch[i].Schedule;
      var tRegularTime = sch[i].RegularTime;
      console.log('JobId: ' + tempJobId);
      createScheduleJob(tempJobId,tTaskName,tSchedule,tRegularTime,day);
      taskItem.createTaskByScheduleJob(tTaskName);
      taskItem.regularTaskSubTask(tTaskName);
    }
  });
  return true;
}


function createScheduleJob(jId,tTaskName,tSchedule,tRegularTime,day) {
  var previousTime = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss");
  try{
    var cronJonTime;
    var arr = [];
    arr = tSchedule.split(' ');
    switch(tRegularTime){
      case 'Daily':
       if(tSchedule == 'Every Weekday'){
        cronJonTime = "0 0 2 * * 1,2,3,4,5";
        console.log('final cronJonTime: ' + cronJonTime);
       }else{
        var days = arr[1];
        cronJonTime = "0 0 2 " + day + "/" + days + " * *"
        console.log('final cronJonTime: ' + cronJonTime);
       }
      break;
      case 'Weekly':
        var week = arr[2];
        var dayOfWeek = arr[5];
        var dayOfWeek1 = dateConversion.weekConversionToNumber(dayOfWeek);
        var interval = Number(week) * Number(7);
        console.log('convert time: ' + week + ',' + dayOfWeek + ',' + interval);
        
        cronJonTime = "0 0 2 * * " + dayOfWeek1 + '#' + dayOfWeek1;
        console.log('final cronJonTime: ' + cronJonTime);
        break;
      case 'Monthly':
        var checkDay = null;
        var dayOfWeek = null;
        var checkWeek = null;
        var checkMonth = null;
        if(Number(arr.length == 7)){
          checkWeek = arr[1];
          dayOfWeek = arr[2];
          checkMonth = arr[5];
          console.log('convert time: ' + checkWeek + ',' + dayOfWeek + ',' + checkMonth);
          var dayOfWeek1 = dateConversion.weekConversionToNumber(dayOfWeek);
          var rank = dateConversion.rankConversionToNumber(checkWeek);
          cronJonTime = "0 0 2 * " + "*/" + checkMonth + " " + rank + "#" + dayOfWeek1;
          console.log('final cronJonTime: ' + cronJonTime);
        }else if(Number(arr.length == 6)){
          checkDay = arr[1];
          checkMonth = arr[4];
          cronJonTime = "0 0 2 * " + checkDay + "/" + checkMonth +" *";
          console.log('final cronJonTime: ' + cronJonTime);
          console.log('convert time: ' + checkDay + ',' + checkMonth);
        }
        break;
    }
    console.log('Start Schedule Job');
    var runningJob = nodeSchedule.scheduledJobs[jId];
    if (runningJob != null) {
      runningJob.cancel();
    }
    nodeSchedule.scheduleJob(jId, cronJonTime, function(){
      taskItem.createTaskByScheduleJob(tTaskName);
      taskItem.regularTaskSubTask(tTaskName);
    });
    console.log('Finish Schedule Job');

    Schedule.update({
      Status: 'Running',
      PreviousTime: previousTime,
      cronJonTime: cronJonTime
    },
      {where: {JobId: jId}
    });

    Task.update({
      Status: 'Running'
    },
      {where: {TaskName: tTaskName}
    });
  }catch(Exception){
      console.log('Exception occurred: ' + Exception);
  }
};

function cancelScheduleJob () {
  console.log('Start to cancel Schedule Job by job id');
  var day = dateFormat(new Date(), "yyyy-mm-dd");
  console.log('Current day: ' + day);
  Schedule.findAll({
    attributes: ['JobId','TaskName'],
    where: { 
      EndTime: day,
      Status: { [Op.ne]: 'Done' }
    },
  }).then(function(sch) {
    if(sch.length === 0){
      console.log('No regular End time is: ' + day + ', list size: ' + sch.length);
      return false;
    } 
    for(var i = 0; i < sch.length; i++){
      var tempJobId = sch[i].JobId;
      console.log('Start to cancel job ' + tempJobId);
      var runningJob = nodeSchedule.scheduledJobs[String(tempJobId)];
      console.log('Start To Cancel Schedule Job ----------------------------->');
      if(runningJob != null){
        if(runningJob.cancel()){
          Schedule.update({
            Status: 'Done'
          },
            {where: {JobId: tempJobId}
          });
          Task.update({
            Status: 'Done'
          },
            {where: {TaskName: sch[i].TaskName}
          });
          console.log('JobId: ' + tempJobId + ' was done.');
        }
      }
      console.log('Cancel Schedule Job End----------------------------->');
    }
  });
  return true;
};

module.exports = router;