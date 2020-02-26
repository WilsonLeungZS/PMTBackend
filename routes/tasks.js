var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var TaskType = require('../model/task/task_type');
var Task = require('../model/task/task');
var Team = require('../model/team/team');
var Reference = require('../model/reference');
var User = require('../model/user');
var TaskGroup = require('../model/task/task_group');
var Worklog = require('../model/worklog');

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

router.post('/getTaskByCompletedName', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
      include: [{
        model: TaskType, 
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
            resJson.task_level = task[i].TaskLevel;
            resJson.task_type = task[i].task_type.Name;
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

//Task list for web PMT
router.get('/getTaskList', function(req, res, next) {
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  var reqFilterIssueDateStart = null
  var reqFilterIssueDateEnd = null
  var reqTaskLevel = Number(req.query.reqTaskLevel);
  var criteria = {
    TaskName: {[Op.notLike]: 'Dummy - %'},
    TaskLevel: reqTaskLevel,
    Id: { [Op.ne]: null }
  }
  if (req.query.reqTaskGroupId != null && req.query.reqTaskGroupId != '') {
    criteria.TaskGroupId = Number(req.query.reqTaskGroupId)
  }
  if (req.query.reqFilterAssignee != null && req.query.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(req.query.reqFilterAssignee)
  }
  if (req.query.reqFilterStatus != null && req.query.reqFilterStatus != '') {
    criteria.Status = req.query.reqFilterStatus
  }
  if (req.query.reqFilterIssueDateStart != null && req.query.reqFilterIssueDateStart != '') {
    reqFilterIssueDateStart = req.query.reqFilterIssueDateStart + ' 00:00:00'
  }
  if (req.query.reqFilterIssueDateEnd != null && req.query.reqFilterIssueDateEnd != '') {
    reqFilterIssueDateEnd = req.query.reqFilterIssueDateEnd + ' 23:59:59'
  }
  if (reqFilterIssueDateStart != null && reqFilterIssueDateEnd != null) {
    var issueDateCriteria = {
      [Op.and]: [
        { IssueDate: { [Op.gte]:  reqFilterIssueDateStart }},
        { IssueDate: { [Op.lte]:  reqFilterIssueDateEnd }}
      ]
    }
    var c = Object.assign(criteria, issueDateCriteria);
    console.log(c);
  }
  var taskTypeCriteria = {}
  if (req.query.reqFilterShowRefPool != null && req.query.reqFilterShowRefPool != '') {
    if (req.query.reqFilterShowRefPool == 'true') {
      taskTypeCriteria = {
        Name: 'Pool'
      }
    } else {
      taskTypeCriteria = {
        Name: { [Op.ne]: 'Pool' }
      }
    }
  } else {
    taskTypeCriteria = {
      Name: { [Op.ne]: 'Pool' }
    }
  }
  var rtnResult = [];
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: taskTypeCriteria
    }],
    where: criteria,
    order: [
      ['createdAt', 'DESC']
    ],
    limit: reqSize,
    offset: reqSize * (reqPage - 1),
  }).then(async function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_parenttaskname = task[i].ParentTaskName;
        resJson.task_name = task[i].TaskName;
        resJson.task_type = task[i].task_type.Name;
        resJson.task_level = task[i].TaskLevel;
        resJson.task_desc = task[i].Description;
        resJson.task_status = task[i].Status;
        resJson.task_effort = task[i].Effort;
        resJson.task_estimation = task[i].Estimation;
        resJson.task_created = task[i].createdAt;
        var assigneeId = task[i].AssigneeId;
        if (assigneeId != null && assigneeId != '') {
          var assigneeName = await getUserById(assigneeId);
          resJson.task_assignee = assigneeName;
        } else {
          resJson.task_assignee = null;
        }
        resJson.task_issue_date = task[i].IssueDate;
        resJson.task_target_complete = task[i].TargetCompleteDate;
        resJson.task_scope = task[i].Scope;
        resJson.task_reference = task[i].Reference;
        resJson.task_top_opp_name = task[i].TopOppName;
        resJson.task_top_customer = task[i].TopCustomer;
        var targetStartTime = null;
        if(task[i].TopTargetStart != null && task[i].TopTargetStart != ''){
          var startTime = new Date(task[i].TopTargetStart);
          targetStartTime = startTime.getFullYear() + '-' + ((startTime.getMonth() + 1) < 10 ? '0' + (startTime.getMonth() + 1) : (startTime.getMonth() + 1));
        }
        resJson.task_top_target_start = targetStartTime;
        resJson.task_top_type_of_work = task[i].TopTypeOfWork;
        resJson.task_top_team_sizing = task[i].TopTeamSizing;
        var respLeaderId = task[i].RespLeaderId;
        if (respLeaderId != null && respLeaderId != '') {
          var respLeaderName = await getUserById(respLeaderId);
          resJson.task_top_resp_leader = respLeaderName;
        } else {
          resJson.task_top_resp_leader = null;
        }
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

function getUserById(iUserId) {
  return new Promise((resolve, reject) => {
    User.findOne({
      where: {
        Id: iUserId
      }
    }).then(function(user) {
      if(user != null) {
        resolve(user.Name)
      } else {
        resolve(null);
      }
    });
  });
}

//Get Total Task Size for web PMT
router.get('/getTotalTaskSize', function(req, res, next) {
  var rtnResult = [];
  var reqFilterIssueDateStart = null
  var reqFilterIssueDateEnd = null
  var reqTaskLevel = Number(req.query.reqTaskLevel);
  var criteria = {
    TaskName: {[Op.notLike]: 'Dummy - %'},
    TaskLevel: reqTaskLevel,
    Id: { [Op.ne]: null }
  }
  if (req.query.reqTaskGroupId != null && req.query.reqTaskGroupId != '') {
    criteria.TaskGroupId = Number(req.query.reqTaskGroupId)
  }
  if (req.query.reqFilterAssignee != null && req.query.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(req.query.reqFilterAssignee)
  }
  if (req.query.reqFilterStatus != null && req.query.reqFilterStatus != '') {
    criteria.Status = req.query.reqFilterStatus
  }
  if (req.query.reqFilterIssueDateStart != null && req.query.reqFilterIssueDateStart != '') {
    reqFilterIssueDateStart = req.query.reqFilterIssueDateStart + ' 00:00:00'
  }
  if (req.query.reqFilterIssueDateEnd != null && req.query.reqFilterIssueDateEnd != '') {
    reqFilterIssueDateEnd = req.query.reqFilterIssueDateEnd + ' 00:00:00'
  }
  if (reqFilterIssueDateStart != null && reqFilterIssueDateEnd != null) {
    var issueDateCriteria = {
      [Op.and]: [
        { IssueDate: { [Op.gte]:  reqFilterIssueDateStart }},
        { IssueDate: { [Op.lte]:  reqFilterIssueDateEnd }}
      ]
    }
    var c = Object.assign(criteria, issueDateCriteria);
    console.log(c);
  }
  var taskTypeCriteria = {}
  if (req.query.reqFilterShowRefPool != null && req.query.reqFilterShowRefPool != '') {
    if (req.query.reqFilterShowRefPool == 'true') {
      taskTypeCriteria = {
        Name: 'Pool'
      }
    } else {
      taskTypeCriteria = {
        Name: { [Op.ne]: 'Pool' }
      }
    }
  } else {
    taskTypeCriteria = {
      Name: { [Op.ne]: 'Pool' }
    }
  }
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: taskTypeCriteria
    }],
    where: criteria,
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

// To search task
router.post('/getTaskByName', function(req, res, next) {
  var rtnResult = [];
  var taskKeyWord = req.body.tTaskName.trim();
  var criteria = {};
  if( req.body.tTaskTypeId == null || req.body.tTaskTypeId == '' || req.body.tTaskTypeId === '0'){
    criteria = {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: Number(req.body.tTaskLevel)
    }
  }
  else {
    criteria = {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      TaskTypeId: Number(req.body.tTaskTypeId),
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: Number(req.body.tTaskLevel)
    }
  }
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: criteria,
    limit:100,
    order: [
      ['updatedAt', 'DESC']
    ]
  }).then(async function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_parenttaskname = task[i].ParentTaskName;
            resJson.task_name = task[i].TaskName;
            resJson.task_level = task[i].TaskLevel;
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
            resJson.task_created = task[i].createdAt;
            var assigneeId = task[i].AssigneeId;
            if (assigneeId != null && assigneeId != '') {
              var assigneeName = await getUserById(assigneeId);
              resJson.task_assignee = assigneeName;
            } else {
              resJson.task_assignee = null;
            }
            resJson.task_issue_date = task[i].IssueDate;
            resJson.task_target_complete = task[i].TargetCompleteDate;
            resJson.task_scope = task[i].Scope;
            resJson.task_reference = task[i].Reference;
            resJson.task_top_opp_name = task[i].TopOppName;
            resJson.task_top_customer = task[i].TopCustomer;
            var targetStartTime = null;
            if(task[i].TopTargetStart != null && task[i].TopTargetStart != ''){
              var startTime = new Date(task[i].TopTargetStart);
              targetStartTime = startTime.getFullYear() + '-' + ((startTime.getMonth() + 1) < 10 ? '0' + (startTime.getMonth() + 1) : (startTime.getMonth() + 1));
            }
            resJson.task_top_target_start = targetStartTime;
            var targetEndTime = null;
            if(task[i].TopTargetEnd != null && task[i].TopTargetStart != ''){
              var endTime = new Date(task[i].TopTargetEnd);
              targetEndTime = endTime.getFullYear() + '-' + ((endTime.getMonth() + 1) < 10 ? '0' + (endTime.getMonth() + 1) : (endTime.getMonth() + 1));
            }
            resJson.task_top_target_end = targetEndTime;
            resJson.task_top_type_of_work = task[i].TopTypeOfWork;
            resJson.task_top_team_sizing = task[i].TopTeamSizing;
            var respLeaderId = task[i].RespLeaderId;
            if (respLeaderId != null && respLeaderId != '') {
              var respLeaderName = await getUserById(respLeaderId);
              resJson.task_top_resp_leader = respLeaderName;
            } else {
              resJson.task_top_resp_leader = null;
            }
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
      } else {
          return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

router.post('/getTaskByNameForWorklogTask', function(req, res, next) {
  var rtnResult = [];
  var taskKeyWord = req.body.tTaskName.trim();
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: {
        Name: { [Op.ne]: 'Pool' }
      }
    }],
    where: {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      [Op.and]: [
        { TaskLevel: {[Op.ne]: 1}},
        { TaskLevel: {[Op.ne]: 2}}
      ],
      Id: { [Op.ne]: null }
    },
    limit:100,
    order: [
      ['updatedAt', 'DESC']
    ]
  }).then(async function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var existSubTask = await getSubTaskExist(task[i].TaskName);
        if(existSubTask){
          continue;
        }
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_desc = task[i].Description;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

function getSubTaskExist (iParentTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iParentTaskName 
      }
    }).then(function(task) {
      if(task != null && task.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

router.post('/getTaskByNameForReference', function(req, res, next) {
  var rtnResult = [];
  var taskKeyWord = req.body.tTaskName.trim();
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: {
        Name: 'Pool'
      }
    }],
    where: {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      [Op.and]: [
        { TaskLevel: {[Op.ne]: 1}},
        { TaskLevel: {[Op.ne]: 2}}
      ],
      Id: { [Op.ne]: null }
    },
    limit:100,
    order: [
      ['updatedAt', 'DESC']
    ]
  }).then(async function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_desc = task[i].Description;
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
      where: {
        Id: req.body.tId 
      }
  }).then(async function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_parenttaskname = task[i].ParentTaskName;
            resJson.task_parenttaskdesc = await getTaskDescription(task[i].ParentTaskName);
            resJson.task_name = task[i].TaskName;
            resJson.task_level = task[i].TaskLevel;
            resJson.task_creator = task[i].Creator;
            resJson.task_type = task[i].TaskTypeId;
            resJson.task_type_id = task[i].TaskTypeId;
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
            resJson.task_subtasks_totaleffort = await getSubTaskTotalEstimation(task[i].TaskName);
            resJson.task_issue_date = task[i].IssueDate;
            resJson.task_target_complete = task[i].TargetCompleteDate;
            resJson.task_actual_complete = task[i].ActualCompleteDate;
            resJson.task_responsible_leader = task[i].RespLeaderId;
            resJson.task_assignee = task[i].AssigneeId;
            resJson.task_reference = task[i].Reference;
            resJson.task_referencetaskdesc = await getTaskDescription(task[i].Reference);
            resJson.task_scope = task[i].Scope;
            resJson.task_group_id = task[i].TaskGroupId;
            resJson.task_top_constraint = task[i].TopConstraint;
            resJson.task_top_opp_name = task[i].TopOppName;
            resJson.task_top_customer = task[i].TopCustomer;
            resJson.task_top_facing_client = task[i].TopFacingClient;
            resJson.task_top_type_of_work = task[i].TopTypeOfWork;
            resJson.task_top_chance_winning = task[i].TopChanceWinning;
            resJson.task_top_sow_confirmation = task[i].TopSowConfirmation;
            resJson.task_top_business_value = task[i].TopBusinessValue;
            resJson.task_top_target_start = task[i].TopTargetStart;
            resJson.task_top_target_end = task[i].TopTargetEnd;
            resJson.task_top_paint_points = task[i].TopPaintPoints;
            resJson.task_top_team_sizing = task[i].TopTeamSizing;
            resJson.task_top_skill = task[i].TopSkill;
            resJson.task_top_opps_project = task[i].TopOppsProject;
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
      } else {
          return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

router.post('/getTaskByParentTask', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
      where: {
        TaskName: req.body.tParentTask 
      }
  }).then(async function(task) {
      if(task.length > 0) {
          for(var i=0;i<task.length;i++){
            var resJson = {};
            resJson.task_id = task[i].Id;
            resJson.task_parenttaskname = task[i].ParentTaskName;
            resJson.task_parenttaskdesc = await getTaskDescription(task[i].ParentTaskName);
            resJson.task_name = task[i].TaskName;
            resJson.task_level = task[i].TaskLevel;
            resJson.task_creator = task[i].Creator;
            resJson.task_type = task[i].TaskTypeId;
            resJson.task_type_id = task[i].TaskTypeId;
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
            resJson.task_subtasks_totaleffort = await getSubTaskTotalEstimation(task[i].TaskName);
            resJson.task_issue_date = task[i].IssueDate;
            resJson.task_target_complete = task[i].TargetCompleteDate;
            resJson.task_actual_complete = task[i].ActualCompleteDate;
            resJson.task_responsible_leader = task[i].RespLeaderId;
            resJson.task_assignee = task[i].AssigneeId;
            resJson.task_reference = task[i].Reference;
            resJson.task_referencetaskdesc = await getTaskDescription(task[i].Reference);
            resJson.task_scope = task[i].Scope;
            resJson.task_group_id = task[i].TaskGroupId;
            resJson.task_top_constraint = task[i].TopConstraint;
            resJson.task_top_opp_name = task[i].TopOppName;
            resJson.task_top_customer = task[i].TopCustomer;
            resJson.task_top_facing_client = task[i].TopFacingClient;
            resJson.task_top_type_of_work = task[i].TopTypeOfWork;
            resJson.task_top_chance_winning = task[i].TopChanceWinning;
            resJson.task_top_sow_confirmation = task[i].TopSowConfirmation;
            resJson.task_top_business_value = task[i].TopBusinessValue;
            resJson.task_top_target_start = task[i].TopTargetStart;
            resJson.task_top_target_end = task[i].TopTargetEnd;
            resJson.task_top_paint_points = task[i].TopPaintPoints;
            resJson.task_top_team_sizing = task[i].TopTeamSizing;
            resJson.task_top_skill = task[i].TopSkill;
            resJson.task_top_opps_project = task[i].TopOppsProject;
            rtnResult.push(resJson);
          }
          return res.json(responseMessage(0, rtnResult, ''));
      } else {
          return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

function getSubTaskTotalEstimation(iTaskName) {
  return new Promise((resolve, reject) => {
    console.log(iTaskName)
    Task.findAll({
      where: {
        ParentTaskName: iTaskName 
      }
    }).then(async function(task) {
      if(task != null && task.length > 0) {
        var rtnTotalEstimation = 0
        for(var i=0; i< task.length; i++){
          var subTaskCount = await getSubTaskCount(task[i].TaskName);
          var subTaskEstimation = 0;
          if(subTaskCount != null && subTaskCount > 0){
            subTaskEstimation = await getSubTaskTotalEstimation(task[i].TaskName);
            rtnTotalEstimation = rtnTotalEstimation + Number(subTaskEstimation);
          } else {
            if(task[i].Estimation != null && task[i].Estimation != ''){
              rtnTotalEstimation = rtnTotalEstimation + Number(task[i].Estimation);
            }
          }
        }
        resolve(rtnTotalEstimation);
      } else {
        resolve(0);
      }
    });
  })
}

function getTaskDescription(iTaskname) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {
        TaskName: iTaskname 
      }
    }).then(function(task) {
      if (task != null) {
        if(task.TaskLevel == 1) {
          resolve(task.TopOppName);
        } else {
          resolve(task.Description);
        }
      } else {
        resolve(null);
      }
    });
  });
}

