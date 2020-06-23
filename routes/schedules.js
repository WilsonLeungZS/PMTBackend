var Sequelize = require('sequelize');
var db = require('../config/db');
var express = require('express');
var router = express.Router();
var Schedule = require('../model/schedule');
var nodeSchedule = require('node-schedule');
var dateFormat = require('dateformat');
var Task = require('../model/task/task');
var taskItem = require('../services/taskItem');
const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response formats resource'});
});

router.post('/saveRegularTask',function(req,res,next){
  console.log('saveRegularTask')
  var tTaskId = req.body.reqTaskId;
  var jobId = 'PMT' + tTaskId;
  Schedule.findOrCreate({
    where: { TaskId : req.body.reqTaskId}, 
    defaults: {
    Schedule: req.body.reqSchedule,
    RegularTime: req.body.reqRegularTaskTime,
    StartTime: req.body.reqStartTime,
    JobId: jobId,
    TaskId : tTaskId,
    Status: 'Planning',
    EndTime: req.body.reqEndTime
  }})
  .spread(function(schedule, created) {
    console.log(schedule)
    if(created) {
      return res.json(responseMessage(0, schedule, 'Create schedule successfully!'));
    }
      else if(schedule != null && !created) {
      schedule.update({
      Schedule: req.body.reqSchedule,
      RegularTime: req.body.reqRegularTaskTime,
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
    where: {TaskId: req.body.reqTaskName}
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
  var iJobConfiguration = '1 * * * * *';
  nodeSchedule.scheduleJob(reqJobId, iJobConfiguration, function(){
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
    attributes: ['JobId','TaskId','cronJonTime'],
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
      var tTaskId = sch[i].TaskId;
      var cronJonTime = sch[i].cronJonTime;
      console.log('JobId: ' + tempJobId);
      if(createScheduleJob(tempJobId,tTaskId,null,null,null,cronJonTime)){
        Schedule.update({
          Status: 'Running'
        },
          {where: {JobId: tempJobId}
        });
      }
    }
  });
}

function AutoCreateRegularTask() {
  console.log('Create Or Update schedule Job Start: ------------->');
  var today = new Date();
  var tDay = dateFormat(today, "yyyy-mm-dd");
  var day = today.getDate();
  
  console.log('Current day: ' + tDay);
  Schedule.findAll({
    attributes: ['JobId','TaskId','Schedule','RegularTime'],
    where: { 
      StartTime: tDay,
      Status: 'Planning'
    },
  }).then(function(sch) {
    if(sch.length === 0){
      console.log('No regular Start time is: ' + tDay + ', list size: ' + sch.length);
      return false;
    } 
    for(var i = 0; i < sch.length; i++){
      var tempJobId = sch[i].JobId;
      var tTaskId = sch[i].TaskId;
      var tSchedule = sch[i].Schedule;
      var tRegularTime = sch[i].RegularTime;
      console.log('JobId: ' + tempJobId);
      createScheduleJob(tempJobId,tTaskId,tSchedule,tRegularTime,day,null)
      //taskItem.createTaskByScheduleJob(tempJobId);
    }
  });
  return true;
}

function createScheduleJob(jId,tTaskId,tSchedule,tRegularTime,day,tCronJonTime) {
  var previousTime = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss");
  try{
    var cronJonTime = '* * * * * *';
    if(tCronJonTime == null){
      switch(tRegularTime){
        case 'Daily':
         switch(tSchedule){
           case 'Every weekday':
            cronJonTime = '* * * * * 1-5';
            break;
          case 'Everyday':
            cronJonTime = '* * * 1-31 * *';
            break;
          }
        break;
        case 'Weekly':
            cronJonTime = '* * * ' + day + '/7 * *'
            break;
        case 'Monthly':
            //cronJonTime = '* * * ' + day + ' 1-12 *'
            cronJonTime = '*/5 * * * * *';
            break;
       default:
            break;
      }
    }else{
      cronJonTime = tCronJonTime;
    }
      
    console.log('Start Schedule Job');
    var runningJob = nodeSchedule.scheduledJobs[jId];
    if (runningJob != null) {
      runningJob.cancel();
    }
    nodeSchedule.scheduleJob(jId, cronJonTime, function(){
      taskItem.createTaskByScheduleJob(tTaskId);
    }); 
    console.log('Finish Schedule Job');

    Schedule.update({
      Status: 'Running',
      PreviousTime: previousTime,
      cronJonTime: cronJonTime
    },
      {where: {JobId: jId}
    });
  }catch(Exception){
      console.log('Exception occurred: ' + exception);
  }
};

function cancelScheduleJob () {
  console.log('Start to cancel Schedule Job by job id');
  var day = dateFormat(new Date(), "yyyy-mm-dd");
  console.log('Current day: ' + day);
  Schedule.findAll({
    attributes: ['JobId'],
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
          console.log('JobId: ' + tempJobId + ' was done.');
        }
      }
      console.log('Cancel Schedule Job End----------------------------->');
    }
  });
  return true;
};

module.exports = router;