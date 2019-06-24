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

/* GET home page. */
router.get('/', function(req, res, next) {
  Logger.info('Index log');
  console.log('Index');
  var objs = [{name:'A'}, {name:'B'}, {name:'C'}];
  function doSomething(obj, cb)
  {
      console.log("我在做" + obj.name + "这件事!");
      cb(null, obj);
  }
  async.eachSeries(objs, function(obj, callback) {
      doSomething(obj, function(){
          callback();
      });
  }, function(err){
      console.log("err is:" + err);
  });
  console.log('End');
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
  console.log('TaskNumber length: ' + taskNumber.length + ' / ' + taskNumber[0]);
  var taskdesc = req.body.short_description;
  var taskStatus = req.body.state;
  var taskAssignTeam = req.body.assignment_group;
  var taskTypeString = req.body.task_type;
  var taskTotalEffort = req.body.task_effort;
  var taskCategorization = req.body.path;
  var i = 0;
  async.whilst(
    function(){ 
      console.log('check ' + i);
      console.log('Check: ' + (Number(i) < Number(taskNumber.length))); 
      return (Number(i) < Number(taskNumber.length));
    },
    function(callback){
      console.log('Start to handle task list');
      var taskEffortNum = 0;
      var needCreateSubTask = false;
      var parentTaskName = '';
      var reqTaskType = '';
      if(taskTotalEffort != null && taskTotalEffort.length > 0){
        taskEffortNum = Number(taskTotalEffort[i]);
      }
      if(taskNumber[i].toUpperCase().startsWith('CG')){
        reqTaskType = 'Change';
        needCreateSubTask = true;
        parentTaskName = req.body.number;
      }
      else if(taskNumber[i].toUpperCase().startsWith('PRB')){
        reqTaskType = 'Problem';
      }
      else if(taskNumber[i].toUpperCase().startsWith('INCTASK')){
        reqTaskType = 'ITSR';
      }
      else if(taskNumber[i].toUpperCase().startsWith('LEAVE')){
        reqTaskType = 'Leave';
      }
      else if(taskCategorization != null && taskCategorization.length > 0){
        if(taskCategorization[i].toUpperCase().startsWith("SERVICE")){
          reqTaskType = 'Service Request';
        } else {
          reqTaskType = 'Incident';
        }
      }
      else {
        reqTaskType = 'Sponsor Task';
      }
      var taskTypeId = 0
      var assignTeamId = 0;
      TaskType.findOne({where: {Name: reqTaskType}}).then(function(taskType) {
        console.log('Find task type: ' + reqTaskType);
        if(taskType != null) {
          taskTypeId = taskType.Id;
          if(taskEffortNum == 0 && taskType.Value > 0){
            taskEffortNum = Number(taskType.Value);
          }
        } 
        Team.findAll({where: {IsActive: true}}).then(function(teamArray){
          console.log('Find team: tasktype-' + taskTypeId + ', effort-'+taskEffortNum);
          if(teamArray != null && teamArray.length > 0 && taskAssignTeam != null && taskAssignTeam.length > 0){
            for(var a=0;a<teamArray;a++){
              var teamMapping = teamArray[a].Mapping.split(",");
              if(teamMapping.indexOf(taskAssignTeam[i]) > -1){
                assignTeamId = teamArray[a].Id;
              }
            }
          }
          console.log('Create task: assignTeamId-' + assignTeamId);
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
              console.log('Task created');
              if(needCreateSubTask){
                var j = 0;
                var subtaskArray = ['Analysis', 'Design', 'Build', 'Test', 'Deploy'];
                async.whilst(
                  function(){ console.log('check sub task'+j); return j<5},
                  function(callback1){
                    Task.create({ 
                      ParentTaskName:parentTaskName, 
                      TaskName:taskNumber[i]+' - '+subtaskArray[j], 
                      Description:taskNumber[i]+' '+subtaskArray[j]+' Task', 
                      Status:'N/A', 
                      Creator:'admin', 
                      Effort:0, 
                      Estimation:0, 
                      TaskTypeId:taskTypeId, 
                      AssignTeamId:assignTeamId
                    });
                    j++;
                    callback1();
                  },
                  function(err){
                    if(err){
                      console.log(err);
                    }
                    console.log('sub task whilst Done');
                  }
                )
              }
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
            } 
            else {
              console.log("Task create fail");
            }
            i++;
            callback();
          });
        }); //End find team
      }); // End find task type
    },
    function(err){
      if(err){
        console.log(err);
      }
      console.log('Done');
      return res.json(responseMessage(0, null, ''));
    })// End loop
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