router.post('/getSubTaskByParentTaskName', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
    attributes: ['Id', 'TaskName', 'Description'],
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
          resJson.task_id = task[i].Id;
          resJson.task_name = task[i].TaskName;
          resJson.task_desc = task[i].Description;
          rtnResult.push(resJson);
        }
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'No sub task exist'));
      }
  })
});

//Plan Task for web
router.post('/getSubTaskByParentTaskAndGroup', function(req, res, next) {
  var rtnResult = [];
  console.log(JSON.stringify(req.body))
  var reqParentTaskName = req.body.tParentTaskName;
  var reqTaskGroupId = Number(req.body.tGroupId);
  Task.findAll({
    where: {
      ParentTaskName: reqParentTaskName,
      TaskGroupId: reqTaskGroupId,
      TaskLevel: 2
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(task) {
      if(task != null && task.length > 0) {
        for(var i=0;i<task.length;i++){
          var resJson = {};
          resJson.task_id = task[i].Id;
          resJson.task_name = task[i].TaskName;
          resJson.task_desc = task[i].Description;
          resJson.task_currenteffort = task[i].Effort;
          resJson.task_totaleffort =  task[i].Estimation;
          resJson.task_subtasks_totaleffort = await getSubTaskTotalEstimation(task[i].TaskName);
          resJson.task_group_id = task[i].TaskGroupId;
          resJson.task_type_id = task[i].TaskTypeId;
          resJson.task_responsible_leader = task[i].RespLeaderId;
          var taskSubtasks = [];
          var subTaskArray = await getSubTasks(task[i].TaskName);
          if(subTaskArray != null) {
            for(var a=0; a<subTaskArray.length; a++) {
              var resJsonSub = {};
              resJsonSub.task_id = subTaskArray[a].Id;
              resJsonSub.sub_task_name = subTaskArray[a].TaskName;
              resJsonSub.sub_task_desc = subTaskArray[a].Description;
              var subTaskCount = await getSubTaskCount(subTaskArray[a].TaskName)
              if (subTaskCount != null && subTaskCount > 0) {
                resJsonSub.sub_task_totaleffort = 'Estimation: ' + await getSubTaskTotalEstimation(subTaskArray[a].TaskName);
              } else {
                resJsonSub.sub_task_totaleffort = 'Estimation: ' + subTaskArray[a].Estimation;
              }
              taskSubtasks.push(resJsonSub);
            }
          }
          resJson.task_subtasks = taskSubtasks;
          rtnResult.push(resJson);
        }
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'No sub task exist'));
      }
  })
});

