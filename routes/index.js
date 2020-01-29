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
  var taskCollection = processRequest(req);
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

  async function createTask(taskObj, cb){
    //console.log('Start to create task: ' + taskObj.TaskName);
    Logger.info('Start to create task: ' + taskObj.TaskName);
    try {
      var errMsg = '';
      //Default task field
      var tParentTaskName = 'N/A';
      var tName = taskObj.TaskName;
      var tDescription = taskObj.Description;
      var tStatus = taskObj.Status;
      var tCreator = 'ServiceNow';
      var tEffort = 0;
      var tEstimation = taskObj.Estimation;
      var tTaskType = taskObj.TaskType;
      var tTaskTypeId = 0;
      tParentTaskName = await getTaskPool(tTaskType);
      var tTaskBizProject = taskObj.BizProject;
      var tBusinessArea = '';
      var tRespLeader = taskObj.TaskRespLeader;
      var tRespLeaderId = await getUserMapping(tRespLeader);
      var tTaskIssueDate = taskObj.TaskIssueDate;
      //Get task type info
      console.log("Type = " + tTaskType + ', Status = ' + tStatus);
      var inTaskType = await getTaskTypeInfo(tTaskType);
      if(inTaskType != null){
        tTaskTypeId = inTaskType.Id;
        if(tEstimation == 0 && inTaskType.Value > 0){
          tEstimation = Number(inTaskType.Value);
        }
      } else {
        errMsg = 'Task [' + taskObj.TaskName + ']: Task type [' + taskObj.TaskType + '] is not exist'
        console.log(errMsg)
      }
      var inTaskStatus = await getStatusMapping(tTaskType, tStatus);
      if(inTaskStatus != null){
        tStatus = inTaskStatus;
        console.log('Status: ' + tStatus);
      }
      console.log('Start to create/Update task');
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
            BizProject: tTaskBizProject,
            BusinessArea: tBusinessArea,
            TaskLevel: 3, 
            IssueDate: tTaskIssueDate,
            RespLeaderId: tRespLeaderId
        }
      })
      .spread(function(task, created) {
        if(created) {
          console.log('Task created');
          Logger.info('Task created');
        }
        else if(task != null && !created){ 
          var parentTask = 'N/A';
          if (task.ParentTaskName == 'N/A') {
            parentTask = tParentTaskName;
          }
          task.update({
            ParentTaskName: parentTask,
            Description: tDescription,
            Status: tStatus,
            Estimation: tEstimation,
            TaskTypeId: tTaskTypeId,
            Creator: tCreator,
            BizProject: tTaskBizProject,
            BusinessArea: tBusinessArea,
            TaskLevel: 3,
            IssueDate: tTaskIssueDate,
            RespLeaderId: tRespLeaderId
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
    } catch(exception) {
      var exMsg = 'Exception occurred: ' + exception;
      console.error(exMsg);
      Logger.info(exMsg);
      cb(exMsg, taskObj);
    }
  }
});

//Spider job to receive task list for service now
router.post('/receiveTaskListForTRLS', function(req, res, next) {
  Logger.info('Request: \n' + JSON.stringify(req.body))
  //console.log('Request: \n' + JSON.stringify(req.body))
  var taskCollection = processRequest(req);
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

  async function createTask(taskObj, cb){
    //console.log('Start to create task: ' + taskObj.TaskName);
    Logger.info('Start to create task: ' + taskObj.TaskName);
    try {
      var errMsg = '';
      //Default task field
      var tParentTaskName = 'N/A';
      var tName = taskObj.TaskName;
      var tDescription = taskObj.Description;
      var tStatus = taskObj.Status;
      var tCreator = 'TRLS';
      var tEffort = 0;
      var tEstimation = taskObj.Estimation;
      var tTaskType = taskObj.TaskType;
      var tTaskTypeId = 0;
      tParentTaskName = await getTaskPool(tTaskType);
      var tTaskBizProject = taskObj.BizProject;
      var tBusinessArea = '';
      var tTaskIssueDate = taskObj.TaskIssueDate;
      //Get task type info
      var inTaskType = await getTaskTypeInfo(tTaskType);
      console.log('Type--' + JSON.stringify(inTaskType));
      if(inTaskType != null){
        tTaskTypeId = inTaskType.Id;
      } else {
        errMsg = 'Task [' + taskObj.TaskName + ']: Task type [' + taskObj.TaskType + '] is not exist'
        console.log(errMsg)
      }
      var inTaskStatus = await getStatusMapping(tTaskType, tStatus);
      if(inTaskStatus != null){
        tStatus = inTaskStatus;
      }
      console.log('Start to create/Update task');
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
            BizProject: tTaskBizProject,
            BusinessArea: tBusinessArea,
            TaskLevel: 3,
            IssueDate: tTaskIssueDate
        }
      })
      .spread(function(task, created) {
        if(created) {
          console.log('Task created');
          Logger.info('Task created');
        }
        else if(task != null && !created){ 
          var parentTask = 'N/A';
          if (task.ParentTaskName == 'N/A') {
            parentTask = tParentTaskName;
          }
          task.update({
            ParentTaskName: parentTask,
            Description: tDescription,
            Status: tStatus,
            Estimation: tEstimation,
            TaskTypeId: tTaskTypeId,
            Creator: tCreator,
            BizProject: tTaskBizProject,
            BusinessArea: tBusinessArea,
            TaskLevel: 3,
            IssueDate: tTaskIssueDate
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
    } catch(exception) {
      var exMsg = 'Exception occurred: ' + exception;
      console.error(exMsg);
      Logger.info(exMsg);
      cb(exMsg, taskObj);
    }
  }
});

function processRequest(req){
  //Get request params
  var taskNumber = req.body.number;
  var taskdesc = req.body.short_description;
  var taskStatus = req.body.state;
  var taskAssignTeam = req.body.assignment_group;
  var taskEstimation = req.body.task_effort;
  var taskBizProject = req.body.bizProject;
  var taskCategorization = req.body.path;
  var taskRespLeader = req.body.assigned_to;
  var taskReportedDate = req.body.reported_date;
  var taskCollection = [];
  for(var i=0; i<taskNumber.length; i++){
    var taskJson = {};
    //Not Null: Task Number/Description/Status
    taskJson.TaskName = taskNumber[i];
    taskJson.Description = taskdesc[i];
    taskJson.Status = taskStatus[i];
    taskJson.AssignTeam = taskAssignTeam[i].toUpperCase();
    //Task Biz Project
    if (taskBizProject != null && taskEstimation != undefined) {
      taskJson.BizProject = taskBizProject[i];
    } else {
      taskJson.BizProject = ''
    }
    //Task Estimation
    var taskEstimationNum = 0;
    if(taskEstimation != null && taskEstimation != undefined){
      taskEstimationNum = Number(taskEstimation[i]) * 8;
    }
    taskJson.Estimation = taskEstimationNum;
    //Task Category
    if(taskNumber[i].toUpperCase().startsWith('CG')){
      taskJson.TaskType = 'Change';
    }
    else if(taskNumber[i].toUpperCase().startsWith('PRB')){
      taskJson.TaskType = 'Problem';
    }
    else if(taskNumber[i].toUpperCase().startsWith('INCTASK')){
      taskJson.TaskType = 'ITSR';
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
    //Task responsible leader
    if (taskRespLeader != null && taskRespLeader.length > 0) {
      taskJson.TaskRespLeader = taskRespLeader[i];
    } else {
      taskJson.TaskRespLeader = null;
    }
    //Task Issue date
    if (taskReportedDate != null && taskReportedDate.length > 0) {
      taskJson.TaskIssueDate = taskReportedDate[i];
    } else {
      taskJson.TaskIssueDate = null;
    }
    taskCollection.push(taskJson);
  }
  return taskCollection;
}

function getTaskTypeInfo(iTaskType){
  return new Promise((resolve, reject) => {
    TaskType.findOne({
      where: {
        Name: iTaskType
    }}).then(function(taskType) {
      console.log('Find task type: ' + iTaskType);
      if(taskType != null) {
        resolve(taskType);
      } else {
        resolve(null);
      }
    });
  });
}

function getStatusMapping(iTaskType, iStatus) {
  return new Promise((resolve, reject) => {
    Reference.findOne({
      where: {
        Name: 'TaskTypeMapping',
        Type: iTaskType
    }}).then(function(reference) {
      if(reference != null){
        var statusMapping = reference.Value;
        var statusMappingJson = JSON.parse(statusMapping);
        for(var i=0;i<statusMappingJson.length;i++){
          var mappingGroup = statusMappingJson[i].Group;
          if(mappingGroup.indexOf(iStatus) > -1){
            console.log('Status Mapping:' + iStatus + ' => ' + statusMappingJson[i].Status);
            resolve(statusMappingJson[i].Status); 
          }
        }//End of find task type mapping
      }
      resolve(null);
    });
  });
}

function getUserMapping (iUser) {
  return new Promise((resolve, reject) => {
    User.findAll({
      where: {
        Role: {[Op.ne]: 'Special'},
        Level: {[Op.ne]: -1}
      }
    }).then(function(user) {
      if(user != null){
        var flag = false;
        for(var i=0; i< user.length; i++){
          if(user[i].NameMapping != null){
            var userMappingArray = user[i].NameMapping.split(';');
            if(getIndexOfValueInArr(userMappingArray, null, iUser) != -1){
              flag = true;
              resolve(user[i].Id);
            }
          } else {
            continue;
          }
        }
        if(!flag){
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

function getTaskPool(iTaskType) {
  return new Promise((resolve, reject) => {
    Reference.findOne({
      where: {
        Name: 'TaskPool',
        Type: iTaskType
      }
    }).then(function(reference) {
      if(reference != null){
        var taskPoolName = reference.Value;
          console.log('Debug 1 : ' + taskPoolName);
        if(taskPoolName != null && taskPoolName != '' && taskPoolName != 'N/A'){
          console.log('Parent Task: ' + taskPoolName);
          resolve(taskPoolName);
        } else {
          console.log('Debug 2');
          resolve('N/A');
        }
      } else {
        console.log('Debug 3');
        resolve('N/A');
      }
    });
  });
}

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
    if(iKey != null){
      if(item[iKey] == iValue){
        return i;
      }
    } 
    if(iKey == null){
      if(item == iValue){
        return i;
      }
    }
  }
  return -1;
}

module.exports = router;

// Install dependencies: cnpm install
// Start server: set DEBUG=PMTBackend & cnpm start
//提交代码到Github： 1.暂存文件； 2.提交已暂存的文件(add comment); 3.推送
//同步代码：pull rebase（合并）