var Sequelize = require('sequelize');
var db = require('../config/db');
var express = require('express');
var parser = require('cron-parser');
var router = express.Router();
var Schedule = require('../model/schedule');
var nodeSchedule = require('node-schedule');
var dateFormat = require('dateformat');
var Task = require('../model/task/task');
var taskService = require('../services/taskService');
var TaskGroup = require('../model/task/task_group');
const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
  var cronExp = req.query.CronExp;
  cronExp = cronExp.replace('+', ' ')
  cronExp = '0 0 2 1,2,3,4,5,25,26,27,28,30 * *'
  console.log('Cron Expression: ' + cronExp)
  try {
    var interval = parser.parseExpression(cronExp);
    console.log('Date: ', interval.next().toString());
    console.log('Date: ', interval.next().toString());
    console.log('Date: ', interval.next().toString());
    console.log('Date: ', interval.next().toString());
    console.log('Date: ', interval.next().toString());
    console.log('Date: ', interval.next().toString());
    console.log('Date: ', interval.next().toString());
    console.log('Date: ', interval.next().toString());
  } catch (err) {
    console.log('Error: ' + err.message);
  }
  return res.json({message: 'Response formats resource'});
});

router.post('/saveRegularTask',async function(req,res,next){
  console.log('Start to save Regular Task')
  var tTaskName = req.body.reqTaskName;
  var jobName = 'PMT' + tTaskName;
  var tTaskId = null;
  tTaskId = await taskService.getTaskId(tTaskName);
  Schedule.findOrCreate({
    where: { TaskName : tTaskName }, 
    defaults: {
      JobName: jobName,
      TaskName: tTaskName,
      TaskId: req.body.reqTaskId,
      Schedule: req.body.reqSchedule,
      RegularTime: req.body.reqRegularTaskTime,
      StartTime: req.body.reqStartTime,
      EndTime: req.body.reqEndTime,
      Status: req.body.reqStatus
    }
  }).spread(async function(schedule, created) {
    if(created) {
      return res.json(responseMessage(0, schedule, 'Created task schedule successfully!'));
    }
    else if(schedule != null && !created) {
      schedule.update({
        Schedule: req.body.reqSchedule,
        RegularTime: req.body.reqRegularTaskTime,
        StartTime: req.body.reqStartTime,
        EndTime: req.body.reqEndTime,
        Status: req.body.reqStatus
      });
      return res.json(responseMessage(0, schedule, 'Updated task schedule successfully!'));
    }
    else {
      return res.json(responseMessage(1, null, 'Created or updated task schedule fail!'));
    }
  })
});

router.get('/startBackgroundJob', function(req, res, next) {
  console.log('Start to schedule background Job');
  var reqJobName = 'BackGroundJob';
  var runningJob = nodeSchedule.scheduledJobs[reqJobName];
  if (runningJob != null) {
    runningJob.cancel();
  }
  var iJobConfiguration = '0 0 1-23 * * *';
  // Main background job
  nodeSchedule.scheduleJob(reqJobName, iJobConfiguration, async function(){
    console.log("---> The schedule background Job start to run. time: " + new Date());
    // Step 1: 
    // (1) For planning schedule job, if meet the start time, change to Running status
    // (2) For those over the end time job, change to Done status
    let checkResult1 = await checkScheduleJobStatus();
    // Step 2: Cancel all Done/Planning schedule job if they are running
    let checkResult2 = await cancelScheduleJob();
    // Step 3: Re active all Running schedule job if not been scheduled
    let checkResult3 = await activateRunningScheduleJob();
    console.log("<--- The schedule background Job end with time: " + new Date());
  }); 
  console.log('Schedule background Job End');
  return res.json({message: 'Schedule all background Jobs successfully'});
});

router.get('/getSchedulejobList', function(req, res, next) {
  var allJobList = nodeSchedule.scheduledJobs
  console.log(allJobList);
  return res.json({message: 'Start to get Schedule Job List --> ' + JSON.stringify(allJobList)});
});

