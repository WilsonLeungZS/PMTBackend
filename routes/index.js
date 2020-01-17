var async = require('async');
var Logger  = require("../config/logConfig");
var express = require('express');
var router = express.Router();
var Reference = require('../model/reference');
var Task = require('../model/task/task');
var User = require('../model/user');
var Team = require('../model//team/team');
var TaskType = require('../model/task/task_type');
var Worklog = require('../model/worklog');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;

/* GET home page. */
router.get('/', function(req, res, next) {
  Logger.info('Index log');
  return res.json({message: 'Get Response index resource'});
});

router.post('/', function(req, res, next) {
  var request = req.body.requestValue;
  console.log(request);
  Logger.info('Index log');
  return res.json({message: 'Post Response index resource'});
});

router.get('/getInfo', function(req, res, next) {
  Logger.info('Start to get Information');
  var rtnResult = [];
  var resJson = {}
  Reference.findOne({where: {Name: 'ProjectName'}}).then(function(reference){
    resJson.project_name = reference.Value;
    Task.findAndCountAll().then(function(task){
      resJson.task_count = task.count;
      User.findAndCountAll({where: {IsActive: true}}).then(function(user){
        resJson.user_count = user.count;
        Team.findAndCountAll({where: {IsActive: true}}).then(function(team){
          resJson.team_count = team.count;
          rtnResult.push(resJson);
          return res.json(responseMessage(0, rtnResult, ''));
        });
      });
    });
  });
});

