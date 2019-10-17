var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var TaskType = require('../model/task/task_type');
var Task = require('../model/task/task');
var Team = require('../model/team/team');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response tasks resource'});
});

//Task
router.get('/getAllTasksLimited', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      TaskName: {[Op.notLike]: 'Dummy - %'}
    },
    order: [
      ['updatedAt', 'DESC']
    ],
    limit:300
  }).then(function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_type = task[i].task_type.Name;
        if(task[i].Estimation != null && task[i].Estimation > 0){
          var percentage =  "" + toPercent(task[i].Effort, task[i].Estimation);
          resJson.task_progress = percentage.replace("%","");
        } else {
          resJson.task_progress = "-1";
        }
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

//Task list for web PMT
router.get('/getTaskList', function(req, res, next) {
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  var rtnResult = [];
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    },
    {
      model: Team, 
      attributes: ['Name']
    }],
    where: {
      ParentTaskName: 'N/A',
      TaskName: {[Op.notLike]: 'Dummy - %'}
    },
    order: [
      ['createdAt', 'DESC']
    ],
    limit: reqSize,
    offset: reqSize * (reqPage - 1),
  }).then(function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_type = task[i].task_type.Name;
        resJson.task_desc = task[i].Description;
        resJson.task_status = task[i].Status;
        resJson.task_effort = task[i].Effort;
        resJson.task_estimation = task[i].Estimation;
        resJson.task_assign_team = task[i].team.Name;
        resJson.task_created = task[i].createdAt;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});


