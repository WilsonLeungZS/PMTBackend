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
  var taskAssignTo = req.body.assigned_to;
  var taskCreatedTime = req.body.created;
  var taskTypeString = req.body.task_type;
  var session = req.body.session;
  var taskTotalEffort = req.body.task_effort;
  var taskCategorization = [];
  var taskEffortNum = 0;
  if(req.body.path != null && req.body.path != ''){
    taskCategorization = req.body.path;
  }
  for(var i=0; i< taskNumber.length; i++){
    if(taskNumber[i].toUpperCase().startsWith('CG')){
      taskTypeString[i] = "Change";
      taskEffortNum = Number(taskTotalEffort[i]);
    }
    else if(taskNumber[i].toUpperCase().startsWith('PRB')){
      taskTypeString[i] = 'Problem';
      taskEffortNum = 24;
    }
    else if(taskNumber[i].toUpperCase().startsWith('INCTASK')){
      taskTypeString[i] = 'ITSR';
      taskEffortNum = 24;
    }
    else if(taskNumber[i].toUpperCase().startsWith('LEAVE')){
      taskTypeString[i] = 'Leave';
      taskEffortNum = 0;
    }
    else if(taskCategorization != null && taskCategorization.length > 0){
      if(taskCategorization[i].toUpperCase().startsWith("Service")){
        taskTypeString[i] = 'Service Request';
        taskEffortNum = 8;
      } else {
        taskTypeString[i] = 'Incident';
        taskEffortNum = 4;
      }
    }
    else {
      taskTypeString[i] = 'Sponsor Task';
    }
    TaskType.findOne({where: {Name: taskTypeString[i]}}).then(function(taskType) {
      var taskTypeId = 0;
      if(taskType != null) {
        taskTypeId = taskType.Id;
      } 
      Task.findOrCreate({
        where: {TaskName: taskNumber}, 
        defaults: {
            ParentTaskName: 'N/A',
            TaskName: taskNumber[i],
            Description: taskdesc[i],
            TaskTypeId: taskTypeId,
            Status: taskStatus[i],
            Effort: 0,
            Estimation: taskEffortNum,
            StartDate: req.body.tStartDate,
            createdAt: new Date(taskCreatedTime[i]),
            AssignTeamId: 0
        }})
      .spread(function(task, created) {
        if(created) {
          console.log("Task created");
          return res.json(responseMessage(0, task, ''));
        } else {
          console.log("Task existed");
          return res.json(responseMessage(1, null, 'Task existed'));
        }
      });
    })
  }
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

function mapToTeam(inTeamName){

}

module.exports = router;

// Install dependencies: cnpm install
// Start server: set DEBUG=PMTBackend & cnpm start
//提交代码到Github： 1.暂存文件； 2.提交已暂存的文件(add comment); 3.推送
//同步代码：pull rebase（合并）