//External interface
//Spider job to receive task list for service now
router.post('/receiveTaskListForSNOW', function(req, res, next) {
  Logger.info('Request: \n' + JSON.stringify(req.body))
  //console.log('Request: \n' + JSON.stringify(req.body))
  var taskNumber = req.body.number;
  var taskdesc = req.body.short_description;
  var taskStatus = req.body.state;
  var taskAssignTeam = req.body.assignment_group;
  var taskTotalEffort = req.body.task_effort;
  var taskBizProject = req.body.bizProject;
  var taskCategorization = req.body.path;
  var taskCollection = [];
  for(var i=0; i<taskNumber.length; i++){
    var taskJson = {};
    taskJson.TaskName = taskNumber[i];
    taskJson.Description = taskdesc[i];
    taskJson.Status = taskStatus[i];
    taskJson.AssignTeam = taskAssignTeam[i].toUpperCase();
    if (taskBizProject != null && taskTotalEffort != undefined) {
      taskJson.BizProject = taskBizProject[i];
    } else {
      taskJson.BizProject = ''
    }
    taskJson.NeedSubTask = false;
    var taskTotalEffortNum = 0;
    if(taskTotalEffort != null && taskTotalEffort != undefined){
      taskTotalEffortNum = Number(taskTotalEffort[i]) * 8;
      console.log('Task Effort: '+ taskTotalEffortNum);
    }
    if(taskNumber[i].toUpperCase().startsWith('CG')){
      taskJson.TaskType = 'Change';
      taskJson.NeedSubTask = true;
    }
    else if(taskNumber[i].toUpperCase().startsWith('PRB')){
      taskJson.TaskType = 'Problem';
    }
    else if(taskNumber[i].toUpperCase().startsWith('INCTASK')){
      taskJson.TaskType = 'ITSR';
    }
    else if(taskNumber[i].toUpperCase().startsWith('LEAVE')){
      taskJson.TaskType = 'Leave';
    }
    else if(taskCategorization != null && taskCategorization != undefined ){
      if(taskCategorization[i].toUpperCase().startsWith("SERVICE")){
        taskJson.TaskType = 'Service Request';
      } else {
        taskJson.TaskType = 'Incident';
      }
    }
    else {
      taskJson.TaskType = 'Sponsor Task';
    }
    taskJson.TotalEffort = taskTotalEffortNum;
    taskCollection.push(taskJson);
  }

  //console.log('Task Collection: ' + JSON.stringify(taskCollection));
  async.eachSeries(taskCollection, function(taskObj, callback) {
    createTask(taskObj, function(err){
        callback(err);
    });
  }, function(err){
    if(err != null && err != ''){
      console.log("Create task err is:" + err);
      return res.json({result: false, error: err});
    }
    return res.json({result: true, error: ""});
  });
  function createTask(taskObj, cb){
    console.log('Start to create task: ' + taskObj.TaskName);
    Logger.info('Start to create task: ' + taskObj.TaskName);
    try {
      var errMsg = '';
      var tParentTaskName = 'N/A';
      var tName = taskObj.TaskName;
      var tDescription = taskObj.Description;
      var tStatus = taskObj.Status;
      var tCreator = 'Default';
      var tEffort = 0;
      var tEstimation = taskObj.TotalEffort;
      var tTaskType = taskObj.TaskType;
      var tTaskTypeId = 0;
      var tTaskBizProject = taskObj.BizProject;
      var tAssignTeam = taskObj.AssignTeam;
      var tBusinessArea = '';
      if(tAssignTeam != null && tAssignTeam != '' && tAssignTeam.indexOf('+') != -1) {
        var tAssignTeamArray = tAssignTeam.split("+");
        if(tAssignTeamArray[1] == 'SSM'){
          tAssignTeam = tAssignTeamArray[0]
        } else {
          tAssignTeam = 'OTHERS'
        }
        tBusinessArea = tAssignTeamArray[0];
      }
      var tAssignTeamId = 0;
      //var tNeedSubTask = taskObj.NeedSubTask;
      TaskType.findOne({where: {Name: tTaskType}}).then(function(taskType) {
        console.log('Find task type: ' + tTaskType);
        if(taskType != null) {
          tTaskTypeId = taskType.Id;
          if(tEstimation == 0 && taskType.Value > 0){
            tEstimation = Number(taskType.Value);
          }
        } else {
          errMsg = 'Task [' + taskObj.TaskName + ']: Task type [' + taskObj.TaskType + '] is not exist'
          console.log(errMsg)
        }
        //Get task assign team
        Team.findAll({where: {IsActive: true}}).then(function(teamArray){
          //console.log('Find team: tasktype-' + tTaskTypeId + ', effort-'+tEstimation);
          if(teamArray != null && teamArray.length > 0){
            //console.log('Start team mapping');
            for(var a=0;a<teamArray.length;a++){
              var teamMapping = teamArray[a].Mapping.split(",");
              //console.log('Mapping Array: ' + teamMapping);
              if(teamMapping.indexOf(tAssignTeam) > -1){
                tAssignTeamId = teamArray[a].Id;
                console.log('Create task: assignTeamId-' + tAssignTeamId);
              }
            }
            if(tAssignTeamId == 0) {
              errMsg = 'Task [' + taskObj.TaskName + ']: Team [' + taskObj.AssignTeam + '] mapping is not exist'
              console.log(errMsg)
            }
          }
          console.log('Start to create/Update task');
          //console.log('Task assign team id: '+ tAssignTeamId);
          Task.findOrCreate({
            where: {TaskName: tName}, 
            defaults: {
                ParentTaskName: tParentTaskName,
                TaskName: tName,
                Description: tDescription,
                Status: tStatus,
                Creator: tCreator,
                Effort: tEffort,
                Estimation: tEstimation,
                TaskTypeId: tTaskTypeId,
                AssignTeamId: tAssignTeamId,
                BizProject: tTaskBizProject,
                BusinessArea: tBusinessArea
            }})
          .spread(function(task, created) {
            if(created) {
              console.log('Task created');
              Logger.info('Task created');
            }
            else if(task != null && !created){ 
              task.update({
                Description: tDescription,
                Status: tStatus,
                Estimation: tEstimation,
                TaskTypeId: tTaskTypeId,
                AssignTeamId: tAssignTeamId,
                BizProject: tTaskBizProject,
                BusinessArea: tBusinessArea
              });
              console.log('Task updated');
              Logger.info('Task updated');
            } 
            else {
              console.log('Task create fail');
              errMsg = 'Task [' + taskObj.TaskName + ']: create or update failed!'
            }
            cb(errMsg, taskObj);
          }); 
        }); 
      });
    } catch(exception) {
      var exMsg = 'Exception occurred: ' + exception;
      console.error(exMsg);
      Logger.info(exMsg);
      cb(exMsg, taskObj);
    }
  }
});

