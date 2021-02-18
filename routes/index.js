var Sequelize = require('sequelize');
var async = require('async');
var db = require('../config/db');
var Logger  = require("../config/logConfig");
var express = require('express');
var router = express.Router();

var Task = require('../models/task');
var User = require('../models/user');
var Sprint = require('../models/sprint');
var SprintUserMap = require('../models/sprint_user_map');
var Reference = require('../models/reference');

var Utils = require('../util/utils');

const Op = Sequelize.Op;

/* GET home page. */
router.get('/', function(req, res, next) {
  Logger.info('Index log');
  Reference.findOne({where: {Name: 'Environment'}}).then(function(reference){
    if (reference != null) {
      var env = reference.Value;
      return res.json({message: 'Get Response index resource: PMT Version 3.0 - ' + env});
    } else {
      return res.json({message: 'Get Response index resource: PMT Version 3.0'});
    }
  })
});

// Sync PMT Task Effort
router.get('/syncTaskEffort', async function(req, res, next) {
  var sql = 'select TaskName, Effort, Estimation from tasks_obs where TaskName like "CG%" and ParentTaskName = "N/A" and Creator = "TRLS" and Effort != 0'
  db.query(sql).then(async (result) => {
    var obsTasks = result[0];
    for(var i=0; i<obsTasks.length; i++) {
      console.log(obsTasks[i]);
      await Task.findOne({
        where: {
          Creator: 'TRLS',
          Name: obsTasks[i].TaskName
        }
      }).then(async function(task) {
        if (task != null) {
          await task.update({Effort: obsTasks[i].Effort + task.Effort});
          console.log(task.Name + ' update Effort');
        }
      })
    }
  })
});

//External interface
//Spider job to receive task list for service now
router.post('/receiveTaskListForSNOW', async function(req, res, next) {
  Logger.info('Request: ServiceNow \n' + JSON.stringify(req.body));
  // console.log('Request: ServiceNow \n' + JSON.stringify(req.body));
  var taskCollection = processRequest(req.body);
  // console.log('Request process: \n', taskCollection);
  if (taskCollection != null && taskCollection.length > 0) {
    for (var i=0; i<taskCollection.length; i++) {
      var result = await createSNOWTask(taskCollection[i]);
      console.log('Task [' + taskCollection[i].taskName + '] result -> ', result);
      Logger.info('Task [' + taskCollection[i].taskName + '] result -> ', result);
    }
  }
  return res.json({result: true, error: ""});    
});

async function createSNOWTask(taskObj) {
  return new Promise(async (resolve, reject) => {
    console.log('Start to create task: ', taskObj);
    Logger.info('Start to create task(Service Now): ', taskObj);
    var needCreateRefTask = false;
    try {
      var errMsg = '';
      //Default task field
      var taskNewObj = {
        HasSubtask: 'N',
        Name: taskObj.taskName,
        Category: 'EXTERNAL',
        Type: 'Maintenance',
        TypeTag: 'One-Off Task',
        Title: taskObj.taskTitle,
        Description: taskObj.taskTitle,
        Customer: taskObj.taskCustomer,
        Creator: 'ServiceNow',
        IssueDate: taskObj.taskIssueDate
      }
      taskNewObj.Status = await getStatusMapping(taskObj.taskCategorization, taskObj.taskStatus);
      taskNewObj.RequiredSkills = await getGroupSkillsMapping(taskObj.taskAssignment);
      console.log('Start to create/Update task');
      Task.findOrCreate({
        where: {
          Name: taskObj.taskName
        }, 
        defaults: taskNewObj
      }).spread(async function(task, created) {
        if(created) {
          console.log('Task created');
          Logger.info('Task created');
          needCreateRefTask = true;
        }
        else if(task != null && !created){ 
          await task.update(taskNewObj);
          console.log('Task updated');
          Logger.info('Task updated');
          needCreateRefTask = true;
        } 
        else {
          console.log('Task create fail');
          errMsg = 'Task [' + taskObj.taskName + ']: create or update failed!'
          needCreateRefTask = false;
        }
        // Create reference task for running task
        if (taskNewObj.Status == 'Drafting' || taskNewObj.Status == 'Planning') {
          needCreateRefTask = false;
        }
        if (taskObj.taskCategorization == 'Problem') {
          needCreateRefTask = false;
        }
        if (taskNewObj.RequiredSkills == null || taskNewObj.RequiredSkills == '') {
          needCreateRefTask = false;
        }
        console.log('Create reference task: ' + needCreateRefTask);
        Logger.info('Create reference task: ' + needCreateRefTask);
        // Start to create ref task
        if(needCreateRefTask) {
          taskNewObj.Name = await Utils.getSubtaskName(taskObj.taskName, 'REF');
          taskNewObj.Category = 'PMT-TASK-REF';
          taskNewObj.ReferenceTask = taskObj.taskName;
          taskNewObj.TypeTag = 'One-Off Task';
          taskNewObj.SprintIndicator = 'UNPLAN';
          taskNewObj.Creator = 'PMT:System';
          taskNewObj.Estimation = 6;
          taskNewObj.AssigneeId = await getUserMapping(taskObj.taskAssignee);
          // Get Sprint/Leader
          var issueDateStrArray = taskNewObj.IssueDate.split(' ');
          console.log('Task issue date -> ', issueDateStrArray[0]);
          console.log('Task required skills -> ', taskNewObj.RequiredSkills);
          var sprints = await Utils.getSprintsByRequiredSkills(taskNewObj.RequiredSkills, issueDateStrArray[0]);
          // console.log('Sprints -> ', sprints);
          if (sprints != null && sprints.length > 0) {
            taskNewObj.SprintId = sprints[0].Id;
            taskNewObj.RespLeaderId = sprints[0].LeaderId;
          }
          console.log('Sprint -> ', taskNewObj.SprintId);
          // End
          if (taskNewObj.SprintId != null && taskNewObj.SprintId != '' && taskNewObj.SprintId != undefined) {
            await Task.findOrCreate({
              where: {
                ReferenceTask: taskNewObj.ReferenceTask,
                SprintId: taskNewObj.SprintId,
                Creator: 'PMT:System'
              },
              defaults: taskNewObj
            }).spread(async function(refTask, created) {
              if (created){
                console.log('New reference task is created!');
                Logger.info('New reference task is created!');
              } 
              else if (refTask != null && !created) {
                delete taskNewObj.Name
                await refTask.update(taskNewObj);
                console.log('Reference task is updated!');
                Logger.info('Reference task is updated!');
              }
              else {
                errMsg = 'Fail to create / update reference task'
                resolve(false);
              }
            });
          }
          resolve(true);
        }
        resolve(false);
      }); 
    } catch(exception) {
      var exMsg = 'Exception occurred: ' + exception;
      console.log(exMsg);
      Logger.info(exMsg);
      resolve(false);
    }
  });
}