// Step 1: 
// (1) For planning schedule job, if meet the start time, change to Running status(also change the regular task)
// (2) For those over the end time job, change to Done status(also change the regular task)
async function checkScheduleJobStatus() {
  return new Promise(async (resolve, reject) => {
    console.log('Start to check schedule status');
    var today = dateFormat(new Date(), "yyyy-mm-dd");
    console.log('Step 1-1: Check and update Status = Planning, Start Time <= today [' + today + '], End Time >= today [' + today + ']');
    var updateRunningCriteria = { 
      StartTime: { [Op.lte]: today },
      EndTime: { [Op.gte]: today },
      Status: 'Planning'
    }
    var updateRunningResult = await updateScheduleAndTaskStatus(updateRunningCriteria, 'Running');
    if (updateRunningResult != null) {
      console.log('End to update schedule job [' + updateRunningResult.job_result + '] and regular task [' + updateRunningResult.task_result + '] to running'); 
    } else {
      console.log('No schedule need to update to Running status');
    }

    console.log('Step 1-2: Check and update Status = Done, End Time < today [' + today + ']');
    var updateDoneCriteria = { 
      EndTime: { [Op.lt]: today },
      Status: { [Op.ne]: 'Done' }
    }
    var updateDoneResult = await updateScheduleAndTaskStatus(updateDoneCriteria, 'Done');
    if (updateDoneResult != null) {
      console.log('End to update schedule job [' + updateDoneResult.job_result + '] and regular task [' + updateDoneResult.task_result + '] to done'); 
    } else {
      console.log('No schedule need to update to Done status');
    }
    resolve('Finish Step 1: update schdule and related task');
  });
}

async function updateScheduleAndTaskStatus(iCriteria, iStatus) {
  return new Promise(async (resolve, reject) => {
    await Schedule.findAll({
      where: iCriteria,
    }).then(async function(resultSchedules) {
      if (resultSchedules != null && resultSchedules.length > 0) {
        var updateResult = {
          'job_result': 0,
          'task_result': 0,
          'sub_task_result': 0
        }
        let jobNameList = [];
        let taskNameList = [];
        let subtaskNameList = [];
        for(let i = 0; i<resultSchedules.length; i++) {
          jobNameList.push(resultSchedules[i].JobName);
          taskNameList.push(resultSchedules[i].TaskName);
        }
        // Update schedules status
        if (jobNameList != null && jobNameList.length > 0) {
          updateResult.job_result = await Schedule.update(
            { Status: iStatus },
            { where: { JobName: { [Op.in]: jobNameList } }
          });
        }
        // Update schedule related regular tasks status
        if (taskNameList != null && taskNameList.length > 0) {
          updateResult.job_result = await Task.update(
            { Status: iStatus },
            { where: { TaskName: { [Op.in]: taskNameList } }
          });
          // Update related tasks' sub tasks status
          for(let i=0; i<taskNameList.length; i++) {
            var regularSubTaskList = await getSubTasks(taskNameList[i], true);
            if (regularSubTaskList != null && regularSubTaskList.length > 0) {
              for (let a=0; a<regularSubTaskList.length; a++) {
                subtaskNameList.push(regularSubTaskList[a].TaskName)
              }
            } else {
              console.log('No regular sub task, no need to update sub tasks status')
              continue;
            }
            if (subtaskNameList != null && subtaskNameList.length > 0) {
              updateResult.sub_task_result = await Task.update(
                { Status: iStatus },
                { where: { TaskName: { [Op.in]: subtaskNameList } }
              });
            }
          }
        }
        console.log('All update done, result -> ', updateResult);
        resolve(updateResult);
      } else {
        resolve(null);
      }
    })
  });
}
// End Step 1 