router.post('/addOrUpdateTask', function(req, res, next) {
  console.log(req.body)
  addOrUpdateTask(req, res);
});

async function addOrUpdateTask(req, res) {
  var reqTaskName = req.body.tName;
  var reqTaskParent = req.body.tParent;
  if((reqTaskName == null || reqTaskName == '') && reqTaskParent != 'N/A'){
    reqTaskName = await getSubTaskName(reqTaskParent);
  }
  Task.findOrCreate({
      where: { TaskName: req.body.tName }, 
      defaults: {
        ParentTaskName: reqTaskParent,
        TaskName: reqTaskName,
        TaskLevel: Number(req.body.tLevel),
        Description: req.body.tDescription,
        TaskTypeId: Number(req.body.tTaskTypeId),
        Status: req.body.tStatus,
        Creator: req.body.tCreator,
        Effort: Number(req.body.tEffort),
        Estimation: Number(req.body.tEstimation),
        IssueDate: req.body.tIssueDate,
        TargetCompleteDate: req.body.tTargetComplete,
        ActualCompleteDate: req.body.tActualComplete,
        RespLeaderId: req.body.tRespLeader != '' ? req.body.tRespLeader : null,
        AssigneeId: req.body.tAssignee != '' ? req.body.tAssignee : null,
        Reference: req.body.tReference,
        Scope: req.body.tScope,
        TaskGroupId: req.body.tGroupId != '' ? req.body.tGroupId : null
      }})
    .spread(async function(task, created) {
      if(created) {
        console.log("Task created"); 
        return res.json(responseMessage(0, task, 'Task Created'));
      } else {
        console.log("Task existed");
        Task.update({
            ParentTaskName: req.body.tParent,
            TaskName: req.body.tName,
            TaskLevel: Number(req.body.tLevel),
            Description: req.body.tDescription,
            TaskTypeId: Number(req.body.tTaskTypeId),
            Status: req.body.tStatus,
            Effort: Number(req.body.tEffort),
            Estimation: Number(req.body.tEstimation),
            IssueDate: req.body.tIssueDate,
            TargetCompleteDate: req.body.tTargetComplete,
            ActualCompleteDate: req.body.tActualComplete,
            RespLeaderId: req.body.tRespLeader != '' ? req.body.tRespLeader : null,
            AssigneeId: req.body.tAssignee != '' ? req.body.tAssignee : null,
            Reference: req.body.tReference,
            Scope: req.body.tScope,
            TaskGroupId: req.body.tGroupId != '' ? req.body.tGroupId : null
          },
          {where: {TaskName: req.body.tName}}
        );
        //Update sub-tasks task group
        if (Number(req.body.tLevel) == 2) {
          var updateResult = 1;
          var subTasks = await getSubTasks(req.body.tName);
          if(subTasks != null) {
            updateResult = await updateSubTasksGroup(req.body.tName, req.body.tGroupId);
            if (updateResult == 0) {
              if(subTasks.length > 0) {
                for(var i = 0; i < subTasks.length; i++) {
                  var subTasks1 = await getSubTasks(subTasks[i].TaskName);
                  if(subTasks1 != null) {
                    updateResult = await updateSubTasksGroup(subTasks[i].TaskName, req.body.tGroupId);
                  }
                }
              }
            }
          }
        } // End of update sub-tasks task group
        //Update sub-tasks responsilbe leader
        if (Number(req.body.tLevel) == 2) {
          var updateResult = 1;
          var subTasks = await getSubTasks(req.body.tName);
          if(subTasks != null) {
            updateResult = await updateSubTasksRespLeader(req.body.tName, req.body.tRespLeader);
            if (updateResult == 0) {
              if(subTasks.length > 0) {
                for(var i = 0; i < subTasks.length; i++) {
                  var subTasks1 = await getSubTasks(subTasks[i].TaskName);
                  if(subTasks1 != null) {
                    updateResult = await updateSubTasksRespLeader(subTasks[i].TaskName, req.body.tRespLeader);
                  }
                }
              }
            }
          }
        } // End of update sub-tasks task group
        return res.json(responseMessage(1, task, 'Task existed'));
      }
  });
}