//Spider job to receive task list for TRLS
router.post('/receiveTaskListForTRLS', async function(req, res, next) {
  Logger.info('Request: TRLS \n' + JSON.stringify(req.body));
  // console.log('Request TRLS \n' + JSON.stringify(req.body));
  var taskCollection = processRequest(req.body);
  // console.log('Request process: \n', taskCollection);
  if (taskCollection != null && taskCollection.length > 0) {
    for (var i=0; i<taskCollection.length; i++) {
      var result = await createTRLSTask(taskCollection[i]);
      console.log('Task [' + taskCollection[i].taskName + '] result -> ', result);
    }
  }
  return res.json({result: true, error: ""});    
});

async function createTRLSTask(taskObj) {
  return new Promise(async (resolve, reject) => {
    console.log('Start to create task: ', taskObj);
    Logger.info('Start to create task(Service Now): ', taskObj);
    try {
      var errMsg = '';
      //Default task field
      var taskNewObj = {
        HasSubtask: 'N',
        Name: taskObj.taskName,
        Category: 'EXTERNAL',
        Type: 'Development',
        TypeTag: 'One-Off Task',
        Title: taskObj.taskTitle,
        Description: taskObj.taskTitle,
        Customer: taskObj.taskCustomer,
        Creator: 'TRLS',
        IssueDate: taskObj.taskIssueDate,
        Estimation: taskObj.taskEstimation
      }
      taskNewObj.Status = await getStatusMapping(taskObj.taskCategorization, taskObj.taskStatus);
      taskNewObj.RequiredSkills = await getGroupSkillsMapping(taskObj.taskAssignment);
      console.log('Start to create/Update task');
      Task.findOrCreate({
        where: {
          Name: taskObj.taskName
        }, 
        defaults: taskNewObj
      }).spread(async function(task, created) {
        if(created) {
          console.log('Task created');
          Logger.info('Task created');
        }
        else if(task != null && !created){ 
          await task.update(taskNewObj);
          console.log('Task updated');
          Logger.info('Task updated');
        } 
        else {
          console.log('Task create fail');
          errMsg = 'Task [' + taskObj.taskName + ']: create or update failed!'
          resolve(false);
        }
        resolve(true);
      }); 
    } catch(exception) {
      var exMsg = 'Exception occurred: ' + exception;
      console.log(exMsg);
      Logger.info(exMsg);
      resolve(false);
    }
  });
}