// Step 2: Cancel all Done/Planning schedule job if they are running
async function cancelScheduleJob () {
  return new Promise((resolve, reject) => {
    console.log('Start to cancel Done/Planning schedule job ');
    Schedule.findAll({
      where: { 
        [Op.or]: [
          { Status: 'Planning' },
          { Status: 'Done' }
        ],
      },
    }).then(function(schedules) {
      if(schedules != null && schedules.length === 0) {
        console.log('No Planning/Done Task need to cancel');
        resolve('Finish Step 2: No Planning/Done task need to cancel');
      } 
      for(let i = 0; i < schedules.length; i++){
        var jobName = schedules[i].JobName;
        console.log('Start to cancel job ' + jobName);
        var runningJob = nodeSchedule.scheduledJobs[jobName];
        var result = false;
        if(runningJob != null) {
          result = runningJob.cancel();
        }
        console.log('End to cancel job ' + jobName + ', result -> ' + result);
      }
    });
    resolve('Finish Step 2: cancel schedule job complete');
  });
};

// Step 3: Re active all Running schedule job if not been scheduled
async function activateRunningScheduleJob() {
  return new Promise((resolve, reject) => {
    console.log('Start to Re-activate running schedule job if not been scheduled');
    Schedule.findAll({
      where: { 
        Status: 'Running'
      },
    }).then(async function(runningSchedules) {
      if(runningSchedules == null || runningSchedules.length === 0){
        resolve('No any running regular job');
      } else {
        var result = []
        for(let i = 0; i < runningSchedules.length; i++){
          var resultObj = {};
          var schJobName = runningSchedules[i].JobName;
          var runningScheduleJob = nodeSchedule.scheduledJobs[schJobName];
          resultObj.JobName = schJobName;
          if (runningScheduleJob != null) {
            console.log('Job [' + schJobName + '] is running, no need to re-activate');
            resultObj.JobStatus = 'Running'
          } else {
            console.log('Job [' + schJobName + '] is not running, create schedule job');
            var jobCreationResult = await createScheduleJob(runningSchedules[i]);
            resultObj.JobStatus = 'Created - ' + jobCreationResult;
          }
          result.push(resultObj);
        }
        resolve('Finish Step 3: activate running schedule job result --> ' + JSON.stringify(result));
      }
    });
  });
}

function createScheduleJob(iSchedule) {
  return new Promise(async (resolve, reject) => {
    var previousTime = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss");
    try{
      // Get the schedule cron expression time setting
      console.log('Start to generate schedule job cron job time');
      var sSchdule = iSchedule.Schedule;
      var sRegularTimeOptions = iSchedule.RegularTime;
      var cronJobTime = '';
      var index = sSchdule.lastIndexOf(':');
      var scheduleValue = sSchdule.substring(index+1, sSchdule.length).trim();
      switch(sRegularTimeOptions){
        case 'Weekly':
          cronJobTime = '0 0 2 * * ' + scheduleValue;
          console.log('Weekly cronJobTime: ' + cronJobTime);
          break;
        case 'Monthly':
          cronJobTime = '0 0 2 ' + scheduleValue + ' * *';
          console.log('Monthly cronJobTime: ' + cronJobTime);
          break;
        default:
          resolve(false);
          break;
      }
      // Start to create the schedule job
      console.log('Start to create schedule job');
      var sJobName = iSchedule.JobName;
      var sTaskName = iSchedule.TaskName;
      var newScheduleJob = nodeSchedule.scheduleJob(sJobName, cronJobTime, async function(){
        console.log('Start to run schedule job -- > ', sJobName);
        var result = await createTaskByScheduleJob(sTaskName);
        if (result) {
          var runningJob = nodeSchedule.scheduledJobs[sJobName];
          if (runningJob != null) {
            var previousExecution = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss");
            var nextExecution = dateFormat(runningJob.nextInvocation(), "yyyy-mm-dd hh:MM:ss");
            await Schedule.update({PreviousTime: previousExecution, NextTime: nextExecution}, {where: {JobName: sJobName}});
          }
          console.log('Job execute successfully, update execution time');
        } else {
          console.log('Job execute fail');
          var nextExecution = dateFormat(runningJob.nextInvocation(), "yyyy-mm-dd hh:MM:ss");
          await Schedule.update({NextTime: nextExecution}, {where: {JobName: sJobName}});
        }
        console.log('End to run schedule job -- > ', sJobName, ' Job create task result --> ', result);
      });
      var newExecution = dateFormat(newScheduleJob.nextInvocation(), "yyyy-mm-dd hh:MM:ss");
      await Schedule.update({NextTime: newExecution, CronJobTime: cronJobTime}, {where: {JobName: sJobName}});
      console.log('Finish create Schedule Job');
      resolve(true);
    }catch(Exception){
      console.log('Exception occurred: ' + Exception);
      resolve(false);
    }
  });
};

