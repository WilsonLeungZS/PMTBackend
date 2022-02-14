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
var Customer = require('../models/customer');

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
      return res.json({result: 'Done', error: ''});
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
      taskNewObj.CustomerId = await getCustomerMapping(taskObj.taskCustomer);
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
        // Not create reference task for not running task
        if (taskNewObj.Status != 'Running') {
          needCreateRefTask = false;
          console.log('Task Status not running');
          Logger.info('Task Status not running');
        }
        // Not create reference task for problem
        if (taskObj.taskCategorization == 'Problem') {
          needCreateRefTask = false;
          console.log('Task is problem');
          Logger.info('Task is problem');
        }
        // Not create reference task for no required skills task
        if (taskNewObj.RequiredSkills == null || taskNewObj.RequiredSkills == '') {
          needCreateRefTask = false;
          console.log('Task has no required skills');
          Logger.info('Task has no required skills');
        }
        // Not create reference task for no assignee task
        if (taskObj.taskAssignee == '' || taskObj.taskAssignee == null) {
          needCreateRefTask = false;
          console.log('Task has no assignee');
          Logger.info('Task has no assignee');
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
          taskNewObj.TargetComplete = setTargetComplete(taskObj.taskPriority,taskObj.taskIssueDate)
          // Get Sprint/Leader by skills/date
          // Create reference task for every sprint if task status = 'Running'
          var refTaskIssueDate = Utils.formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss');
          var issueDateStrArray = refTaskIssueDate.split(' ');
          console.log('Task issue date -> ', issueDateStrArray[0]);
          console.log('Task required skills -> ', taskNewObj.RequiredSkills);
          var sprints = null;
          if (taskObj.taskAssignment == 'STP') {
            sprints = await Utils.getSprintsByRequiredSkills(taskNewObj.RequiredSkills, issueDateStrArray[0], 'ServiceNow', 'STP');
          } else if(taskObj.taskAssignment == 'ACN-APP-BSS'){
            sprints = await Utils.getSprintsByRequiredSkills(taskNewObj.RequiredSkills, issueDateStrArray[0], 'ServiceNow', 'SAP');
          } else {
            if (taskNewObj.RequiredSkills.indexOf('5') != -1) {
              sprints = await Utils.getSprintsByRequiredSkills(taskNewObj.RequiredSkills, issueDateStrArray[0], 'ServiceNow', 'BSS');
            }
            if (taskNewObj.RequiredSkills.indexOf('4') != -1) {
              sprints = await Utils.getSprintsByRequiredSkills(taskNewObj.RequiredSkills, issueDateStrArray[0], 'ServiceNow', 'TOS');
            }
          }
          // console.log('Sprints -> ', sprints);
          if (sprints != null && sprints.length > 0) {
            taskNewObj.SprintId = sprints[0].Id;
            taskNewObj.RespLeaderId = sprints[0].LeaderId;
          }
          console.log('Reference task sprint -> ', taskNewObj.SprintId);
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
                delete taskNewObj.Name;
                if (refTask.Status == 'Done') {
                  delete taskNewObj.Status;
                }
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


router.post('/getReport',async function (req,res,next) {
  let sql = {
    "Daily scrum status": `select pds.ScrumDate Date, pds.Attendance Attendance, pds.Completion PMT_Completion,ps.Name Sprint,pu.Name User FROM pmt.daily_scrums pds, pmt.sprints ps, pmt.users pu where 1=1 and pds.SprintId = ps.Id and pds.UserId = pu.Id and pds.ScrumDate >= '${req.body['date[0]']}' and pds.ScrumDate <= '${req.body['date[1]']}' order by pds.ScrumDate asc, ps.Name desc, pu.Name desc; `,
    "Worklog - performance": `select pu2.Name User_Name, concat(pw.WorklogMonth, '-', pw.WorklogDay) Date, pt.Name Task_Number, pt.ReferenceTask Ref_Pool, pt2.Title Ref_Pool_Description, pt.Title Task_Title, pw.Remark Worklog_Description, pw.Effort Man_hours, pt.Estimation Estimation, pt.IssueDate Issue_Date, pc.Name Customer, pu1.Name Leader_Name, pt.Type Task_type from pmt.tasks pt left join pmt.users pu1 on pt.RespLeaderId = pu1.Id left join pmt.tasks pt2 on pt.ReferenceTask = pt2.Name left join pmt.customers pc on pt.CustomerId = pc.Id, pmt.worklogs pw left join pmt.users pu2 on pw.UserId = pu2.Id, pmt.sprints ps where 1=1 and pw.TaskId = pt.Id and pt.SprintId = ps.Id and pw.WorklogMonth = '${req.body.date}' and pw.Effort > 0 order by Date asc, User_Name asc;`,
    "Task list": `select pt.Name Task_Number, pt.Customer Customer, pt.Status Status, pt.Title Task_Title, pt.ReferenceTask Ref_Pool, pu1.Name Leader, pu1.Level Leader_Level, pu2.Name Assignee, pu2.Level Assignee_Level, pt.IssueDate Issue_Date, pt.Estimation Task_Estimation, pt.Effort Actual_Effort, pt.SprintIndicator Task_Indicator, pt.TargetComplete Target_Complete_Date, pt.ActualComplete Actual_Complete_Date, ps.Name Sprint_Name, ptline.StartTime Sprint_Start_Time, ptline.EndTime Sprint_End_Time from pmt.sprints ps, pmt.timelines ptline, pmt.tasks pt left join pmt.users pu1 on pt.RespLeaderId = pu1.Id left join pmt.users pu2 on pt.AssigneeId = pu2.Id where 1=1 and pt.SprintId is not null and pt.SprintId = ps.Id and ps.TimelineId = ptline.Id and ptline.StartTime >= '${req.body['date[0]']}' and ptline.EndTime <= '${req.body['date[1]']}' and pt.Category in ('PMT-TASK-REF', 'PMT-TASK-SUB') order by Sprint_Start_Time asc, Sprint_Name asc;`,
    "Worklog - timesheet": `select pu2.Name User_Name, concat(pw.WorklogMonth, '-', pw.WorklogDay) Date, pt.Name Task_Number, pt.ReferenceTask Ref_Pool, pt2.Title Ref_Pool_Description, pt.Title Task_Title, pw.Remark Worklog_Description, pw.Effort Man_hours, pt.Estimation Estimation, pt.IssueDate Issue_Date, pt.Customer Customer, pu1.Name Leader_Name from pmt.tasks pt left join pmt.users pu1 on pt.RespLeaderId = pu1.Id left join pmt.tasks pt2 on pt.ReferenceTask = pt2.Name, pmt.worklogs pw left join pmt.users pu2 on pw.UserId = pu2.Id, pmt.sprints ps where 1=1 and pw.TaskId = pt.Id and pt.SprintId = ps.Id and pw.WorklogMonth = '${req.body.date}' and pw.Effort > 0 order by Date asc, User_Name asc;`
  }[req.body.value]
  console.log(req.body)
  console.log(sql)
  db.query(sql).then(async (result) => {
    return res.json(result[0]);
  })
})

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
      taskNewObj.CustomerId = await getCustomerMapping(taskObj.taskCustomer);
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
  var priorityArray = Request.priority;
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
    taskJson.taskPriority = priorityArray != null? priorityArray[i]: null;
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
      resolve(iStatus);
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

function getCustomerMapping (iCustomer) {
  return new Promise((resolve, reject) => {
    if(iCustomer == '' || iCustomer == null){
      resolve(null);
    }
    Customer.findOne({
      where: {
        Name: iCustomer
      }
    }).then(function(customer) {
      if (customer != null) {
        resolve(customer.Id);
      } else {
        resolve(null);
      }
    })
  });
}

// Set the target complete according to the priority
function setTargetComplete (priority,createdDate) {
 let num = priority.slice(0,1)
 return {
    1: createdDate,
    2: createdDate,
    3: format(new Date(createdDate).getTime() + 86400000 * 3,'yyyy-MM-dd hh:mm:ss'),
    4: format(new Date(createdDate).getTime() + 86400000 * 7,'yyyy-MM-dd hh:mm:ss'),
  }[num]
}

function format(timestamp, fmt) {
  //yyyy-MM-dd hh:mm:ss
  let getDate = new Date(timestamp);
  let o = {
    "M+": getDate.getMonth() + 1, // Month
    "d+": getDate.getDate(), // date
    "h+": getDate.getHours(), // hours
    "m+": getDate.getMinutes(), // minutes
    "s+": getDate.getSeconds(), // seconds
    "q+": Math.floor((getDate.getMonth() + 3) / 3), // quarter
    S: getDate.getMilliseconds() // millisecond
  };
  if (/(y+)/.test(fmt))
    fmt = fmt.replace(
      RegExp.$1,
      (getDate.getFullYear() + "").substr(4 - RegExp.$1.length)
    );
  for (let k in o)
    if (new RegExp("(" + k + ")").test(fmt))
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length)
      );
  return fmt;
}

module.exports = router;
