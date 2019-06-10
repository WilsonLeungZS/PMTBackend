var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var TaskType = require('../model/task/task_type');
var Task = require('../model/task/task')

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response tasks resource'});
});

//Task
router.get('/getAllTask', function(req, res, next) {
    Task.findAll().then(function(task) {
      if(task.length > 0) {
        return res.json(responseMessage(0, task, ''));
      } else {
        return res.json(responseMessage(1, null, 'No task exist'));
      }
    })
});

router.post('/getTaskByCreatedDate', function(req, res, next) {
    Task.findAll({
        where: {
            TaskNumber: req.body.tTaskNumber,
            createdAt: { [Op.gt]: req.body.tCreatedDate}
        }
    }).then(function(task) {
        if(task.length > 0) {
            return res.json(responseMessage(0, task, ''));
        } else {
            return res.json(responseMessage(1, null, 'No task exist after created time'));
        }
    })
});

router.post('/getTaskByNumber', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
      where: {
          TaskNumber: {[Op.like]:'%' + req.body.tNumber + '%'}
      }
  }).then(function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_nbr = task[i].TaskNumber;
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
      } else {
          return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

router.post('/getTaskById', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
      include: [{
        model: TaskType, 
        attributes: ['Name']
      }],
      where: {
        Id: req.body.tId 
      }
  }).then(function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_nbr = task[i].TaskNumber;
            resJson.task_type = task[i].task_type.Name;
            resJson.task_status = task[i].Status;
            resJson.task_currenteffort = task[i].Effort;
            if(task[i].Estimation != null){
              resJson.task_totaleffort =  task[i].Estimation;
              resJson.task_progress = toPercent(task[i].Effort / task[i].Estimation);
            } else {
              resJson.task_totaleffort = "0"
              resJson.task_progress = "0";
            }
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
      } else {
          return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

router.post('/addTask', function(req, res, next) {
    if (req.body.tTaskNumber == undefined || req.body.tTaskNumber == '') {
        return res.json(responseMessage(1, null, 'Task number is empty'));
    }
    Task.findOrCreate({
        where: {TaskNumber: req.body.tTaskNumber}, 
        defaults: {
            ParentTaskId: req.body.tParentTaskId,
            TaskNumber: req.body.tTaskNumber,
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

//Task Type
router.get('/getAllTaskType', function(req, res, next) {
    TaskType.findAll().then(function(taskType) {
      if(taskType.length > 0) {
        return res.json(responseMessage(0, taskType, ''));
      } else {
        return res.json(responseMessage(1, null, 'No task type existed'));
      }
    })
});

router.post('/addTaskType', function(req, res, next) {
    if (req.body.taskTypeName == undefined || req.body.taskTypeName == '') {
        return res.json(responseMessage(1, null, 'Task type name is empty'));
    }
    TaskType.findOrCreate({
        where: {Name: req.body.taskTypeName}, 
        defaults: {
          Name: req.body.taskTypeName,
          Category: req.body.taskTypeCategory,
        }})
      .spread(function(taskType, created) {
        if(created) {
          console.log("Task type created");
          return res.json(responseMessage(0, taskType, ''));
        } else {
          console.log("Task type existed");
          return res.json(responseMessage(1, null, 'Created failed: task type existed'));
        }
    });
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

function toPercent(point){
  var str=Number(point*100).toFixed(0);
  str+="%";
  return str;
}

/*function dateToString(date) {  
  var y = date.getFullYear();  
  var m = date.getMonth() + 1;  
  m = m < 10 ? ('0' + m) : m;  
  var d = date.getDate();  
  d = d < 10 ? ('0' + d) : d;  
  var h = date.getHours();  
  var minute = date.getMinutes();  
  minute = minute < 10 ? ('0' + minute) : minute; 
  var second= date.getSeconds();  
  second = minute < 10 ? ('0' + second) : second;  
  return y + '-' + m + '-' + d+' '+h+':'+minute+':'+ second;  
};*/


module.exports = router;