//Get Total Task Size for web PMT
router.get('/getTotalTaskSize', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
    where: {
      ParentTaskName: 'N/A',
      TaskName: {[Op.notLike]: 'Dummy - %'}
    },
  }).then(function(task) {
    if(task.length > 0) {
      var resJson = {};
      resJson.task_total_size = task.length;
      rtnResult.push(resJson);
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getTaskByCreatedDate', function(req, res, next) {
    Task.findAll({
        where: {
            TaskName: req.body.tTaskName,
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

router.post('/getTaskByName', function(req, res, next) {
  var rtnResult = [];
  var taskKeyWord = req.body.tTaskName.trim();
  var criteria = {};
  if( req.body.tTaskTypeId == null || req.body.tTaskTypeId === '0'){
    criteria = {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'}
    }
  } else {
    criteria = {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      TaskTypeId: Number(req.body.tTaskTypeId),
      TaskName: {[Op.notLike]: 'Dummy - %'}
    }
  }
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    },
    {
      model: Team, 
      attributes: ['Name']
    }],
    where: criteria,
    limit:100,
    order: [
      ['updatedAt', 'DESC']
    ]
  }).then(function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_name = task[i].TaskName;
            resJson.task_type = task[i].task_type.Name;
            resJson.task_desc = task[i].Description;
            if(task[i].Estimation != null && task[i].Estimation > 0){
              var percentage =  "" + toPercent(task[i].Effort, task[i].Estimation);
              resJson.task_progress = percentage.replace("%","");
            } else {
              resJson.task_progress = "-1";
            }
            resJson.task_status = task[i].Status;
            resJson.task_effort = task[i].Effort;
            resJson.task_estimation = task[i].Estimation;
            resJson.task_assign_team = task[i].team.Name;
            resJson.task_created = task[i].createdAt;
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
        attributes: ['Id', 'Name']
      },
      {
        model: Team, 
        attributes: ['Id', 'Name']
      }],
      where: {
        Id: req.body.tId 
      }
  }).then(function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_parenttaskname = task[i].ParentTaskName;
            resJson.task_name = task[i].TaskName;
            resJson.task_creator = task[i].Creator;
            resJson.task_type = task[i].task_type.Name;
            resJson.task_type_id = task[i].task_type.Id;
            resJson.task_assign_team =  task[i].team.Name;
            resJson.task_assign_team_id =  task[i].team.Id;
            if(task[i].Status != null && !task[i].Status == ""){
              resJson.task_status = task[i].Status;
            } else {
              resJson.task_status = "N/A";
            }
            resJson.task_desc = task[i].Description;
            resJson.task_currenteffort = task[i].Effort;
            if(task[i].Estimation != null && task[i].Estimation >0){
              resJson.task_totaleffort =  task[i].Estimation;
              resJson.task_progress = toPercent(task[i].Effort, task[i].Estimation);
              var percentage =  "" + toPercent(task[i].Effort, task[i].Estimation);
              resJson.task_progress_nosymbol = percentage.replace("%","");
            } else {
              resJson.task_totaleffort = "0"
              resJson.task_progress = "0";
              resJson.task_progress_nosymbol = "0";
            }
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
      } else {
          return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

router.post('/getTaskByCompletedName', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
      include: [{
        model: TaskType, 
        attributes: ['Name']
      },
      {
          model: Team, 
          attributes: ['Name']
      }],
      where: {
        TaskName: req.body.tTaskName 
      }
  }).then(function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_parenttaskname = task[i].ParentTaskName;
            resJson.task_name = task[i].TaskName;
            resJson.task_type = task[i].task_type.Name;
            resJson.task_assign_team =  task[i].team.Name;
            if(task[i].Status != null && !task[i].Status == ""){
              resJson.task_status = task[i].Status;
            } else {
              resJson.task_status = "N/A";
            }
            resJson.task_desc = task[i].Description;
            resJson.task_currenteffort = task[i].Effort;
            if(task[i].Estimation != null && task[i].Estimation >0){
              resJson.task_totaleffort =  task[i].Estimation;
              resJson.task_progress = toPercent(task[i].Effort, task[i].Estimation);
              var percentage =  "" + toPercent(task[i].Effort, task[i].Estimation);
              resJson.task_progress_nosymbol = percentage.replace("%","");
            } else {
              resJson.task_totaleffort = "0"
              resJson.task_progress = "0";
              resJson.task_progress_nosymbol = "0";
            }
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
      } else {
          return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

router.post('/getSubTaskByParentTaskName', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
    attributes: ['Id', 'TaskName'],
    where: {
      ParentTaskName: req.body.tTaskName
    },
    order: [
      ['Id', 'ASC']
    ]
  }).then(function(task) {
      if(task.length > 0) {
        for(var i=0;i<task.length;i++){
          var resJson = {};
          resJson.task_subtask_id = task[i].Id;
          resJson.task_subtask_name = task[i].TaskName;
          rtnResult.push(resJson);
        }
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

router.post('/addOrUpdateTask', function(req, res, next) {
  Task.findOrCreate({
      where: { TaskName: req.body.tName }, 
      defaults: {
        ParentTaskName: req.body.tParent,
        TaskName: req.body.tName,
        Description: req.body.tDescription,
        TaskTypeId: Number(req.body.tTaskTypeId),
        Status: req.body.tStatus,
        Creator: 'PMT',
        Effort: Number(req.body.tEffort),
        Estimation: Number(req.body.tEstimation),
        AssignTeamId: Number(req.body.tAssignTeamId),
      }})
    .spread(function(task, created) {
      if(created) {
        console.log("Task created");
        return res.json(responseMessage(0, task, 'Task Created'));
      } else {
        console.log("Task existed");
        Task.update({
            ParentTaskName: req.body.tParent,
            TaskName: req.body.tName,
            Description: req.body.tDescription,
            TaskTypeId: Number(req.body.tTaskTypeId),
            Status: req.body.tStatus,
            Effort: Number(req.body.tEffort),
            Estimation: Number(req.body.tEstimation),
            AssignTeamId: Number(req.body.tAssignTeamId)
          },
          {where: {TaskName: req.body.tName}}
        );
        return res.json(responseMessage(1, task, 'Task existed'));
      }
  });
});

//Task Type
router.get('/getAllTaskType', function(req, res, next) {
  var rtnResult = [];
  TaskType.findAll().then(function(taskType) {
    if(taskType.length > 0) {
      for(var i=0;i<taskType.length;i++){
        var resJson = {};
        resJson.type_id = taskType[i].Id;
        resJson.type_name = taskType[i].Name;
        resJson.type_category = taskType[i].Category;
        resJson.type_value = taskType[i].Value;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task type existed'));
    }
  })
});

router.post('/addTaskType', function(req, res, next) {
  var reqData = {}
  if( req.body.taskTypeId != "0"){
    reqData = { Id: req.body.taskTypeId };
  } else {
    reqData = { Name: req.body.taskTypeName };
  }
  TaskType.findOrCreate({
    where: reqData, 
    defaults: {
      Name: req.body.taskTypeName,
      Category: req.body.taskTypeCategory,
      Value: req.body.taskTypeValue
    }})
  .spread(function(taskType, created) {
    if(created) {
      return res.json(responseMessage(0, taskType, 'Created task type successfully!'));
    } 
    else if(taskType != null && !created) {
      taskType.update({
        Name: req.body.taskTypeName,
        Category: req.body.taskTypeCategory,
        Value: req.body.taskTypeValue
      });
      return res.json(responseMessage(0, taskType, 'Updated task type successfully!'));
    }
    else {
      return res.json(responseMessage(1, null, 'Created task type failed'));
    }
  });
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

function toPercent(numerator, denominator){
  var point = Number(numerator) / Number(denominator);
  if (point > 1) {
    point = 1;
  }
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