// Start: Below function used for schedule job to create One-Off task
function createTaskByScheduleJob(iTaskName) {
  return new Promise(async (resolve, reject) => {
    console.log('Create One-off task by Regular task ' + iTaskName + ' time: ' + new Date());
    var currentDay = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss");
    var taskGroup = await getTaskGroupByDate(currentDay.split(' ')[0]);
    var taskGroupId = null;
    if (taskGroup != null) {
      taskGroupId = taskGroup.Id;
    }
    console.log('Task Group Id --> ', taskGroupId);
    // Get regular task template
    Task.findOne({
      where: { 
        TaskName: iTaskName,
        TaskLevel: 3
      },
    }).then(async function(regularTask) {
      if(regularTask != null){
        var regularTaskSch = await getScheduleByTaskName(iTaskName);
        if(regularTaskSch != null) {
          var recurrenceTimes = Number(regularTaskSch.RecurrenceTimes);
          var jsonStr = JSON.stringify(regularTask);
          var normalTaskObj = JSON.parse(jsonStr);
          normalTaskObj.TaskName = regularTask.TaskName + '(' + (recurrenceTimes + 1) + ')';
          normalTaskObj.TypeTag = 'One-Off Task';
          normalTaskObj.Status = 'Planning';
          normalTaskObj.Creator = 'PMT:BackgroundJob';
          normalTaskObj.IssueDate = currentDay;
          normalTaskObj.TaskGroupId = taskGroupId;
          delete normalTaskObj.Id;
          delete normalTaskObj.createdAt;
          delete normalTaskObj.updatedAt;
          console.log('Start to create normal task by regularly --> ', normalTaskObj.TaskName);
          var normalTask = await createTask(normalTaskObj.TaskName, normalTaskObj);
          if (normalTask != null) {
            console.log("Task created/updated successfully"); 
            regularTaskSch.update({RecurrenceTimes: (recurrenceTimes + 1)})
            // If regular task exist sub task, also create the subtask
            var regularSubTaskList = await getSubTasks(regularTask.TaskName, true);
            if (regularSubTaskList != null) {
              console.log('Regualr task exist sub tasks, start to generate the normal sub task')
              for(let i = 0; i<regularSubTaskList.length; i++) {
                if(regularSubTaskList[i].Status == 'Running') {
                  var regularSubTaskStr = JSON.stringify(regularSubTaskList[i]);
                  var normalSubTaskObj = JSON.parse(regularSubTaskStr);
                  normalSubTaskObj.ParentTaskName = normalTask.TaskName
                  normalSubTaskObj.TaskName = normalSubTaskObj.TaskName.replace(iTaskName, normalTask.TaskName)
                  normalSubTaskObj.TypeTag = 'One-Off Task';
                  normalSubTaskObj.Status = 'Planning';
                  normalSubTaskObj.Creator = 'PMT:BackgroundJob';
                  normalSubTaskObj.IssueDate = currentDay;
                  normalSubTaskObj.TaskGroupId = taskGroupId;
                  delete normalSubTaskObj.Id;
                  delete normalSubTaskObj.createdAt;
                  delete normalSubTaskObj.updatedAt;
                  console.log('Start to create normal sub task by regularly --> ', normalSubTaskObj.TaskName);
                  await createTask(normalSubTaskObj.TaskName, normalSubTaskObj);
                }
              }
            } else {
              console.log('Regualr task not exist sub tasks')
            }
            console.log('Finish create/update normal task')
            resolve(true);
          } else {
            console.log('Normal task created/updated failed')
          }
        } else {
          console.log('Not related task schedule of regular setting')
        }
        resolve(false);
      }
    });
  });
}

