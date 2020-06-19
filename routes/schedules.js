/*
 * @Description: 
 * @Author: 
 * @Date: 2020-06-13 13:13:52
 * @LastEditTime: 2020-06-15 16:31:45
 * @LastEditors: Wanlin Chen
 */ 
var Sequelize = require('sequelize');
var db = require('../config/db');
var express = require('express');
var router = express.Router();
var Schedule = require('../model/schedule');
var nodeSchedule = require('node-schedule');
var dateFormat = require('dateformat');
var Task = require('../model/task/task');
var taskItem = require('../routes/taskItem');
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
        } else {
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

function AutoCreateRegularTask() {
  console.log('Create Or Update schedule Job Start: ------------->');
  var day = dateFormat(new Date(), "yyyy-mm-dd");
  console.log('Current day: ' + day);
  Schedule.findAll({
    attributes: ['JobId','TaskId','Schedule','RegularTime'],
    where: { 
      StartTime: day,
      Status: 'Planning'
    },
  }).then(function(sch) {
    if(sch.length === 0){
      console.log('No regular Start time is: ' + day + ', list size: ' + sch.length);
      return false;
    } 
    for(var i = 0; i < sch.length; i++){
      var tempJobId = sch[i].JobId;
      var tTaskId = sch[i].TaskId;
      var tSchedule = sch[i].Schedule;
      var tRegularTime = sch[i].RegularTime;
      console.log('JobId: ' + tempJobId);
      if(createScheduleJob(tempJobId,tTaskId,tSchedule,tRegularTime)){
        Schedule.update({
          Status: 'Running'
        },
          {where: {JobId: tempJobId}
        });
      }
    }
  });
  return true;
}

function createScheduleJob(jId,tTaskId,tSchedule,tRegularTime) {
  var cronJonTime = '* * * * * *';
  try{
      switch(tRegularTime){
          case 'Daily':
           switch(tSchedule){
             case 'Every weekday':
              cronJonTime = '* * * * * *';
              break;
            case 'Everyday':
              cronJonTime = '* * * 1 * *';
              break;
            }
            cronJonTime = '* * * 1 * *'
            break;
          case 'Weekly':
              cronJonTime = '* * * 7 * *'
              break;
          case 'Monthly':
              //cronJonTime = '* * * * 1 *'
              cronJonTime = '10 * * * * *';
              break;
         default:
              break;
        }
      console.log('Start Schedule Job');
      var runningJob = nodeSchedule.scheduledJobs[jId];
        if (runningJob != null) {
          runningJob.cancel();
      }
      
      scheduleCronstyle(jId, tTaskId, cronJonTime);
      console.log('Finish Schedule Job');
      return true;
  }catch(Exception){
      console.log('Exception occurred: ' + exception);
      return false;
  }
};

function scheduleCronstyle(iJobId, TaskId, iJobConfiguration){
  var job = nodeSchedule.scheduleJob(iJobId, iJobConfiguration, function(){
      console.log('scheduleCronstyle:' + new Date());
      var day = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss");
      var iParentTask = null;
      var iTaskName = null;
      Task.findAll({
          attributes: ['ParentTaskName','TaskName','Description','Status','Creator',
          'TaskTypeId','Effort','Estimation','IssueDate','TargetCompleteDate','ActualCompleteDate',
          'BusinessArea','BizProject','TaskLevel','RespLeaderId','AssigneeId','Reference','Scope',
          'TopConstraint','TopOppName','TopCustomer','TopFacingClient','TopTypeOfWork','TopChanceWinning',
          'TopSowConfirmation','TopBusinessValue','TopTargetStart','TopTargetEnd','TopPaintPoints',
          'TopTeamSizing','TopSkill','TopOppsProject','TaskGroupId','TypeTag','DeliverableTag','Detail'],
          where: { 
              TaskName: TaskId
          },
        }).then(function(sch) {
          if(sch.length === 0){
            console.log('No Regular task was found, ' + 'list size: ' + sch.length);
            return false;
          }
          for(var i = 0; i < sch.length; i++){
              iParentTask = sch[i].ParentTaskName;
              iTaskName = sch[i].TaskName;
              var newSubTaskName = taskItem.getSubTaskCount(iParentTask);
              var subName = newSubTaskName + 1;
              var TaskName = iParentTask + '-' + subName;
              var taskObj = {
                  task_parent_name: iParentTask,
                  task_name: TaskName,
                  task_desc: sch[i].Description,
                  task_status: 'Planning',
                  task_creator: sch[i].Creator,
                  task_type_id: sch[i].TaskTypeId,
                  task_effort: sch[i].Effort,
                  task_estimation: sch[i].Estimation,
                  task_issue_date: day,
                  task_target_complete: null,
                  task_actual_complete: null,
                  task_level: sch[i].TaskLevel,
                  task_responsible_leader: sch[i].RespLeaderId,
                  task_assignee: null,
                  task_reference: sch[i].Reference,
                  task_scope: sch[i].Scope,
                  task_top_constraint: null,
                  task_top_opp_name: null,
                  task_top_customer: null,
                  task_top_facing_client: null,
                  task_top_type_of_work: null,
                  task_top_chance_winning: null,
                  task_top_sow_confirmation: null,
                  task_top_business_value: null,
                  task_top_target_start: null,
                  task_top_target_end: null,
                  task_top_paint_points: null,
                  task_top_team_sizing: null,
                  task_top_skill: null,
                  task_top_opps_project: null,
                  task_group_id: sch[i].TaskGroupId,
                  task_TypeTag: null,
                  task_deliverableTag: null,
                  task_detail: null
              };
              taskItem.saveTask(JSON.stringify(taskObj));
           /*Task.findOrCreate({
              where: { TaskName: tTaskId}, 
              defaults: taskObj
            }).spread(async function(task, created) {
              if(created) {
                  console.log("Task created");
                } else {
                  console.log("Task failure");
                }
            });*/
          }
        });
  }); 
}

function cancelScheduleJob () {
  console.log('Start to cancel Schedule Job by job id');
  var day = dateFormat(new Date(), "yyyy-mm-dd");
  console.log('Current day: ' + day);
  Schedule.findAll({
    attributes: ['JobId'],
    where: { 
      EndTime: day
    },
  }).then(function(sch) {
    if(sch.length === 0){
      console.log('No regular End time is: ' + day + ', list size: ' + sch.length);
      return false;
    } 
    for(var i = 0; i < sch.length; i++){
      var tempJobId = sch[i].JobId;
      var runningJob = nodeSchedule.scheduledJobs[tempJobId];
      console.log('Start To Cancel Schedule Job ----------------------------->');
      if(runningJob.cancel()){
        Schedule.update({
          Status: 'Cancelled'
        },
          {where: {JobId: tempJobId}
        });
      }
      console.log('JobId: ' + tempJobId + ' was cancelled.');
      console.log('Start To Cancel Schedule Job ----------------------------->');
    }
  });
  return true;
};

module.exports = router;