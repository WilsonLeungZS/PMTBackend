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
var TaskGroup = require('../model/task/task_group');
var Schedule = require('../model/schedule')
var Sequelize = require('sequelize');
const Op = Sequelize.Op;

/* GET home page. */
router.get('/', function(req, res, next) {
  Logger.info('Index log');
  Reference.findOne({where: {Name: 'Environment'}}).then(function(reference){
    if (reference != null) {
      var env = reference.Value;
      return res.json({message: 'Get Response index resource: PMT Version 3.1 ' + env});
    } else {
      return res.json({message: 'Get Response index resource: PMT Version 3.1'});
    }
  })
  
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
      var taskPoolRef = await getReference('TaskPool', tTaskType);
      var taskTypeTag = 'One-Off Task';
      if (taskPoolRef != null) {
        if (taskPoolRef.Value != null && taskPoolRef.Value != '') {
          tParentTaskName = taskPoolRef.Value;
        }
      }
      var tTaskBizProject = taskObj.BizProject;
      var tBusinessArea = '';
      var tAssignee = taskObj.TaskAssignee;
      var tAssigneeId = await getUserMapping(tAssignee);
      var tTaskIssueDate = taskObj.TaskIssueDate;
      if(tTaskIssueDate == null) {
        tTaskIssueDate = dateToString(new Date());
      }
      var taskAssignTeam = taskObj.AssignTeam;
      var userAssignmentList = await getAssignmentUser(taskAssignTeam);
      var autoAssignToTaskType = null;
      var tTaskGroupId = null;
      var tRespLeaderId = null
      if(tAssigneeId != '' && tAssigneeId != null && tTaskIssueDate != null){
        // Auto assign Service now task to task group
        var issueDateArray = tTaskIssueDate.split(" ");
        var issueDateStr = issueDateArray[0];
        var autoAssignToTaskKeyWord = null;
        var autoAssignToTaskRef = await getReference('AutoAssignToTask', tTaskType);
        if (autoAssignToTaskRef != null) {
          autoAssignToTaskKeyWord = autoAssignToTaskRef.Value;
          var autoAssignToTask = await getTaskByDescriptionKeyWord(autoAssignToTaskKeyWord, userAssignmentList);
          if(autoAssignToTask != null) {
            RespLeaderId = autoAssignToTask.RespLeaderId;
            var lv1TaskName = autoAssignToTask.ParentTaskName;
            tParentTaskName = autoAssignToTask.TaskName;
            autoAssignToTaskType = autoAssignToTask.task_type.Name;
            if(lv1TaskName != null && lv1TaskName != '' && lv1TaskName != 'N/A') {
              if(issueDateStr != null && issueDateStr != '') {
                var taskGroup = await getTaskGroupByDateAndRelateTask(issueDateStr, lv1TaskName);
                if(taskGroup != null) {
                  tTaskGroupId = taskGroup.Id;
                }
              }
            } // End to find task group
          }
        }
      }
      //Get task type info
      var inTaskStatus = await getStatusMapping(tTaskType, tStatus);
      if(inTaskStatus != null){
        tStatus = inTaskStatus;
        console.log('Status: ' + tStatus);
      }
      var inTaskType = null
      if(tAssigneeId != '' && tAssigneeId != null && autoAssignToTaskType != null && autoAssignToTaskType != '') {
        inTaskType = await getTaskTypeInfo(autoAssignToTaskType);
      } else {
        inTaskType = await getTaskTypeInfo('Pool');
      }
      console.log('Type --> ' + JSON.stringify(inTaskType));
      if(inTaskType != null){
        tTaskTypeId = inTaskType.Id;
        if(tEstimation == 0 && inTaskType.Value > 0){
          tEstimation = Number(inTaskType.Value);
        }
      } else {
        errMsg = 'Task [' + taskObj.TaskName + ']: Task type [' + taskObj.TaskType + '] is not exist'
        console.log(errMsg)
      }
      console.log("Type = " + tTaskType + ', Status = ' + tStatus);
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
            RespLeaderId: tRespLeaderId,
            AssigneeId: tAssigneeId,
            TaskGroupId: tTaskGroupId,
            TypeTag: taskTypeTag
        }
      })
      .spread(function(task, created) {
        if(created) {
          console.log('Task created');
          Logger.info('Task created');
        }
        else if(task != null && !created){ 
          task.update({
            ParentTaskName: tParentTaskName,
            Description: tDescription,
            Status: tStatus,
            Estimation: tEstimation,
            TaskTypeId: tTaskTypeId,
            Creator: tCreator,
            BizProject: tTaskBizProject,
            BusinessArea: tBusinessArea,
            TaskLevel: 3,
            IssueDate: tTaskIssueDate,
            RespLeaderId: tRespLeaderId,
            AssigneeId: tAssigneeId,
            TaskGroupId: tTaskGroupId
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

//Spider job to receive task list for TRLS
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
      var taskPoolRef = await getReference('TaskPool', tTaskType);
      var taskTypeTag = 'One-Off Task';
      
      Logger.info('Debug 1');
      if (taskPoolRef != null) {
        if (taskPoolRef.Value != null && taskPoolRef.Value != '') {
          tParentTaskName = taskPoolRef.Value;
        }
      }
      var tTaskBizProject = taskObj.BizProject;
      var tBusinessArea = '';
      var tTaskIssueDate = taskObj.TaskIssueDate;
      if(tTaskIssueDate == null) {
        tTaskIssueDate = dateToString(new Date());
      }
      //Get task type info
      Logger.info('Debug 2 Start');
      var inTaskStatus = await getStatusMapping(tTaskType, tStatus);
      Logger.info('Debug 2 End');
      Logger.info('Status: ' + inTaskStatus);
      if(inTaskStatus != null){
        tStatus = inTaskStatus;
      }
      Logger.info('Debug 3 Start');
      var inTaskType = await getTaskTypeInfo('Pool');
      Logger.info('Type --> ' + JSON.stringify(inTaskType));
      if(inTaskType != null){
        tTaskTypeId = inTaskType.Id;
      } else {
        errMsg = 'Task [' + taskObj.TaskName + ']: Task type [' + taskObj.TaskType + '] is not exist'
        Logger.info(errMsg)
      }
      Logger.info('Start to create/Update task');
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
            TypeTag: taskTypeTag
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
            TaskLevel: 3
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
  var taskAssignee = req.body.assigned_to;
  var taskReportedDate = req.body.created;
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
      }
      else if(taskCategorization[i].toUpperCase().startsWith("STP")){
        taskJson.TaskType = 'STP';
      }
      else {
        taskJson.TaskType = 'Incident';
      }
    }
    else {
      taskJson.TaskType = 'Sponsor Task';
    }
    //Task Assignee
    if (taskAssignee != null && taskAssignee.length > 0) {
      taskJson.TaskAssignee = taskAssignee[i];
    } else {
      taskJson.TaskAssignee = null;
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
    if(iUser == '' || iUser == null){
      resolve(null);
    }
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

function getAssignmentUser(iAssignment) {
  return new Promise((resolve, reject) => {
    User.findAll({
      where: {
        IsActive: 1,
        Role: {[Op.ne]: 'Special'}
      }
    }).then(function(users) {
      if(users != null) {
        var result = [];
        for(var i=0; i<users.length; i++) {
          var assignmentStr = users[i].Assignment;
          if(assignmentStr != '' && assignmentStr != null) {
            var assignmentArray = assignmentStr.split(',');
            for(var a=0; a<assignmentArray.length; a++) {
              if(assignmentArray[a].toUpperCase() == iAssignment){
                result.push(users[i].Id);
                break;
              }
            }
          }
        }
        resolve(result);
      } else {
        resolve([]);
      }
    });
  });
}

function getReference(iRefName, iType) {
  return new Promise((resolve, reject) => {
    Reference.findOne({
      where: {
        Name: iRefName,
        Type: iType
      }
    }).then(function(reference) {
      if(reference != null){
        resolve(reference);
      } else {
        resolve(null);
      }
    });
  });
}

function getTaskByDescriptionKeyWord(iKeyWord, iAssignmentList) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      include: [{
        model: TaskType, 
        attributes: ['Name']
      }],
      where: {
        Description: {[Op.like]: '%' + iKeyWord + '%'},
        TaskLevel: 2,
        RespLeaderId: {[Op.in]: iAssignmentList}
      }
    }).then(function(task) {
      if(task != null) {
        resolve(task);
      } else {
        resolve(null);
      }
    });
  });
}