function updateSubTasksGroup (iTaskName, iGroupId) {
  return new Promise((resolve, reject) => {
    Task.update({
        TaskGroupId: iGroupId != '' ? iGroupId : null
      },
      {where: {ParentTaskName: iTaskName}
    });
    resolve(0);
  });
}

function updateSubTasksRespLeader (iTaskName, iRespLeaderId) {
  return new Promise((resolve, reject) => {
    Task.update({
      RespLeaderId: iRespLeaderId != '' ? iRespLeaderId : null
      },
      {where: {ParentTaskName: iTaskName}
    });
    resolve(0);
  });
}

function getSubTasks (iTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iTaskName
      }
    }).then(function(task) {
      if(task != null && task.length > 0){
        resolve(task);
      } else {
        resolve(null)
      }
    })
  });
}

router.post('/addOrUpdateTaskTop', function(req, res, next) {
  console.log(req.body)
  addOrUpdateTaskTop(req, res);
});

async function addOrUpdateTaskTop(req, res) {
  Task.findOrCreate({
      where: { TaskName: req.body.tTopName }, 
      defaults: {
        ParentTaskName: 'N/A',
        TaskName: req.body.tTopName,
        TaskLevel: Number(req.body.tTopLevel),
        TaskTypeId: Number(req.body.tTopTaskTypeId),
        Status: req.body.tTopStatus,
        TopConstraint: req.body.tTopConstraint,
        TopOppName: req.body.tTopOppName,
        TopCustomer: req.body.tTopCustomer,
        TopFacingClient: req.body.tTopFacingClient,
        TopTypeOfWork: req.body.tTopTypeOfWork,
        TopChanceWinning: req.body.tTopChanceWinning,
        TopBusinessValue: req.body.tTopBusinessValue,
        TopSowConfirmation: req.body.tTopSowConfirmation,
        TopTargetStart: req.body.tTopTargetStart,
        TopTargetEnd: req.body.tTopTargetEnd,
        TopPaintPoints: req.body.tTopPaintPoints,
        TopTeamSizing: req.body.tTopTeamSizing,
        TopSkill: req.body.tTopSkill,
        TopOppsProject: req.body.tTopOppsProject,
        RespLeaderId: req.body.tTopRespLeader != '' ? req.body.tTopRespLeader : null,
        Creator: req.body.tCreator,
        IssueDate: req.body.tIssueDate
      }})
    .spread(function(task, created) {
      if(created) {
        console.log("Task created"); 
        return res.json(responseMessage(0, task, 'Task Created'));
      } else {
        console.log("Task existed");
        Task.update({
            ParentTaskName: 'N/A',
            TaskName: req.body.tTopName,
            TaskLevel: Number(req.body.tTopLevel),
            TaskTypeId: Number(req.body.tTopTaskTypeId),
            Status: req.body.tTopStatus,
            TopConstraint: req.body.tTopConstraint,
            TopOppName: req.body.tTopOppName,
            TopCustomer: req.body.tTopCustomer,
            TopFacingClient: req.body.tTopFacingClient,
            TopTypeOfWork: req.body.tTopTypeOfWork,
            TopChanceWinning: req.body.tTopChanceWinning,
            TopBusinessValue: req.body.tTopBusinessValue,
            TopSowConfirmation: req.body.tTopSowConfirmation,
            TopTargetStart: req.body.tTopTargetStart,
            TopTargetEnd: req.body.tTopTargetEnd,
            TopPaintPoints: req.body.tTopPaintPoints,
            TopTeamSizing: req.body.tTopTeamSizing,
            TopSkill: req.body.tTopSkill,
            TopOppsProject: req.body.tTopOppsProject,
            RespLeaderId: req.body.tTopRespLeader != '' ? req.body.tTopRespLeader : null,
            IssueDate: req.body.tIssueDate
          },
          {where: {TaskName: req.body.tTopName}}
        );
        return res.json(responseMessage(1, task, 'Task existed and updated'));
      }
  });
}

