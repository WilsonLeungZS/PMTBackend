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
  return res.json({message: 'Response index resource'});
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
//Spider job to receive task list
router.post('/receiveTaskList', function(req, res, next) {
  var taskNumber = req.body.number;
  var taskdesc = req.body.short_description;
  var taskStatus = req.body.state;
  var taskAssignTeam = req.body.assignment_group;
  var taskTotalEffort = req.body.task_effort;
  var taskCategorization = req.body.path;

  var taskCollection = [];
  for(var i=0; i<taskNumber.length; i++){
    var taskJson = {};
    taskJson.TaskName = taskNumber[i];
    taskJson.Description = taskdesc[i];
    taskJson.Status = taskStatus[i];
    taskJson.AssignTeam = taskAssignTeam[i].toUpperCase();
    taskJson.NeedSubTask = false;
    var taskTotalEffortNum = 0;
    if(taskTotalEffort != null && taskTotalEffort != undefined){
      taskTotalEffortNum = Number(taskTotalEffort[i]);
      console.log('Task Number: '+ taskTotalEffortNum);
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
  console.log('Task Collection: ' + JSON.stringify(taskCollection));
  async.eachSeries(taskCollection, function(taskObj, callback) {
    createTask(taskObj, function(){
        callback();
    });
  }, function(err){
    if(err != null){
      console.log("Create task err is:" + err);
      return res.json({result: false, error: err});
    }
    return res.json({result: true, error: ""});
  });
  function createTask(taskObj, cb){
    console.log('Start to create task: ' + taskObj.TaskName);
    var tParentTaskName = 'N/A';
    var tName = taskObj.TaskName;
    var tDescription = taskObj.Description;
    var tStatus = taskObj.Status;
    var tCreator = 'admin';
    var tEffort = 0;
    var tEstimation = taskObj.TotalEffort;
    var tTaskType = taskObj.TaskType;
    var tTaskTypeId = 0;
    var tAssignTeam = taskObj.AssignTeam;
    var tAssignTeamId = 0;
    var tNeedSubTask = taskObj.NeedSubTask;
    TaskType.findOne({where: {Name: tTaskType}}).then(function(taskType) {
      console.log('Find task type: ' + tTaskType);
      if(taskType != null) {
        tTaskTypeId = taskType.Id;
        if(tEstimation == 0 && taskType.Value > 0){
          tEstimation = Number(taskType.Value);
        }
      }
      //Get task assign team
      Team.findAll({where: {IsActive: true}}).then(function(teamArray){
        console.log('Find team: tasktype-' + tTaskTypeId + ', effort-'+tEstimation);
        if(teamArray != null && teamArray.length > 0){
          console.log('Start team mapping');
          for(var a=0;a<teamArray.length;a++){
            var teamMapping = teamArray[a].Mapping.split(",");
            console.log('Mapping Array: ' + teamMapping);
            if(teamMapping.indexOf(tAssignTeam) > -1){
              tAssignTeamId = teamArray[a].Id;
              console.log('Create task: assignTeamId-' + tAssignTeamId);
            }
          }
        }
        console.log('Start to create task');
        console.log('Task assign team id: '+ tAssignTeamId);
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
              AssignTeamId: tAssignTeamId
          }})
        .spread(function(task, created) {
          if(created) {
            console.log('Task created');
            if(tNeedSubTask){
              var subtaskCollection = [];
              var subtaskArray = ['Analysis', 'Design', 'Build', 'Test', 'Deploy'];
              for(var j=0; j<5; j++){
                var subtaskJson = {};
                subtaskJson.ParentTaskName = tName;
                subtaskJson.TaskName = tName + ' - ' + subtaskArray[j];
                subtaskJson.Description = tName + ' ' + subtaskArray[j] + ' Task';
                subtaskJson.Status = 'N/A';
                subtaskJson.Creator = 'admin';
                subtaskJson.Effort = 0;
                subtaskJson.Estimation = 0;
                subtaskJson.TaskTypeId = tTaskTypeId;
                subtaskJson.AssignTeamId = tAssignTeamId;
                subtaskCollection.push(subtaskJson);
              }
              async.eachSeries(subtaskCollection, function(subtaskObj, callback) {
                createSubTask(subtaskObj, function(){
                    callback();
                });
              }, function(err){
                  console.log("Create sub task err is:" + err);
              });
              function createSubTask(subtaskObj, cb1){
                console.log("Create sub-task" + subtaskObj.TaskName);
                Task.create({ 
                  ParentTaskName:subtaskObj.ParentTaskName, 
                  TaskName:subtaskObj.TaskName, 
                  Description:subtaskObj.Description, 
                  Status:subtaskObj.Status, 
                  Creator:subtaskObj.Creator = 'admin', 
                  Effort:subtaskObj.Effort, 
                  Estimation:subtaskObj.Estimation, 
                  TaskTypeId:subtaskObj.TaskTypeId, 
                  AssignTeamId:subtaskObj.AssignTeamId
                });
                cb1(null, subtaskObj);
              }
            }
          }
          else if(task != null && !created){
            console.log('Task updated');
            task.update({
              Description: tDescription,
              Status: tStatus,
              Estimation: tEstimation,
              TaskTypeId: tTaskTypeId,
              AssignTeamId: tAssignTeamId
            });
          } 
          else {
            console.log('Task create fail');
          }
        }); 
      }); 
    });
    cb(null, taskObj);
  }
});

router.get('/queryTimesheet', function(req, res, next) {
  var reqStartDate = req.query.start_date;
  var reqEndDate = req.query.end_date;
  var reqTaskName = req.query.task_number;
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
  }
  else if(reqTaskName != null & reqTaskName != ''){
    var rtnResult = [];
    Task.findOne({
      include: [{
        model: TaskType, 
        attributes: ['Name']
      }],
      where: {
        TaskName: reqTaskName.toUpperCase()
      }
    }).then(function(task) {
      if(task != null){
        var resJson = {};
        resJson.effort = task.Effort;
        resJson.task_number = task.TaskName;
        rtnResult.push(resJson);
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

module.exports = router;

// Install dependencies: cnpm install
// Start server: set DEBUG=PMTBackend & cnpm start
//提交代码到Github： 1.暂存文件； 2.提交已暂存的文件(add comment); 3.推送
//同步代码：pull rebase（合并）