function getTaskGroupByDateAndRelateTask(iDate, iRelatedTask) {
  return new Promise((resolve, reject) => {
    TaskGroup.findOne({
      where: {
        StartTime: { [Op.lte]: iDate },
        EndTime: { [Op.gte]: iDate },
        //RelatedTaskName: iRelatedTask
      }
    }).then(function(taskGroup) {
      resolve(taskGroup);
    });
  });
}

function stringAddZero (iValue) {
  if (iValue < 10) {
    return '0' + iValue
  } else {
    return '' + iValue
  }
}

function dateToString (iDate) {
  if (iDate !== null && iDate !== '' && iDate !== 'Invalid Date') {
    var changeDateYear = iDate.getFullYear()
    var changeDateMonth = stringAddZero(iDate.getMonth() + 1)
    var changeDateDay = stringAddZero(iDate.getDate())
    var changeDateHours = stringAddZero(iDate.getHours())
    var changeDateMinutes = stringAddZero(iDate.getMinutes())
    var changeDateSeconds = stringAddZero(iDate.getHours())
    return changeDateYear + '-' + changeDateMonth + '-' + changeDateDay + ' ' + changeDateHours + ':' + changeDateMinutes + ':' + changeDateSeconds
  } else {
    return null
  }
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
          attributes: ['TaskName', 'Reference'],
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
          if(worklogs[i].task.Reference != null && worklogs[i].task.Reference != ''){
            resJson.task_number = worklogs[i].task.Reference;
          } else {
            resJson.task_number = worklogs[i].task.TaskName;
          }
          resJson.task_type = worklogs[i].task.task_type.Category;
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
// Once rebuild all tables, please expand the table column length(table "tasks")