function getTaskGroupByDate(iDate) {
  return new Promise(async (resolve, reject) => {
    TaskGroup.findOne({
      where: {
        StartTime: { [Op.lte]: iDate },
        EndTime: { [Op.gte]: iDate },
      }
    }).then(function(taskGroup) {
      if (taskGroup != null) {
        resolve(taskGroup);
      } else {
        resolve(null);
      }
    });
  });
}

function getScheduleByTaskName(iTaskName) {
  return new Promise(async (resolve, reject) => {
    Schedule.findOne({
      where: {
        TaskName: iTaskName
      }
    }).then(function(scheudle) {
      if(scheudle != null) {
        resolve(scheudle)
      } else {
        resolve(null);
      }
    });
  });
}

function getSubTasks (iTaskName, isRegular) {
  return new Promise((resolve, reject) => {
    var criteria = { ParentTaskName: iTaskName }
    if(isRegular) {
      criteria.TypeTag = 'Regular Task'
    }
    Task.findAll({
      where: criteria
    }).then(function(task) {
      if(task != null && task.length > 0){
        resolve(task);
      } else {
        resolve(null)
      }
    })
  });
}

function createTask(iTaskName, iTaskObj) {
  return new Promise((resolve, reject) => {
    Task.findOrCreate({
      where: { TaskName: iTaskName }, 
      defaults: iTaskObj
    }).spread(async function(task, created) {
      if(task != null) {
        resolve(task);
      } else {
        resolve(null);
      }
    });
  });
}
// End Step 3: Above function used for schedule job to create One-Off task

router.post('/getSchedulesByTaskName',function(req,res,next){
  console.log('getSchedulesByTaskName')
  Schedule.findOne({
    where: { TaskName: req.body.reqTaskName }
  }).then(async function(schedule) {
    if(schedule != null) {
      var rtnResult = {};
      var timeRange = [schedule.StartTime, schedule.EndTime];
      rtnResult.schedule_time_range = timeRange;
      rtnResult.schedule_regular_time = schedule.RegularTime;
      rtnResult.schedule_value = null;
      if (schedule.Schedule != null) {
        var index = schedule.Schedule.lastIndexOf(':');
        var scheduleValue = schedule.Schedule.substring(index + 1, schedule.Schedule.length).trim();
        rtnResult.schedule_value = scheduleValue.split(',');
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } 
    else {
      return res.json(responseMessage(1, null, 'No sub task exist'));
    }
  })
});

router.get('/cancelBackgroundJob', function(req, res, next) {
  console.log('Start to cancel background Job');
  var reqJobName = 'BackGroundJob';
  var runningJob = nodeSchedule.scheduledJobs[reqJobName];
  console.log('Cancel Job ----------------------------->');
  console.log(runningJob.cancel());
  console.log('Cancel Job <-----------------------------');
  return res.json({message: 'Cancel Schedule Job end'});
});

// Testing API
router.get('/testScheduleJobFunction', async function(req, res, next) {
  //var result = await checkScheduleJobStatus();
  var result = await activateRunningScheduleJob();
  return res.json({message: 'Testing Result: ' + result});
});

router.get('/testScheduleJobCreation', async function(req, res, next) {
  var jName = req.query.JobName;
  var tTaskName = req.query.TaskName;
  var cronJobTime = '* */1 * * *';
  console.log('Start Schedule Job');
  var runningJob = nodeSchedule.scheduledJobs[jName];
  console.log('Running Schedule job ----> ', runningJob)
  if (runningJob != null) {
    runningJob.cancel();
  }
  nodeSchedule.scheduleJob(jName, cronJobTime, async function(){
    console.log('Start to run schedule job -- > ', jName);
    var result = await createTaskByScheduleJob(tTaskName);
    console.log('End to run schedule job -- > ', jName, ' Job result --> ', result);
  });
  return res.json({message: 'Start to get Schedule Job List' + JSON.stringify(nodeSchedule.scheduledJobs)});
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

module.exports = router;