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
  Reference.findOne({where: {Name: "ProjectName"}}).then(function(reference){
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
  var taskType = req.body.task_type;
  var session = req.body.session;
  var taskTotalEffort = req.body.task_effort;

  Task.findOrCreate({
    where: {TaskName: taskNumber}, 
    defaults: {
        ParentTaskName: req.body.tParentTaskName,
        TaskName: req.body.tTaskName,
        Description: req.body.tDescription,
        TaskTypeId: req.body.tTaskTypeId,
        Priority: req.body.tPriority,
        Status: req.body.tStatus,
        Creator: req.body.tCreator,
        Effort: req.body.tEffort,
        Estimation: req.body.tEstimation,
        StartDate: req.body.tStartDate,
        DueDate: req.body.tDueDate
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