function processRequest(Request) {
  var nameArray = Request.number;
  var titleArray = Request.short_description;
  var categorizationPathArray = Request.path;
  // var priorityArray = Request.priority;
  var statusArray = Request.state;
  var assignmentArray = Request.assignment_group;
  var assigneeArray = Request.assigned_to;
  var issueDateArray = Request.created;
  var bizProjectArray = Request.bizProject;
  var estimationArray = Request.task_effort;
  var customerArray = Request.location;
  var businessAreaArray = Request.business_area;
  var taskArray = [];
  for(var i=0; i<nameArray.length; i++){
    var taskJson = {};
    taskJson.taskName = nameArray != null? nameArray[i]: null;
    taskJson.taskTitle = titleArray != null? titleArray[i]: null;
    taskJson.taskDescription = titleArray != null? titleArray[i]: null;  
    taskJson.taskStatus = statusArray != null? statusArray[i]: null;
    taskJson.taskAssignment = assignmentArray != null? assignmentArray[i].toUpperCase(): null;
    taskJson.taskAssignee = assigneeArray != null? assigneeArray[i]: null;
    taskJson.taskIssueDate = issueDateArray != null? issueDateArray[i]: null;
    taskJson.taskBizProject = bizProjectArray != null? bizProjectArray[i]: null;
    taskJson.taskEstimation = estimationArray != null? estimationArray[i] != ''? Number(estimationArray[i]) * 8: 0: 0;
    taskJson.taskBusinessArea = businessAreaArray != null? businessAreaArray[i]: null;
    taskJson.taskCustomer = customerArray != null? customerArray[i]: null;
    if (taskJson.taskCustomer == 'MTL HK') {
      taskJson.taskCustomer = 'MTL'
    }
    if (taskJson.taskCustomer == 'MTL DCB') {
      taskJson.taskCustomer = 'DCB'
    }
    //Task Categorization Validation
    var taskCategorizationPath = categorizationPathArray != null? categorizationPathArray[i]: null;
    console.log('taskCategorizationPath -> ', taskCategorizationPath);
    var taskCategorization = '';
    if(taskJson.taskName.toUpperCase().startsWith('CG')){
      taskCategorization = 'Change';
    }
    else if(taskJson.taskName.toUpperCase().startsWith('PRB')){
      taskCategorization = 'Problem';
    }
    else if(taskJson.taskName.toUpperCase().startsWith('INCTASK')){
      taskCategorization = 'ITSR';
    }
    else if(taskCategorizationPath != null && taskCategorizationPath != undefined && taskCategorizationPath != ''){
      if(taskCategorizationPath.toUpperCase().startsWith("SERVICE")){
        taskCategorization = 'Service Request';
      }
      else if(taskCategorizationPath.toUpperCase().startsWith("STP")){
        taskCategorization = 'STP';
      }
      else {
        taskCategorization = 'Incident';
      }
    }
    else {
      taskCategorization = 'Task';
    }
    //End of Task Categorization Validation
    taskJson.taskCategorization = taskCategorization;
    taskArray.push(taskJson);
  }
  //console.log('Result ', taskArray);
  return taskArray;
}

function getStatusMapping(iTaskCategorization, iStatus) {
  return new Promise((resolve, reject) => {
    Reference.findOne({
      where: {
        Name: 'TaskTypeMapping',
        Type: iTaskCategorization
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

function getGroupSkillsMapping (iGroup) {
  return new Promise((resolve, reject) => {
    Reference.findOne({
      where: {
        Name: 'GroupSkillsMapping'
    }}).then(function(reference) {
      if(reference != null){
        var groupSkillsMapping = reference.Value;
        var groupSkillsMappingJson = JSON.parse(groupSkillsMapping);
        for(var i=0;i<groupSkillsMappingJson.length; i++){
          var mappingGroup = groupSkillsMappingJson[i].Group;
          if(mappingGroup == iGroup){
            resolve(groupSkillsMappingJson[i].Skills); 
          }
        }//End of find group skills mapping
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
          if(user[i].NameMappings != null){
            var userMappingArray = user[i].NameMappings.split(';');
            if(Utils.getIndexOfValueInArr(userMappingArray, null, iUser) != -1){
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

function getTaskGroupByDateAndRelateTask(iDate, iTimeType) {
  return new Promise((resolve, reject) => {
    TaskGroup.findOne({
      where: {
        StartTime: { [Op.lte]: iDate },
        EndTime: { [Op.gte]: iDate },
        GroupType: iTimeType
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



module.exports = router;

// Install dependencies: cnpm install
// Start server: set DEBUG=PMTBackend & cnpm start
//提交代码到Github： 1.暂存文件； 2.提交已暂存的文件(add comment); 3.推送
//同步代码：pull rebase（合并）
// Once rebuild all tables, please expand the table column length(table "tasks")