//Spider job to receive task list for TRLS
router.post('/receiveTaskListForTRLS', function(req, res, next) {
  Logger.info('Request: \n' + JSON.stringify(req.body))
  //console.log('Request: \n' + JSON.stringify(req.body))
  var taskNumber = req.body.number;
  var taskdesc = req.body.short_description;
  var taskStatus = req.body.state;
  var taskAssignTeam = req.body.assignment_group;
  var taskTotalEffort = req.body.task_effort;
  var taskBizProject = req.body.bizProject;
  var taskCategorization = req.body.path;
  var taskCollection = [];
  for(var i=0; i<taskNumber.length; i++){
    var taskJson = {};
    taskJson.TaskName = taskNumber[i];
    taskJson.Description = taskdesc[i];
    taskJson.Status = taskStatus[i];
    taskJson.AssignTeam = taskAssignTeam[i].toUpperCase();
    if (taskBizProject != null && taskTotalEffort != undefined) {
      taskJson.BizProject = taskBizProject[i];
    } else {
      taskJson.BizProject = ''
    }
    taskJson.NeedSubTask = false;
    var taskTotalEffortNum = 0;
    if(taskTotalEffort != null && taskTotalEffort != undefined){
      taskTotalEffortNum = Number(taskTotalEffort[i]) * 8;
      console.log('Task Effort: '+ taskTotalEffortNum);
    }
    if(taskNumber[i].toUpperCase().startsWith('CG')){
      taskJson.TaskType = 'Change';
      taskJson.NeedSubTask = true;
    }
    else if(taskNumber[i].toUpperCase().startsWith('PRB')){
      taskJson.TaskType = 'Problem';
    }
    else if(taskNumber[i].toUpperCase().startsWith('INCTASK')){
      taskJson.TaskType = 'ITSR';
    }
    else if(taskNumber[i].toUpperCase().startsWith('LEAVE')){
      taskJson.TaskType = 'Leave';
    }
    else if(taskCategorization != null && taskCategorization != undefined ){
      if(taskCategorization[i].toUpperCase().startsWith("SERVICE")){
        taskJson.TaskType = 'Service Request';
      } else {
        taskJson.TaskType = 'Incident';
      }
    }
    else {
      taskJson.TaskType = 'Sponsor Task';
    }
    taskJson.TotalEffort = taskTotalEffortNum;
    taskCollection.push(taskJson);
  }

  //console.log('Task Collection: ' + JSON.stringify(taskCollection));
  async.eachSeries(taskCollection, function(taskObj, callback) {
    createTask(taskObj, function(err){
        callback(err);
    });
  }, function(err){
    if(err != null && err != ''){
      console.log("Create task err is:" + err);
      return res.json({result: false, error: err});
    }
    return res.json({result: true, error: ""});
  });
  function createTask(taskObj, cb){
    console.log('Start to create task: ' + taskObj.TaskName);
    Logger.info('Start to create task: ' + taskObj.TaskName);
    try {
      var errMsg = '';
      var tParentTaskName = 'N/A';
      var tName = taskObj.TaskName;
      var tDescription = taskObj.Description;
      var tStatus = taskObj.Status;
      var tCreator = 'Default';
      var tEffort = 0;
      var tEstimation = taskObj.TotalEffort;
      var tTaskType = taskObj.TaskType;
      var tTaskTypeId = 0;
      var tTaskBizProject = taskObj.BizProject;
      var tAssignTeam = taskObj.AssignTeam;
      var tBusinessArea = '';
      if(tAssignTeam != null && tAssignTeam != '' && tAssignTeam.indexOf('+') != -1) {
        var tAssignTeamArray = tAssignTeam.split("+");
        if(tAssignTeamArray[1] == 'SSM'){
          tAssignTeam = tAssignTeamArray[0]
        } else {
          tAssignTeam = 'OTHERS'
        }
        tBusinessArea = tAssignTeamArray[0];
      }
      var tAssignTeamId = 0;
      //var tNeedSubTask = taskObj.NeedSubTask;
      TaskType.findOne({where: {Name: tTaskType}}).then(function(taskType) {
        console.log('Find task type: ' + tTaskType);
        if(taskType != null) {
          tTaskTypeId = taskType.Id;
          if(tEstimation == 0 && taskType.Value > 0){
            tEstimation = Number(taskType.Value);
          }
        } else {
          errMsg = 'Task [' + taskObj.TaskName + ']: Task type [' + taskObj.TaskType + '] is not exist'
          console.log(errMsg)
        }
        //Get task assign team
        Team.findAll({where: {IsActive: true}}).then(function(teamArray){
          //console.log('Find team: tasktype-' + tTaskTypeId + ', effort-'+tEstimation);
          if(teamArray != null && teamArray.length > 0){
            //console.log('Start team mapping');
            for(var a=0;a<teamArray.length;a++){
              var teamMapping = teamArray[a].Mapping.split(",");
              //console.log('Mapping Array: ' + teamMapping);
              if(teamMapping.indexOf(tAssignTeam) > -1){
                tAssignTeamId = teamArray[a].Id;
                console.log('Create task: assignTeamId-' + tAssignTeamId);
              }
            }
            if(tAssignTeamId == 0) {
              errMsg = 'Task [' + taskObj.TaskName + ']: Team [' + taskObj.AssignTeam + '] mapping is not exist'
              console.log(errMsg)
            }
          }
          console.log('Start to create/Update task');
          //console.log('Task assign team id: '+ tAssignTeamId);
          Task.findOrCreate({
            where: {TaskName: tName}, 
            defaults: {
                ParentTaskName: tParentTaskName,
                TaskName: tName,
                Description: tDescription,
                Status: tStatus,
                Creator: tCreator,
                Effort: tEffort,
                Estimation: tEstimation,
                TaskTypeId: tTaskTypeId,
                AssignTeamId: tAssignTeamId,
                BizProject: tTaskBizProject,
                BusinessArea: tBusinessArea
            }})
          .spread(function(task, created) {
            if(created) {
              console.log('Task created');
              Logger.info('Task created');
            }
            else if(task != null && !created){ 
              task.update({
                Description: tDescription,
                Status: tStatus,
                Estimation: tEstimation,
                TaskTypeId: tTaskTypeId,
                AssignTeamId: tAssignTeamId,
                BizProject: tTaskBizProject,
                BusinessArea: tBusinessArea
              });
              console.log('Task updated');
              Logger.info('Task updated');
            } 
            else {
              console.log('Task create fail');
              errMsg = 'Task [' + taskObj.TaskName + ']: create or update failed!'
            }
            cb(errMsg, taskObj);
          }); 
        }); 
      });
    } catch(exception) {
      var exMsg = 'Exception occurred: ' + exception;
      console.error(exMsg);
      Logger.info(exMsg);
      cb(exMsg, taskObj);
    }
  }
});

