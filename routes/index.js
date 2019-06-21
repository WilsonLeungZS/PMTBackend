var express = require('express');
var router = express.Router();
var Reference = require('../model/reference');
var Task = require('../model/task/task');
var User = require('../model/user');
var Team = require('../model//team/team');
var TaskType = require('../model/task/task_type');
var Worklog = require('../model/worklog');

/* GET home page. */
router.get('/', function(req, res, next) {
  return res.json({message: 'Response index resource'});
});

router.get('/getInfo', function(req, res, next) {
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
  var taskTypeString = req.body.task_type;
  var taskTotalEffort = req.body.task_effort;
  var taskCategorization = taskCategorization = req.body.path;;
  for(var i=0; i< taskNumber.length; i++){
    var taskEffortNum = 0;
    var needCreateSubTask = false;
    if(taskTotalEffort != null && taskTotalEffort.length > 0){
      taskEffortNum = Number(taskTotalEffort[i]);
    }
    if(taskNumber[i].toUpperCase().startsWith('CG')){
      taskTypeString[i] = "Change";
      needCreateSubTask = true;
    }
    else if(taskNumber[i].toUpperCase().startsWith('PRB')){
      taskTypeString[i] = 'Problem';
    }
    else if(taskNumber[i].toUpperCase().startsWith('INCTASK')){
      taskTypeString[i] = 'ITSR';
    }
    else if(taskNumber[i].toUpperCase().startsWith('LEAVE')){
      taskTypeString[i] = 'Leave';
    }
    else if(taskCategorization != null && taskCategorization.length > 0){
      if(taskCategorization[i].toUpperCase().startsWith("SERVICE")){
        taskTypeString[i] = 'Service Request';
      } else {
        taskTypeString[i] = 'Incident';
      }
    }
    else {
      taskTypeString[i] = 'Sponsor Task';
    }
    var taskTypeId = 0
    var assignTeamId = 0;
    TaskType.findOne({where: {Name: taskTypeString[i]}}).then(function(taskType) {
      if(taskType != null) {
        taskTypeId = taskType.Id;
        if(taskEffortNum == 0 && taskType.Value > 0){
          taskEffortNum = Number(taskType.Value);
        }
      } 
      Team.findAll({where: {IsActive: true}}).then(function(teamArray){
        if(teamArray != null && teamArray.length > 0 && taskAssignTeam != null && taskAssignTeam.length > 0){
          for(var a=0;a<teamArray;a++){
            var teamMapping = teamArray[a].Mapping.split(",");
            if(teamMapping.indexOf(taskAssignTeam[i]) > -1){
              assignTeamId = teamArray[a].Id;
            }
          }
        }
        Task.findOrCreate({
          where: {TaskName: taskNumber}, 
          defaults: {
              ParentTaskName: 'N/A',
              Creator: 'admin',
              Effort: 0,
              TaskName: taskNumber[i],
              Description: taskdesc[i],
              TaskTypeId: taskTypeId,
              Status: taskStatus[i],
              Estimation: taskEffortNum,
              AssignTeamId: assignTeamId
          }})
        .spread(function(task, created) {
          if(created) {
            console.log("Task created");
            return res.json(responseMessage(0, task, 'Create task successfully'));
          }
          else if(task != null && !created){
            console.log("Task updated");
            task.update({
              Description: taskdesc[i],
              TaskTypeId: taskTypeId,
              Status: taskStatus[i],
              Estimation: taskEffortNum,
              AssignTeamId: assignTeamId
            });
            return res.json(responseMessage(0, task, 'Update task successfully'));
          } 
          else {
            console.log("Task create fail");
            return res.json(responseMessage(1, null, 'Task existed'));
          }
        });
      }); //End find team
    }); // End find task type
  }// End loop
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