async function getSubTaskName(iParentTask) {
  var subTaskCount = await getSubTaskCount(iParentTask);
  subTaskCount = Number(subTaskCount) + 1;
  var taskName = iParentTask + '-' + subTaskCount;
  return taskName;
}

function getSubTaskCount(iParentTask) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iParentTask
      }
    }).then(function(task) {
      if(task != null) {
        console.log('Task length: ' + task.length);
        resolve(task.length);
      } else {
        resolve(0);
      }
    });
  });
}

router.post('/removeTaskIfNoSubTaskAndWorklog', async function(req, res, next) {
  console.log(JSON.stringify(req.body))
  var reqTaskId = req.body.tTaskId;
  var reqTaskName = req.body.tTaskName;
  var reqUpdateDate = req.body.tUpdateDate;
  var subTaskCount = await getSubTaskCount(reqTaskName);
  if(subTaskCount == 0) {
    var worklogExist = await checkWorklogExist(reqTaskId, reqUpdateDate);
    if(!worklogExist) {
      console.log('No worklog exist, can remove outdate worklog and task safely!');
      //Remove worklog of this task
      var result1 = false; 
      var result12 = false;
      result1 = await removeWorklogBefore3Days(reqTaskId, reqUpdateDate);
      if(result1) {
        console.log('Remove worklog done');
      }
      result2 = await removeTask(reqTaskId);
      if(result2){
        console.log('Remove task done');
      }
      return res.json(responseMessage(0, null, 'Task removed successfully!'));
    } else {
      return res.json(responseMessage(1, null, 'Task existed worklog updated records within 3 days, could not be removed!'));
    } 
  } else {
    return res.json(responseMessage(1, null, 'Task existed sub tasks, could not be removed!'));
  }
});