router.get('/queryTimesheet', function(req, res, next) {
  var reqStartDate = req.query.start_date;
  var reqEndDate = req.query.end_date;
  if(reqStartDate != null && reqEndDate != null && reqStartDate != '' && reqEndDate != ''){
    var rtnResult = [];
    var reqStartDate = reqStartDate + ' 00:00:00';
    var reqEndDate = reqEndDate + ' 23:59:59';
    Worklog.findAll({
      include: [{
          model: Task,
          attributes: ['ParentTaskName', 'TaskName'],
          include: [{model: TaskType, attributes: ['Name', 'Category'],}]
      },{
        model: User,
        attributes: ['Name']
      }],
      where: {
        [Op.or]: [
          {createdAt: {[Op.between]: [reqStartDate, reqEndDate]}}, 
          {updatedAt: {[Op.between]: [reqStartDate, reqEndDate]}}
        ]
      },
      order: [
        ['updatedAt', 'DESC']
      ]
    }).then(function(worklogs) {
      if(worklogs != null && worklogs.length > 0){
        for(var i=0; i<worklogs.length; i++) {
          var resJson = {};
          resJson.effort = worklogs[i].Effort;
          if(worklogs[i].task.ParentTaskName != 'N/A'){
            resJson.task_number = worklogs[i].task.ParentTaskName;
          } else {
            resJson.task_number = worklogs[i].task.TaskName;
          }
          if(worklogs[i].task.task_type.Name == 'Change'){
            resJson.task_type = worklogs[i].task.task_type.Category;
          }
          else if(worklogs[i].task.task_type.Category == 'AM'){
            resJson.task_type = worklogs[i].task.task_type.Category;
          }
          else {
            resJson.task_type = worklogs[i].task.task_type.Name;
          }
          resJson.user_name = worklogs[i].user.Name;
          resJson.work_date = worklogs[i].WorklogMonth + '-' + worklogs[i].WorklogDay;
          rtnResult.push(resJson);
        }
      }
      return res.json({result:rtnResult, error:''});
    });
  } else {
    return res.json({result: false, error: 'Request param invalid!'});
  }
});

router.post('/queryTimesheetForTRLS', function(req, res, next) {
  var reqTaskName = req.body.task_number;
  if(reqTaskName != null & reqTaskName != ''){
    var rtnResult = [];
    Task.findAll({
      include: [{
        model: TaskType, 
        attributes: ['Name']
      }],
      where: {
        TaskName: {
          [Op.in]: reqTaskName
        }
      }
    }).then(function(task) {
      if(task != null && task.length > 0){
        for(var i=0; i<task.length; i++) {
          var resJson = {};
          resJson.effort = task[i].Effort;
          resJson.task_number = task[i].TaskName;
          resJson.task_type = task[i].task_type.Name;
          rtnResult.push(resJson);
        }
      }
      return res.json({result: rtnResult, error: ''});
    });
  }
  else {
    return res.json({result: false, error: 'Request param invalid!'});
  }
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
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

module.exports = router;

// Install dependencies: cnpm install
// Start server: set DEBUG=PMTBackend & cnpm start
//提交代码到Github： 1.暂存文件； 2.提交已暂存的文件(add comment); 3.推送
//同步代码：pull rebase（合并）