function checkWorklogExist (iTaskId, iUpdateDate) {
  return new Promise(async (resolve, reject) => {
    Worklog.findAll({
      where: {
        [Op.or]: [
          {
            TaskId: iTaskId,
            Effort: { [Op.ne]: 0}
          },
          {
            TaskId: iTaskId,
            Effort: 0,
            updatedAt: { [Op.gt]: iUpdateDate}
          }
        ]
      }
    }).then(function(worklog) {
      if(worklog != null && worklog.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function removeWorklogBefore3Days(iTaskId, iUpdateDate) {
  return new Promise((resolve, reject) => {
    Worklog.findAll({
      where: {
        TaskId: iTaskId,
        Effort: 0,
        updatedAt: { [Op.lt]: iUpdateDate}
      }
    }).then(function(worklog) {
      if(worklog != null) {
        Worklog.destroy({
          where: {
            TaskId: iTaskId,
            Effort: 0,
            updatedAt: { [Op.lt]: iUpdateDate}
          }
        }).then(function(){
          resolve(true)
        });
      } else {
        resolve(false)
      }
    });
  });
}

function removeTask(iTaskId) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {
        Id: iTaskId
      }
    }).then(function(task) {
      if(task != null) {
        task.destroy().then(function(){
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

//Task Type
router.get('/getAllTaskType', function(req, res, next) {
  var rtnResult = [];
  TaskType.findAll().then(function(taskType) {
    if(taskType.length > 0) {
      for(var i=0;i<taskType.length;i++){
        var resJson = {};
        resJson.type_id = taskType[i].Id;
        resJson.type_name = taskType[i].Name;
        resJson.type_prefix = taskType[i].Prefix;
        resJson.type_category = taskType[i].Category;
        resJson.type_value = taskType[i].Value;
        resJson.type_parent = taskType[i].ParentType;
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
      ParentType: req.body.taskTypeParent,
      Name: req.body.taskTypeName,
      Prefix: req.body.taskTypePrefix,
      Category: req.body.taskTypeCategory,
      Value: req.body.taskTypeValue
    }})
  .spread(function(taskType, created) {
    if(created) {
      return res.json(responseMessage(0, taskType, 'Created task type successfully!'));
    } 
    else if(taskType != null && !created) {
      var oldPrefix = taskType.Prefix;
      var newPrefix = req.body.taskTypePrefix
      if(oldPrefix !== newPrefix) {
        console.log('Old Prefix['+oldPrefix+'] New Prefix['+newPrefix+']');
      }
      taskType.update({
        ParentType: req.body.taskTypeParent,
        Name: req.body.taskTypeName,
        Prefix: req.body.taskTypePrefix,
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

router.post('/getNewTaskNumberByType', function(req, res, next) {
  var reqTaskTypeId = req.body.tTaskTypeId;
  TaskType.findOne({
    where: {Id: reqTaskTypeId}
  }).then(function(taskType) {
    if(taskType != null && taskType.Prefix != '') {
      Reference.findOne({where: {Name: 'TaskSeq'}}).then(function(reference) {
        if (reference != null) {
          var newTaskNumber = Number(reference.Value) + 1;
          var newTask = '' + taskType.Prefix + prefixZero(newTaskNumber, 6);
          return res.json(responseMessage(0, {task_name: newTask}, 'Get new task number successfully!'));
        } else {
          return res.json(responseMessage(1, null, 'Get new task number failed'));
        }
      });
    } else {
      return res.json(responseMessage(1, null, 'Get new task number failed'));
    }
  })
});

//Task Group
router.get('/getTaskGroup', function(req, res, next) {
  var rtnResult = [];
  var groupCriteria = {}
  if( req.query.tGroupId != "0"){
    groupCriteria = { 
      Id: req.query.tGroupId,
      RelatedTaskName: req.query.tGroupRelatedTask
    };
  } else {
    groupCriteria = { 
      Id: { [Op.ne]: null },
      RelatedTaskName: req.query.tGroupRelatedTask
    };
  }
  TaskGroup.findAll({
    where: groupCriteria,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(taskGroup) {
    if(taskGroup.length > 0) {
      for(var i=0;i<taskGroup.length;i++){
        var resJson = {};
        resJson.group_id = taskGroup[i].Id;
        resJson.group_name = taskGroup[i].Name;
        resJson.group_start_time = taskGroup[i].StartTime;
        resJson.group_end_time = taskGroup[i].EndTime;
        var taskGroupTasks = await getTaskGroupTask(taskGroup[i].Id);
        var level2TaskCount = 0;
        var level3TaskCount = 0;
        var level4TaskCount = 0;
        if(taskGroupTasks != null && taskGroupTasks.length > 0) {
          for(var a=0; a<taskGroupTasks.length; a++){
            if(taskGroupTasks[a].TaskLevel == 2){
              level2TaskCount = level2TaskCount + 1;
            }
            if(taskGroupTasks[a].TaskLevel == 3){
              level3TaskCount = level3TaskCount + 1;
            }
            if(taskGroupTasks[a].TaskLevel == 4){
              level4TaskCount = level4TaskCount + 1;
            }
          }
        }
        resJson.group_lv2_task_count = level2TaskCount;
        resJson.group_lv3_task_count = level3TaskCount;
        resJson.group_lv4_task_count = level4TaskCount;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task group existed'));
    }
  })
});

function getTaskGroupTask (iGroupId) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        TaskGroupId: iGroupId
      }
    }).then(function(task) {
      if(task != null && task.length > 0) {
        resolve(task);
      } else {
        resolve(null);
      }
    });
  });
}

router.get('/getTaskGroupAll', function(req, res, next) {
  var rtnResult = [];
  TaskGroup.findAll({
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(taskGroup) {
    if(taskGroup.length > 0) {
      for(var i=0;i<taskGroup.length;i++){
        var resJson = {};
        resJson.group_id = taskGroup[i].Id;
        resJson.group_name = taskGroup[i].Name;
        resJson.group_start_time = taskGroup[i].StartTime;
        resJson.group_end_time = taskGroup[i].EndTime;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task group existed'));
    }
  })
});

router.post('/addOrUpdateTaskGroup', function(req, res, next) {
  TaskGroup.findOrCreate({
    where: { 
      Id: req.body.tGroupId 
    }, 
    defaults: {
      Name: req.body.tGroupName,
      StartTime: req.body.tGroupStartTime,
      EndTime: req.body.tGroupEndTime,
      RelatedTaskName: req.body.tGroupRelatedTask
    }})
  .spread(function(taskGroup, created) {
    if(created) {
      return res.json(responseMessage(0, taskGroup, 'Created task group successfully!'));
    } 
    else if(taskGroup != null && !created) {
      taskGroup.update({
        Name: req.body.tGroupName,
      StartTime: req.body.tGroupStartTime,
      EndTime: req.body.tGroupEndTime,
      RelatedTaskName: req.body.tGroupRelatedTask
      });
      return res.json(responseMessage(0, taskGroup, 'Updated task group successfully!'));
    }
    else {
      return res.json(responseMessage(1, null, 'Created/Update task group failed'));
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

function prefixZero(num, n) {
  return (Array(n).join(0) + num).slice(-n);
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

