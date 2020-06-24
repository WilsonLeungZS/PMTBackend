var Sequelize = require('sequelize');
var db = require('../config/db');
var express = require('express');
var router = express.Router();
var TaskType = require('../model/task/task_type');
var Task = require('../model/task/task');
var User = require('../model/user');
var TaskGroup = require('../model/task/task_group');
var Worklog = require('../model/worklog');
var taskItems = require('../services/taskItem');
var Schedule = require('../model/schedule');
var nodeSchedule = require('node-schedule');
const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response tasks resource'});
});

//Task
// 1. Search task function
router.get('/searchTaskByKeywordAndLevel', function(req, res, next) {
  var reqTaskKeyWord = req.query.reqTaskKeyword.trim();
  var reqTaskLevel = Number(req.query.reqTaskLevel);
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: reqTaskLevel
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(tasks) {
      if(tasks != null && tasks.length > 0) {
        var response = await generateTaskList(tasks);
        return res.json(responseMessage(0, response, ''));
      } else {
        return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

//1. Get Task list for web PMT
router.get('/getTaskList', function(req, res, next) {
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  var taskCriteria = generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  var orderSeq = [];
  if (Number(req.query.reqTaskLevel == 1)) {
    orderSeq = ['TopTargetStart', 'DESC']
  } else {
    orderSeq = ['createdAt', 'DESC']
  }
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: taskTypeCriteria
    }],
    where: taskCriteria,
    order: [
      orderSeq
    ],
    limit: reqSize,
    offset: reqSize * (reqPage - 1),
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var response = await generateTaskList(tasks);
      return res.json(responseMessage(0, response, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    } 
  })
});

router.get('/getTaskListTotalSize', function(req, res, next) {
  var taskCriteria = generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: taskTypeCriteria
    }],
    where: taskCriteria
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var resJson = {};
      resJson.task_list_total_size = tasks.length;
      return res.json(responseMessage(0, resJson, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    } 
  })
});

function generateTaskCriteria(iReq) {
  var reqTaskLevel = Number(iReq.query.reqTaskLevel);
  var criteria = {
    TaskName: {[Op.notLike]: 'Dummy - %'},
    TaskLevel: reqTaskLevel,
    Id: { [Op.ne]: null }
  }
  if (iReq.query.reqTaskKeyword != null && iReq.query.reqTaskKeyword != '') {
    var reqTaskKeyWord = iReq.query.reqTaskKeyword.trim();
    var searchKeywordCriteria = {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ]
    }
    var c1 = Object.assign(criteria, searchKeywordCriteria);
  } 
  if (iReq.query.reqFilterAssignee != null && iReq.query.reqFilterAssignee != '') {
    if (reqTaskLevel == 1 || reqTaskLevel == 2) {
      criteria.RespLeaderId = Number(iReq.query.reqFilterAssignee)
    } else {
      criteria.AssigneeId = Number(iReq.query.reqFilterAssignee)
    }
  }
  if (iReq.query.reqFilterStatus != null && iReq.query.reqFilterStatus != '') {
    criteria.Status = iReq.query.reqFilterStatus
  }
  var reqFilterIssueDateStart = null;
  var reqFilterIssueDateEnd = null;
  if (iReq.query.reqFilterIssueDateStart != null && iReq.query.reqFilterIssueDateStart != '') {
    reqFilterIssueDateStart = iReq.query.reqFilterIssueDateStart + ' 00:00:00'
  }
  if (iReq.query.reqFilterIssueDateEnd != null && iReq.query.reqFilterIssueDateEnd != '') {
    reqFilterIssueDateEnd = iReq.query.reqFilterIssueDateEnd + ' 23:59:59'
  }
  if (reqFilterIssueDateStart != null && reqFilterIssueDateEnd != null) {
    var issueDateCriteria = {
      [Op.and]: [
        { IssueDate: { [Op.gte]:  reqFilterIssueDateStart }},
        { IssueDate: { [Op.lte]:  reqFilterIssueDateEnd }}
      ]
    }
    var c2 = Object.assign(criteria, issueDateCriteria);
  }
  return criteria;
}

function generateTaskTypeCriteria(iReq) {
  var taskTypeCriteria = {}
  if (iReq.query.reqFilterShowRefPool != null && iReq.query.reqFilterShowRefPool != '') {
    if (iReq.query.reqFilterShowRefPool == 'true') {
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
  return taskTypeCriteria;
}

function generateTaskList(iTaskObjArray) {
  return new Promise(async (resolve, reject) => {
    var rtnResult = [];
    for (var i=0; i<iTaskObjArray.length; i++) {
      var resJson = {}
      resJson.task_id = iTaskObjArray[i].Id;
      resJson.task_name = iTaskObjArray[i].TaskName;
      // Level 2 ~ 4
      resJson.task_parent_name = iTaskObjArray[i].ParentTaskName;
      resJson.task_level = iTaskObjArray[i].TaskLevel;
      resJson.task_desc = iTaskObjArray[i].Description;
      resJson.task_status = iTaskObjArray[i].Status;
      if (iTaskObjArray[i].Status == 'Planning' || iTaskObjArray[i].Status == 'Running') {
        resJson.task_plan_mode_btn_enable = true
      } else {
        resJson.task_plan_mode_btn_enable = false
      }
      resJson.task_effort = iTaskObjArray[i].Effort;
      resJson.task_estimation = iTaskObjArray[i].Estimation;
      resJson.task_scope = iTaskObjArray[i].Scope;
      resJson.task_reference = iTaskObjArray[i].Reference;
      var assigneeId = iTaskObjArray[i].AssigneeId;
      if (assigneeId != null && assigneeId != '') {
        var assigneeName = await getUserById(assigneeId);
        resJson.task_assignee = assigneeName;
      } else {
        resJson.task_assignee = null;
      }
      resJson.task_issue_date = iTaskObjArray[i].IssueDate;
      resJson.task_target_complete = iTaskObjArray[i].TargetCompleteDate;
      //Level 1
      resJson.task_top_opp_name = iTaskObjArray[i].TopOppName;
      resJson.task_top_customer = iTaskObjArray[i].TopCustomer;
      resJson.task_top_type_of_work = iTaskObjArray[i].TopTypeOfWork;
      resJson.task_top_team_sizing = iTaskObjArray[i].TopTeamSizing;
      var respLeaderId = iTaskObjArray[i].RespLeaderId;
      if (respLeaderId != null && respLeaderId != '') {
        var respLeaderName = await getUserById(respLeaderId);
        resJson.task_top_resp_leader = respLeaderName;
      } else {
        resJson.task_top_resp_leader = null;
      }
      var trgtStartTime = iTaskObjArray[i].TopTargetStart;
      if( trgtStartTime != null && trgtStartTime != ''){
        var startTime = new Date(trgtStartTime);
        resJson.task_top_target_start = startTime.getFullYear() + '-' + ((startTime.getMonth() + 1) < 10 ? '0' + (startTime.getMonth() + 1) : (startTime.getMonth() + 1));
      } else {
        resJson.task_top_target_start = null
      }
      rtnResult.push(resJson);  
    } 
    resolve(rtnResult);
  });
}

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

//2. Get Task by Id
router.post('/getTaskById', function(req, res, next) {
  console.log('Start to get task by id: ' + req.body.reqTaskId)
  Task.findOne({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      Id: req.body.reqTaskId 
    }
  }).then(async function(task) {
    //console.log(task)
    if(task != null) {
      var response = await generateTaskInfo(task);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getTaskByName', function(req, res, next) {
  console.log('Start to get task by name: ' + req.body.reqTaskName)
  Task.findOne({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      TaskName: req.body.reqTaskName 
    }
  }).then(async function(task) {
    if(task != null) {
      var response = await generateTaskInfo(task);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

function generateTaskInfo (iTask) {
  return new Promise(async (resolve, reject) => {
    var resJson = {};
    resJson.task_id = iTask.Id;
    resJson.task_parent_name = iTask.ParentTaskName;
    if(iTask.ParentTaskName != 'N/A') {
      resJson.task_parent_desc = await getTaskDescription(iTask.ParentTaskName);
      resJson.task_parent_type = await getTaskType(iTask.ParentTaskName)
    } else {
      resJson.task_parent_desc = null;
      resJson.task_parent_type = null;
    }
    resJson.task_name = iTask.TaskName;
    resJson.task_level = iTask.TaskLevel;
    resJson.task_desc = iTask.Description;
    resJson.task_type_id = iTask.TaskTypeId;
    resJson.task_type = iTask.task_type.Name;
    resJson.task_creator = iTask.Creator;
    if (iTask.Creator != null && iTask.Creator != '' && iTask.Creator.startsWith('PMT:')) {
      resJson.task_creator_name = ''
      var creatorNumber = iTask.Creator.replace('PMT:', '');
      var creatorName = await getUserNameByEmployeeNumber(creatorNumber);
      if (creatorName != null) {
        resJson.task_creator_name = creatorName;
      } else {
        resJson.task_creator_name = '';
      }
    }
    resJson.task_status = iTask.Status;
    resJson.task_effort = iTask.Effort;
    if(iTask.Estimation != null && iTask.Estimation >0){
      resJson.task_estimation =  iTask.Estimation;
      resJson.task_progress = toPercent(iTask.Effort, iTask.Estimation);
      var percentage =  "" + toPercent(iTask.Effort, iTask.Estimation);
      resJson.task_progress_nosymbol = percentage.replace("%","");
    } else {
      resJson.task_estimation = "0"
      resJson.task_progress = "0";
      resJson.task_progress_nosymbol = "0";
    }
    if(Number(iTask.TaskLevel) === 1) {
      resJson.task_subtasks_estimation = 0;
    } else {
      resJson.task_subtasks_estimation = await getSubTaskTotalEstimation(iTask.TaskName);
    }
    if(resJson.task_subtasks_estimation > 0) {
      resJson.task_progress = toPercent(iTask.Effort, resJson.task_subtasks_estimation);
      resJson.task_progress_nosymbol = resJson.task_progress.replace("%","");
    }
    resJson.task_issue_date = iTask.IssueDate;
    resJson.task_target_complete = iTask.TargetCompleteDate;
    resJson.task_actual_complete = iTask.ActualCompleteDate;
    resJson.task_responsible_leader = iTask.RespLeaderId;
    resJson.task_assignee = iTask.AssigneeId;
    resJson.task_reference = iTask.Reference;
    if(iTask.Reference != null && iTask.Reference != '') {
      resJson.task_reference_desc = await getTaskDescription(iTask.Reference);
    } else {
      resJson.task_reference_desc = null;
    }
    resJson.task_scope = iTask.Scope;
    resJson.task_group_id = iTask.TaskGroupId;
    resJson.task_top_constraint = iTask.TopConstraint;
    resJson.task_top_opp_name = iTask.TopOppName;
    resJson.task_top_customer = iTask.TopCustomer;
    resJson.task_top_facing_client = iTask.TopFacingClient;
    resJson.task_top_type_of_work = iTask.TopTypeOfWork;
    resJson.task_top_chance_winning = iTask.TopChanceWinning;
    resJson.task_top_sow_confirmation = iTask.TopSowConfirmation;
    resJson.task_top_business_value = iTask.TopBusinessValue;
    resJson.task_top_target_start = iTask.TopTargetStart;
    resJson.task_top_target_end = iTask.TopTargetEnd;
    resJson.task_top_paint_points = iTask.TopPaintPoints;
    resJson.task_top_team_sizing = iTask.TopTeamSizing;
    resJson.task_top_skill = iTask.TopSkill;
    resJson.task_top_opps_project = iTask.TopOppsProject;
    resJson.task_detail = iTask.Detail;
    resJson.task_deliverableTag = iTask.DeliverableTag;
    resJson.task_TypeTag = iTask.TypeTag;
    resolve(resJson);
  });
}

function getUserNameByEmployeeNumber(iEmployeeNumber) {
  return new Promise((resolve,reject) =>{
    User.findOne({
      where:{
        EmployeeNumber: iEmployeeNumber
      }
    }).then(async function(user){
      if(user!=null){
        resolve(user.Name)
      }else{
        resolve(null)
      }
    })
  }) 
}

/*function getSubTaskTotalEstimation1(iTaskName) {
  return new Promise((resolve, reject) => {
    console.log(iTaskName)
    Task.findAll({
      include: [{
        model: TaskType, 
        attributes: ['Name'],
        where: {
          Name: { [Op.ne]: 'Pool' }
          }
      }],
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
}*/

function getSubTaskTotalEstimation(iTaskName) {
  return new Promise((resolve, reject) => {
    var sql = 'select id, ParentTaskName, TaskName, Estimation, TaskLevel from (select * from tasks order by ParentTaskName, id) data_sorted, (select @pv := "' + iTaskName + '") initialisation where   find_in_set(ParentTaskName, @pv) and length(@pv := concat(@pv, ",", TaskName))'
    db.query(sql).then(totalTask => {
      var tasks = totalTask[0];
      var rtnTotalEstimation = 0;
      if (tasks != null && tasks.length > 0) {
        for (var i=0; i<tasks.length; i++) {
          var taskName = tasks[i].TaskName;
          if (getIndexOfValueInArr(tasks, 'ParentTaskName', taskName) == -1){
            rtnTotalEstimation = rtnTotalEstimation + Number(tasks[i].Estimation);
          } else {
            continue;
          }
        }
      }
      resolve(rtnTotalEstimation);
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

function getTaskType(iTaskname) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      include: [{
        model: TaskType, 
        attributes: ['Name']
      }],
      where: {
        TaskName: iTaskname 
      }
    }).then(function(task) {
      if (task != null) {
        resolve(task.task_type.Name)
      } else {
        resolve(null);
      }
    });
  });
}
router.post('/getRegularTaskByTaskName', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
    where: {
      ParentTaskName: req.body.reqTaskName,
      TypeTag:{ [Op.eq] :'Regular Task'}
    },
    order: [
      ['Id', 'ASC']
    ]
  }).then(async function(task) {
      if(task.length > 0) {
        for(var i=0;i<task.length;i++){
          var resJson = {};
          resJson.task_id = task[i].Id;
          resJson.task_name = task[i].TaskName;
          resJson.task_desc = task[i].Description;
          resJson.task_status = task[i].Status;
          var respLeaderId = task[i].RespLeaderId;
          if (respLeaderId != null && respLeaderId != '') {
            var respLeaderName = await getUserById(respLeaderId);
            resJson.task_responsible_leader = respLeaderName;
          } else {
            resJson.task_responsible_leader = null;
          }
          var assigneeId = task[i].AssigneeId;
          if (assigneeId != null && assigneeId != '') {
            var assigneeName = await getUserById(assigneeId);
            resJson.task_assignee = assigneeName;
          } else {
            resJson.task_assignee = null;
          }
          rtnResult.push(resJson);
        }
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'No sub task exist'));
      }
  })
});

router.post('/getSubTaskByTaskName', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
    where: {
      ParentTaskName: req.body.reqTaskName,
      TypeTag:{ [Op.ne] :'Regular Task'}
    },
    order: [
      ['Id', 'ASC']
    ]
  }).then(async function(task) {
      if(task.length > 0) {
        for(var i=0;i<task.length;i++){
          var resJson = {};
          resJson.task_id = task[i].Id;
          resJson.task_name = task[i].TaskName;
          resJson.task_desc = task[i].Description;
          resJson.task_status = task[i].Status;
          var respLeaderId = task[i].RespLeaderId;
          if (respLeaderId != null && respLeaderId != '') {
            var respLeaderName = await getUserById(respLeaderId);
            resJson.task_responsible_leader = respLeaderName;
          } else {
            resJson.task_responsible_leader = null;
          }
          var assigneeId = task[i].AssigneeId;
          if (assigneeId != null && assigneeId != '') {
            var assigneeName = await getUserById(assigneeId);
            resJson.task_assignee = assigneeName;
          } else {
            resJson.task_assignee = null;
          }
          rtnResult.push(resJson);
        }
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'No sub task exist'));
      }
  })
});

//3. Save task
router.get('/testApi', async function(req, res, next) {
  var taskName = req.query.taskName;
  var sql1 = 'SELECT t1.TaskName AS lev1, t1.Estimation AS lev1_est, t2.TaskName as lev2, t2.Estimation AS lev2_est, t3.TaskName as lev3, t3.Estimation AS lev3_est, t4.TaskName as lev4, t4.Estimation AS lev4_est FROM tasks AS t1 LEFT JOIN tasks AS t2 ON t2.ParentTaskName = t1.TaskName LEFT JOIN tasks AS t3 ON t3.ParentTaskName = t2.TaskName LEFT JOIN tasks AS t4 ON t4.ParentTaskName = t3.TaskName WHERE t1.TaskName = "' + taskName + '"'; 
  var sql2 = 'select id, ParentTaskName, TaskName, Estimation, TaskLevel from (select * from tasks order by ParentTaskName, id) data_sorted, (select @pv := "' + taskName + '") initialisation where   find_in_set(ParentTaskName, @pv) and length(@pv := concat(@pv, ",", TaskName))'
  /* db.query(sql2).then(task => {
    console.log(task)
    return res.json(responseMessage(0, task, ''));
  }) */
  var est = await getSubTaskTotalEstimation(taskName);
  return res.json(responseMessage(0, est, ''));
});

router.get('/checkSubTaskDone', async function(req, res, next) {
  var reqTaskName = req.query.reqTaskName;
  var sql = 'select * from (select id, ParentTaskName, TaskName, Status from (select * from tasks order by ParentTaskName, id) data_sorted, (select @pv := "' + reqTaskName + '") initialisation where   find_in_set(ParentTaskName, @pv) and length(@pv := concat(@pv, ",", TaskName))) raw_data where raw_data.Status <> "Done" ';
  db.query(sql).then(totalTask => {
    var tasks = totalTask[0];
    if (tasks != null && tasks.length > 0) {
      return res.json(responseMessage(1, null, 'Exist sub tasks status not "Done"'));
    } else {
      return res.json(responseMessage(0, null, 'All sub tasks status "Done"'));
    }
  })
});

router.post('/saveTask', function(req, res, next) {
  //taskItems.saveTask(req, res,'createByUser');
  saveTask(req, res);
});

async function saveTask(req, res) {
  var reqTask = JSON.parse(req.body.reqTask);
  var reqTaskName = reqTask.task_name;
  var reqTaskParent = reqTask.task_parent_name;
  if((reqTaskName == null || reqTaskName == '') && reqTaskParent != 'N/A'){
    reqTaskName = await getSubTaskName(reqTaskParent);
  }
  var taskObj = {
    ParentTaskName: reqTaskParent,
    TaskName: reqTaskName,
    Description: reqTask.task_desc != ''? reqTask.task_desc: null,
    Priority: null,
    Status: reqTask.task_status != ''? reqTask.task_status: null,
    Creator: reqTask.task_creator != ''? reqTask.task_creator: null,
    TaskTypeId: reqTask.task_type_id != ''? Number(reqTask.task_type_id): null,
    Effort: 0,
    Estimation: reqTask.task_estimation != ''? Number(reqTask.task_estimation): 0,
    IssueDate: reqTask.task_issue_date != ''? reqTask.task_issue_date: null,
    TargetCompleteDate: reqTask.task_target_complete != ''? reqTask.task_target_complete: null,
    ActualCompleteDate: reqTask.task_actual_complete != ''? reqTask.task_actual_complete: null,
    BusinessArea: null,
    BizProject: null,
    TaskLevel: reqTask.task_level != ''? reqTask.task_level: 0,
    RespLeaderId: reqTask.task_responsible_leader != ''? reqTask.task_responsible_leader: null,
    AssigneeId: reqTask.task_assignee != ''? reqTask.task_assignee: null,
    Reference: reqTask.task_reference != ''? reqTask.task_reference: null,
    Scope: reqTask.task_scope != ''? reqTask.task_scope: null,
    TopConstraint: reqTask.task_top_constraint != ''? reqTask.task_top_constraint: null,
    TopOppName: reqTask.task_top_opp_name != ''? reqTask.task_top_opp_name: null,
    TopCustomer: reqTask.task_top_customer != ''? reqTask.task_top_customer: null,
    TopFacingClient: reqTask.task_top_facing_client != ''? reqTask.task_top_facing_client: null,
    TopTypeOfWork: reqTask.task_top_type_of_work != ''? reqTask.task_top_type_of_work: null,
    TopChanceWinning: reqTask.task_top_chance_winning != ''? reqTask.task_top_chance_winning: null, 
    TopSowConfirmation: reqTask.task_top_sow_confirmation != ''? reqTask.task_top_sow_confirmation: null,
    TopBusinessValue: reqTask.task_top_business_value != ''? reqTask.task_top_business_value: null,
    TopTargetStart: reqTask.task_top_target_start != ''? reqTask.task_top_target_start: null,
    TopTargetEnd: reqTask.task_top_target_end != ''? reqTask.task_top_target_end: null,
    TopPaintPoints: reqTask.task_top_paint_points != ''? reqTask.task_top_paint_points: null,
    TopTeamSizing: reqTask.task_top_team_sizing != ''? reqTask.task_top_team_sizing: null,
    TopSkill: reqTask.task_top_skill != ''? reqTask.task_top_skill: null,
    TopOppsProject: reqTask.task_top_opps_project != ''? reqTask.task_top_opps_project: null,
    TaskGroupId: reqTask.task_group_id != ''? reqTask.task_group_id: null,
    TypeTag: reqTask.task_TypeTag != ''? reqTask.task_TypeTag: null,
    DeliverableTag: reqTask.task_deliverableTag != ''? reqTask.task_deliverableTag: null,
    Detail: reqTask.task_detail != ''? reqTask.task_detail: null,
  }
  console.log('TaskObject Start: ------------->');
  console.log(taskObj);
  console.log('TaskObject End: ------------->');
  Task.findOrCreate({
      where: { TaskName: reqTaskName }, 
      defaults: taskObj
    })
    .spread(async function(task, created) {
      if(created) {
        console.log("Task created"); 
        return res.json(responseMessage(0, task, 'Task Created'));
      } else {
        console.log("Task existed");
        console.log('george: ' + reqTask.task_status);
        if(reqTask.task_status == 'Running' && reqTask.task_TypeTag == 'Regular Task'){
          Schedule.update({
            Status: 'Running'
          },
            {where: {TaskId: reqTaskName}
          });
          console.log("Task Schedule status update to running"); 
        }else if(reqTask.task_status == 'Done' && reqTask.task_TypeTag == 'Regular Task'){
          Schedule.findAll({
            attributes: ['JobId'],
            where: { 
              TaskId: reqTaskName
            },
          }).then(function(sch) {
            var tempJobId = sch[0].JobId;
            var runningJob = nodeSchedule.scheduledJobs[String(tempJobId)];
            console.log('Start To Cancel Schedule Job ----------------------------->');
            if(runningJob != null){
              if(runningJob.cancel()){
                console.log('JobId: ' + tempJobId + ' was done.');
              }
            }
            Schedule.update({
              Status: 'Done'
            },
              {where: {JobId: tempJobId}
            });
          });
        }
        taskObj.Effort = task.Effort;
        // Change parent task
        if (Number(reqTask.task_level) == 3 || Number(reqTask.task_level) == 4) {
          if (!reqTaskName.startsWith(reqTaskParent) && checkIfChangeParent(reqTaskName)) {
            console.log('Task name not starts with parent task name, will change parent task')
            //Change parent task effort
            var oldParent = task.ParentTaskName;
            var newParent = reqTaskParent;
            var existingTaskEffort = Number(task.Effort);
            if(Number(existingTaskEffort) > 0) {
              var effortUpResult1 = await updateParentTaskEffort(oldParent, -(existingTaskEffort));
              var effortUpResult2 = await updateParentTaskEffort(newParent, existingTaskEffort);
            }
            taskObj.ParentTaskName = newParent;
            taskObj.TaskName = await getSubTaskName(newParent);
          }
        }
        await Task.update(taskObj, {where: { TaskName: reqTaskName }});
        //Update sub-tasks responsilbe leader
        if (Number(reqTask.task_level) == 2) {
          var updateResult1 = await updateSubTasksRespLeader(reqTask.task_name, reqTask.task_responsible_leader);
        }
        if (Number(reqTask.task_level) == 3) {
          var updateResult2 = await updateSubTasksGroup(reqTask.task_name, reqTask.task_group_id);
          var updateResult3 = await updateSubTasksReference(reqTask.task_name, reqTask.task_reference);
          var updateResult4 = await updateSubTasksWhenChangeParent(reqTask.task_name, taskObj.TaskName);
        }
        return res.json(responseMessage(1, task, 'Task existed'));
      }
  });
}

function checkIfChangeParent(iTaskName) {
  if(iTaskName != null && iTaskName != ''){
    if(!iTaskName.startsWith('INC') && !iTaskName.startsWith('INCTASK') && !iTaskName.startsWith('PRB')) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

function updateParentTaskEffort (iTaskName, iEffort) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {TaskName: iTaskName}
    }).then(async function(task) {
      if (task != null) {
        var currentEffort = task.Effort;
        var effort = Number(currentEffort) + Number(iEffort);
        await task.update({Effort: effort});
        resolve(0);
      } else {
        resolve(1);
      }
    });
  });
}

function updateSubTasksWhenChangeParent (iTaskName, iNewTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {ParentTaskName: iTaskName}
    }).then(async function(subtasks) {
      if (subtasks != null && subtasks.length > 0) {
        for (var i=0; i<subtasks.length; i++) {
          var newTaskName = iNewTaskName + '-' + (i+1);
          await Task.update({
            ParentTaskName: iNewTaskName,
            TaskName: newTaskName
          },
            {where: {Id: subtasks[i].Id}
          });
        }
        resolve(0);
      } else {
        resolve(1);
      }
    })
  });
}

async function getSubTaskName(iParentTask) {
  console.log('Start to get Sub task Name!!')
  var subTasks = await getSubTasks(iParentTask);
  var subTaskCount = 0;
  if(subTasks != null && subTasks.length > 0) {
    var taskLastNumberArray = [];
    for (var i=0; i<subTasks.length; i++) {
      var lastSubTaskName = subTasks[i].TaskName;
      var nameArr = lastSubTaskName.split('-');
      var lastNameNum = Number(nameArr[nameArr.length-1]);
      taskLastNumberArray.push(lastNameNum);
    }
    let max = taskLastNumberArray[0]
    taskLastNumberArray.forEach(item => max = item > max ? item : max)
    var subTasksLength = subTasks.length;
    console.log('Sub Task Last Number: ' + max);
    console.log('Sub Task Length: ' + subTasksLength);
    subTaskCount = max;
  } else {
    subTaskCount = 0;
  }
  subTaskCount = Number(subTaskCount) + 1;
  var taskName = iParentTask + '-' + subTaskCount;
  console.log('Sub Task Name: ' + taskName);
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

function updateSubTasksReference (iTaskName, iReference) {
  return new Promise((resolve, reject) => {
    Task.update({
        Reference: iReference != '' ? iReference : null
      },
      {where: {ParentTaskName: iTaskName}
    });
    resolve(0);
  });
}

function updateSubTasksRespLeader (iTaskName, iRespLeaderId) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iTaskName
      }
    }).then(async function(tasks) {
      if (tasks != null && tasks.length > 0) {
        await Task.update({RespLeaderId: iRespLeaderId != '' ? iRespLeaderId : null}, {where: {ParentTaskName: iTaskName}});
        for(var i=0; i<tasks.length; i++) {
          await updateSubTasksRespLeader(tasks[i].TaskName, iRespLeaderId)
        }
        resolve(0);
      } else {
        resolve(1);
      }
    });
  });
}

function getSubTasks (iTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iTaskName
      },
      order: [
        ['createdAt', 'DESC']
      ]
    }).then(function(task) {
      if(task != null && task.length > 0){
        resolve(task);
      } else {
        resolve(null)
      }
    })
  });
}

router.post('/getTaskByNameForParentTask', function(req, res, next) {
  var rtnResult = [];
  var reqTaskKeyWord = req.body.reqTaskKeyword.trim();
  var reqTaskLevel = req.body.reqTaskLevel;
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
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: reqTaskLevel,
      Id: { [Op.ne]: null }
    },
    limit: 30,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_desc = task[i].Description;
        if(resJson.task_desc == null || resJson.task_desc == '') {
          resJson.task_desc = task[i].TopOppName;
        }
        resJson.task_type = task[i].task_type.Name;
        resJson.task_type_id = task[i].TaskTypeId;
        resJson.task_responsible_leader = task[i].RespLeaderId;
        resJson.task_group_id = task[i].TaskGroupId;
        resJson.task_reference = task[i].Reference;
        if(task[i].Reference != null && task[i].Reference != '') {
          resJson.task_reference_desc = await getTaskDescription(task[i].Reference);
        } else {
          resJson.task_reference_desc = null;
        }
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getTaskByNameForRefPool', function(req, res, next) {
  var rtnResult = [];
  var reqTaskKeyWord = req.body.reqTaskKeyword.trim();
  console.log('Keyword: ' + reqTaskKeyWord);
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
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: 3,
      Id: { [Op.ne]: null }
    },
    limit: 30,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(task) {
    console.log('Json: ' + JSON.stringify(task));
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
      var result2 = false;
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

router.post('/getTaskByNameForWorklogTask', function(req, res, next) {
  var rtnResult = [];
  var taskKeyWord = req.body.tTaskName.trim();
  console.log('Search task by keyword: ' + taskKeyWord);
  var taskAssigneeId = Number(req.body.tTaskAssigneeId);
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: {
        Name: { [Op.ne]: 'Pool' }
      }
    }],
    where: {
      TaskName: {[Op.notLike]: 'Dummy - %'},
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Reference: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      [Op.and]: [
        { Status: {[Op.ne]: 'Drafting'}},
        { Status: {[Op.ne]: 'Planning'}},
        { TaskLevel: {[Op.ne]: 1}},
        { TaskLevel: {[Op.ne]: 2}},
        {[Op.or]: [
          { AssigneeId: taskAssigneeId },
          { TypeTag: 'Public Task' }
        ]}
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

// Plan Task API
router.post('/getLevel2TaskByParentTask', function(req, res, next) {
  console.log('Start to get level 2 task by parent task name: ' + req.body.reqParentTaskName)
  var reqTaskGroupId = Number(req.body.reqTaskGroupId);
  var reqTaskGroupFlag = Number(req.body.reqTaskGroupFlag);
  Task.findAll({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: {
      ParentTaskName: req.body.reqParentTaskName,
      TaskLevel: 2,
      Status: {[Op.ne]: 'Drafting'}
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var response = await generateTaskListForPlanTask(tasks, reqTaskGroupId, reqTaskGroupFlag);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

function generateTaskListForPlanTask(iTaskObjArray, iTaskGroupId, iTaskGroupFlag) {
  return new Promise(async (resolve, reject) => {
    var rtnResult = [];
    for (var i=0; i<iTaskObjArray.length; i++) {
      var resJson = {}
      resJson.task_id = iTaskObjArray[i].Id;
      resJson.task_name = iTaskObjArray[i].TaskName;
      resJson.task_parent_name = iTaskObjArray[i].ParentTaskName;
      resJson.task_level = iTaskObjArray[i].TaskLevel;
      resJson.task_desc = iTaskObjArray[i].Description;
      resJson.task_type_id = iTaskObjArray[i].task_type.Id;
      resJson.task_status = iTaskObjArray[i].Status;
      resJson.task_effort = await getSubTaskTotalEffortForPlanTask(iTaskObjArray[i].TaskName, iTaskGroupId, iTaskGroupFlag);
      resJson.task_estimation = iTaskObjArray[i].Estimation;
      resJson.task_subtasks_estimation = await getSubTaskTotalEstimationForPlanTask(iTaskObjArray[i].TaskName, iTaskGroupId, iTaskGroupFlag);
      resJson.task_scope = iTaskObjArray[i].Scope;
      resJson.task_responsible_leader_id = iTaskObjArray[i].RespLeaderId;
      var respLeaderId = iTaskObjArray[i].RespLeaderId;
      if (respLeaderId != null && respLeaderId != '') {
        var respLeaderName = await getUserById(respLeaderId);
        resJson.task_responsible_leader = respLeaderName;
      } else {
        resJson.task_responsible_leader = null;
      }
      var assigneeId = iTaskObjArray[i].AssigneeId;
      if (assigneeId != null && assigneeId != '') {
        var assigneeName = await getUserById(assigneeId);
        resJson.task_assignee = assigneeName;
      } else {
        resJson.task_assignee = null;
      }
      resJson.task_issue_date = iTaskObjArray[i].IssueDate;
      resJson.task_target_complete = iTaskObjArray[i].TargetCompleteDate;
      resJson.task_plan_tasks_list = [];
      resJson.task_plan_tasks_loading = false;
      resJson.task_total_size = 0;
      resJson.task_page_number = 1;
      resJson.task_page_size = 20;
      rtnResult.push(resJson);  
    } 
    resolve(rtnResult);
  });
}

router.post('/refreshLevel2TaskSubEstimation', function(req, res, next) {
  console.log('Start to refresh level 2 task sub est');
  var reqTaskId = Number(req.body.reqTaskId);
  var reqTaskGroupId = Number(req.body.reqTaskGroupId);
  var reqTaskGroupFlag = Number(req.body.reqTaskGroupFlag);
  Task.findOne({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: {
      Id: reqTaskId
    }
  }).then(async function(task) {
    if(task != null) {
      var resJson = {}
      resJson.task_subtasks_estimation = await getSubTaskTotalEstimationForPlanTask(task.TaskName, reqTaskGroupId, reqTaskGroupFlag);
      return res.json(responseMessage(0, resJson, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

/*function getSubTaskTotalEstimationForPlanTask1(iTaskName, iTaskGroupId, iTaskGroupFlag) {
  return new Promise((resolve, reject) => {
    var criteria = {}
    if (iTaskGroupId > 0 ) {
      if (iTaskGroupFlag == 0) {
        criteria = {
          ParentTaskName: iTaskName,
          TaskLevel: 3,
          TaskGroupId: iTaskGroupId
        }
      }
      if (iTaskGroupFlag == 1) {
        criteria = {
          ParentTaskName: iTaskName,
          TaskLevel: 3,
          [Op.or]: [
            {TaskGroupId: iTaskGroupId},
            {TaskGroupId: null}
          ],
        }
      }
    } 
    else if (iTaskGroupId == -1 ) {
      criteria = {
        ParentTaskName: iTaskName,
        TaskLevel: 3,
        TaskGroupId: null
      }
    } 
    else {
      criteria = {
        ParentTaskName: iTaskName,
        TaskLevel: 3
      }
    }
    Task.findAll({
      include: [{
        model: TaskType, 
        attributes: ['Name'],
        where: {
          Name: { [Op.ne]: 'Pool' }
        }
      }],
      where: criteria
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
} */

function getSubTaskTotalEstimationForPlanTask(iTaskName, iTaskGroupId, iTaskGroupFlag) {
  return new Promise((resolve, reject) => {
    var criteria = '';
    if (iTaskGroupId > 0 ) {
      if (iTaskGroupFlag == 0) {
        criteria = ' where raw_data.TaskGroupId = ' + iTaskGroupId
      }
      if (iTaskGroupFlag == 1) {
        criteria = ' where (raw_data.TaskGroupId = ' + iTaskGroupId + ' or raw_data.TaskGroupId is null)'
      }
    } 
    else if (iTaskGroupId == -1 ) {
      criteria = ' where raw_data.TaskGroupId is null'
    } 
    else {
      criteria = ''
    }
    var sql = 'select * from (select id, ParentTaskName, TaskName, Estimation, TaskLevel, TaskGroupId from (select * from tasks order by ParentTaskName, id) data_sorted, (select @pv := "' + iTaskName + '") initialisation where   find_in_set(ParentTaskName, @pv) and length(@pv := concat(@pv, ",", TaskName))) raw_data'
    sql = sql + criteria
    db.query(sql).then(totalTask => {
      var tasks = totalTask[0];
      var rtnTotalEstimation = 0;
      if (tasks != null && tasks.length > 0) {
        for (var i=0; i<tasks.length; i++) {
          var taskName = tasks[i].TaskName;
          if (getIndexOfValueInArr(tasks, 'ParentTaskName', taskName) == -1){
            rtnTotalEstimation = rtnTotalEstimation + Number(tasks[i].Estimation);
          } else {
            continue;
          }
        }
      }
      resolve(rtnTotalEstimation);
    });
  })
}

function getSubTaskTotalEffortForPlanTask(iTaskName, iTaskGroupId, iTaskGroupFlag) {
  return new Promise((resolve, reject) => {
    var criteria = {}
    if (iTaskGroupId > 0 ) {
      if (iTaskGroupFlag == 0) {
        criteria = {
          ParentTaskName: iTaskName,
          TaskLevel: 3,
          TaskGroupId: iTaskGroupId,
          Effort: { [Op.ne]: 0 }
        }
      }
      if (iTaskGroupFlag == 1) {
        criteria = {
          ParentTaskName: iTaskName,
          TaskLevel: 3,
          [Op.or]: [
            {TaskGroupId: iTaskGroupId},
            {TaskGroupId: null}
          ],
          Effort: { [Op.ne]: 0 }
        }
      }
    } 
    else if (iTaskGroupId == -1 ) {
      criteria = {
        ParentTaskName: iTaskName,
        TaskLevel: 3,
        TaskGroupId: null,
        Effort: { [Op.ne]: 0 }
      }
    } 
    else {
      criteria = {
        ParentTaskName: iTaskName,
        TaskLevel: 3,
        Effort: { [Op.ne]: 0 }
      }
    }
    Task.findAll({
      include: [{
        model: TaskType, 
        attributes: ['Name'],
        where: {
          Name: { [Op.ne]: 'Pool' }
        }
      }],
      where: criteria
    }).then(async function(task) {
      if(task != null && task.length > 0) {
        var rtnTotalEffort = 0
        for(var i=0; i< task.length; i++){
          rtnTotalEffort = rtnTotalEffort + Number(task[i].Effort);
        }
        resolve(rtnTotalEffort);
      } else {
        resolve(0);
      }
    });
  })
}

router.post('/getPlanTaskSizeByParentTask', function(req, res, next) {
  console.log('Start to get plan task list by parent task name: ' + req.body.reqParentTaskName)
  var reqParentTaskName = req.body.reqParentTaskName;
  var reqTaskGroupId = Number(req.body.reqTaskGroupId);
  var reqTaskGroupFlag = Number(req.body.reqTaskGroupFlag);
  var criteria = {
    ParentTaskName: reqParentTaskName,
    TaskLevel: 3
  }
  if(reqTaskGroupId != null && reqTaskGroupId != '') {
    var groupCriteria = {}
    if(reqTaskGroupId == 0) {
      groupCriteria = {} 
    } 
    else if (reqTaskGroupId == -1) {
      groupCriteria = {
        TaskGroupId: null
      } 
    }
    else {
      if (reqTaskGroupFlag == 0) {
        groupCriteria = {
          TaskGroupId: reqTaskGroupId
        } 
      }
      if (reqTaskGroupFlag == 1) {
        groupCriteria = {
          [Op.or]: [
            {TaskGroupId: reqTaskGroupId},
            {TaskGroupId: null}
          ],
        } 
      }
    }
    var c = Object.assign(criteria, groupCriteria);
  }
  if (req.body.reqFilterAssignee != null && req.body.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(req.body.reqFilterAssignee)
  }
  if (req.body.reqFilterStatus != null && req.body.reqFilterStatus != '') {
    criteria.Status = req.body.reqFilterStatus
  }
  Task.findAll({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: criteria,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var resJson = {};
      resJson.task_list_total_size = tasks.length;
      return res.json(responseMessage(0, resJson, '')); 
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getPlanRegularTaskListByParentTask', function(req, res, next) {
  console.log('Start to get plan Regular task list by parent task name: ' + req.body.reqParentTaskName)
  var reqParentTaskName = req.body.reqParentTaskName;
  var reqTaskGroupId = Number(req.body.reqTaskGroupId);
  var reqTaskGroupFlag = Number(req.body.reqTaskGroupFlag);
  var reqPage = Number(req.body.reqPage);
  var reqSize = Number(req.body.reqSize);
  var criteria = {
    ParentTaskName: reqParentTaskName,
    TaskLevel: 3,
    TypeTag:{ [Op.eq]: 'Regular Task' }
  }
  if(reqTaskGroupId != null && reqTaskGroupId != '') {
    var groupCriteria = {}
    if(reqTaskGroupId == 0) {
      groupCriteria = {} 
    }
    else if (reqTaskGroupId == -1) {
      groupCriteria = {
        TaskGroupId: null
      } 
    }
    else {
      if (reqTaskGroupFlag == 0) {
        groupCriteria = {
          TaskGroupId: reqTaskGroupId
        } 
      }
      if (reqTaskGroupFlag == 1) {
        groupCriteria = {
          [Op.or]: [
            {TaskGroupId: reqTaskGroupId},
            {TaskGroupId: null}
          ],
        } 
      }
    }
    var c = Object.assign(criteria, groupCriteria);
  }
  if (req.body.reqFilterAssignee != null && req.body.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(req.body.reqFilterAssignee)
  }
  if (req.body.reqFilterStatus != null && req.body.reqFilterStatus != '') {
    criteria.Status = req.body.reqFilterStatus
  }
  Task.findAll({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: criteria,
    order: [
      ['createdAt', 'DESC']
    ],
    limit: reqSize,
    offset: reqSize * (reqPage - 1)
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var response = await generatePlanTaskList(tasks);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getPlanTaskListByParentTask', function(req, res, next) {
  console.log('Start to get plan task list by parent task name: ' + req.body.reqParentTaskName)
  var reqParentTaskName = req.body.reqParentTaskName;
  var reqTaskGroupId = Number(req.body.reqTaskGroupId);
  var reqTaskGroupFlag = Number(req.body.reqTaskGroupFlag);
  var reqPage = Number(req.body.reqPage);
  var reqSize = Number(req.body.reqSize);
  var criteria = {
    ParentTaskName: reqParentTaskName,
    TaskLevel: 3,
    TypeTag:{ [Op.ne]: 'Regular Task' }
  }
  if(reqTaskGroupId != null && reqTaskGroupId != '') {
    var groupCriteria = {}
    if(reqTaskGroupId == 0) {
      groupCriteria = {} 
    }
    else if (reqTaskGroupId == -1) {
      groupCriteria = {
        TaskGroupId: null
      } 
    }
    else {
      if (reqTaskGroupFlag == 0) {
        groupCriteria = {
          TaskGroupId: reqTaskGroupId
        } 
      }
      if (reqTaskGroupFlag == 1) {
        groupCriteria = {
          [Op.or]: [
            {TaskGroupId: reqTaskGroupId},
            {TaskGroupId: null}
          ],
        } 
      }
    }
    var c = Object.assign(criteria, groupCriteria);
  }
  if (req.body.reqFilterAssignee != null && req.body.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(req.body.reqFilterAssignee)
  }
  if (req.body.reqFilterStatus != null && req.body.reqFilterStatus != '') {
    criteria.Status = req.body.reqFilterStatus
  }
  Task.findAll({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: criteria,
    order: [
      ['createdAt', 'DESC']
    ],
    limit: reqSize,
    offset: reqSize * (reqPage - 1)
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var response = await generatePlanTaskList(tasks);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

function generatePlanTaskList(iTaskObjArray) {
  return new Promise(async (resolve, reject) => {
    var rtnResult = [];
    for (var i=0; i<iTaskObjArray.length; i++) {
      var resJson = {}
      resJson.task_id = iTaskObjArray[i].Id;
      resJson.task_name = iTaskObjArray[i].TaskName;
      resJson.task_parent_name = iTaskObjArray[i].ParentTaskName;
      resJson.task_level = iTaskObjArray[i].TaskLevel;
      resJson.task_desc = iTaskObjArray[i].Description;
      resJson.task_type_id = iTaskObjArray[i].task_type.Id;
      resJson.task_status = iTaskObjArray[i].Status;
      resJson.task_effort = iTaskObjArray[i].Effort;
      resJson.task_estimation = iTaskObjArray[i].Estimation;
      resJson.task_subtasks_estimation = await getSubTaskTotalEstimation(iTaskObjArray[i].TaskName);
      resJson.task_reference = iTaskObjArray[i].Reference;
      if(iTaskObjArray[i].Reference != null && iTaskObjArray[i].Reference != '') {
        resJson.task_reference_desc = await getTaskDescription(iTaskObjArray[i].Reference);
      } else {
        resJson.task_reference_desc = null;
      }
      resJson.task_group_id = iTaskObjArray[i].TaskGroupId;
      resJson.task_responsible_leader_id = iTaskObjArray[i].RespLeaderId;
      var assigneeId = iTaskObjArray[i].AssigneeId;
      if (assigneeId != null && assigneeId != '') {
        var assigneeName = await getUserById(assigneeId);
        resJson.task_assignee = assigneeName;
      } else {
        resJson.task_assignee = null;
      }
      var subTaskList = await getSubTasks(iTaskObjArray[i].TaskName);
      var resResult = [];
      if(subTaskList != null && subTaskList.length > 0) {
        for(var a=0; a<subTaskList.length; a++) {
          var resJson1 = {};
          resJson1.sub_task_id = subTaskList[a].Id;
          resJson1.sub_task_name = subTaskList[a].TaskName;
          resJson1.sub_task_status = subTaskList[a].Status;
          resJson1.sub_task_desc = subTaskList[a].Description;
          resJson1.sub_task_effort = subTaskList[a].Effort;
          resJson1.sub_task_estimation = subTaskList[a].Estimation;
          resJson1.sub_task_responsible_leader_id = subTaskList[a].RespLeaderId;
          var assigneeId1 = subTaskList[a].AssigneeId;
          if (assigneeId1 != null && assigneeId1 != '') {
            var assigneeName1 = await getUserById(assigneeId1);
            resJson1.sub_task_assignee = assigneeName1;
          } else {
            resJson1.sub_task_assignee = null;
          }
          resResult.push(resJson1)
        }
      }
      resJson.task_sub_tasks = resResult;
      rtnResult.push(resJson);  
    } 
    resolve(rtnResult);
  });
}

router.post('/updateTaskGroupForPlanTask', async function(req, res, next) {
  var reqTaskId = Number(req.body.reqTaskId);
  var reqTaskGroupId = Number(req.body.reqTaskGroupId);
  if(reqTaskGroupId == 0) {
    reqTaskGroupId = null;
  }
  Task.findOne({
    where: {
      Id: reqTaskId
    }
  }).then(async function(task) {
    if (task != null) {
      await task.update({TaskGroupId: reqTaskGroupId});
      Task.findAll({
        where: {
          ParentTaskName: task.TaskName
        }
      }).then(function(subTasks){
        Task.update({TaskGroupId: reqTaskGroupId}, {where: {ParentTaskName: task.TaskName}})
        return res.json(responseMessage(0, null, 'Task update task group successfully!'));
      });
    } else {
      return res.json(responseMessage(1, null, 'Task update task group fail!'));
    }
  });
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
      ['StartTime', 'DESC']
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
        var level3TaskCount = 0;
        var level4TaskCount = 0;
        if(taskGroupTasks != null && taskGroupTasks.length > 0) {
          for(var a=0; a<taskGroupTasks.length; a++){
            if(taskGroupTasks[a].TaskLevel == 3){
              level3TaskCount = level3TaskCount + 1;
            }
            if(taskGroupTasks[a].TaskLevel == 4){
              level4TaskCount = level4TaskCount + 1;
            }
          }
        }
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

function getLevelByUserId(iUserId){
    return new Promise((resolve,reject) =>{
      User.findOne({
        where:{
          Id:iUserId
        }
      }).then(async function(user){
        if(user!=null){
          //console.log(user.Level)
          resolve(user.Level)
        }else{
          resolve(0)
        }
      })
    }) 
}

function getNameByUserId(iUserId){
  return new Promise((resolve,reject) =>{
    User.findOne({
      where:{
        Id:iUserId
      }
    }).then(async function(user){
      if(user!=null){
        resolve(user.Name)
      }else{
        resolve(0)
      }
    })
  })
}

//2020/3/23 extractReport3ForWeb
router.post('/extractReport3ForWeb',function(req,res,next){
  console.log("extractReport3ForWeb")
  var reqReportStartMonth = req.body.wReportStartMonth;
  var reqReportStartDatetime = reqReportStartMonth + '-01 00:00:00'
  var reqReportEndMonth = req.body.wReportEndMonth;
  var reqReportEndDatetime = reqReportEndMonth + '-31 23:59:59'
  var rtnResult = [];
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: {
        Name: { [Op.ne]: 'Pool' }
      }
    }],
    where:{
      Id: { [Op.ne]: null },
      [Op.or] : [
        {[Op.and]: [
          { Creator:   { [Op.notLike]: 'PMT:%' }},
          { IssueDate: { [Op.gte]:  reqReportStartDatetime }},
          { IssueDate: { [Op.lte]:  reqReportEndDatetime }}
        ]},
        { Creator:   { [Op.like]: 'PMT:%' } }
      ]
    }
  }).then(async function(task){
    var userList = await getUserList()
    if(task != null && task.length>0){
      for(var i = 0 ;i<task.length;i++){
        var resJson = {};
        resJson.report_Id = task[i].Id
        resJson.report_parentTask = task[i].ParentTaskName
        resJson.report_tasklevel = task[i].TaskLevel
        resJson.report_tasknumber = task[i].TaskName
        resJson.report_customer = task[i].TopCustomer
        resJson.report_status = task[i].Status
        resJson.report_des = task[i].Description
        resJson.report_refpool = task[i].Reference
        if(task[i].RespLeaderId != null ){
          if(userList != null){
            var userIndex = getIndexOfValueInArr(userList, 'Id', task[i].RespLeaderId)
            resJson.report_resp = userIndex != -1? userList[userIndex].Name: ''
            resJson.report_resplevel = userIndex != -1? userList[userIndex].Level: ''
          }
        }else{
          resJson.report_resp = ''
          resJson.report_resplevel = ''
        }
        if(task[i].AssigneeId != null ){
          if(userList != null){
            var userIndex = getIndexOfValueInArr(userList, 'Id', task[i].AssigneeId)
            resJson.report_assignee = userIndex != -1? userList[userIndex].Name: ''
            resJson.report_assigneelevel = userIndex != -1? userList[userIndex].Level: ''
          }
        }else{
          resJson.report_assignee = ''
          resJson.report_assigneelevel = ''
        }
        resJson.report_issue = task[i].IssueDate
        resJson.report_oppn = task[i].TopOppName
        if(resJson.report_tasklevel == '1' || resJson.report_tasklevel == '2') {
          resJson.report_estimation = ''
          resJson.report_effort = ''
        } else {
          resJson.report_estimation = task[i].Estimation
          resJson.report_effort = task[i].Effort
        }
        resJson.report_subtasks_estimation = ''
        rtnResult.push(resJson)
      }
      rtnResult = sortArray(rtnResult, 'report_Id')
      return res.json(responseMessage(0, rtnResult, ''));
    }else{
      return res.json(responseMessage(1, null, 'Worklog not found'));
    }
  })
})

function getUserList() {
  return new Promise((resolve,reject) =>{
    User.findAll({
      attributes: ['Id', 'Name', 'Level'],
      where: {
        IsActive: 1
      }
    }).then(async function(users){
      if (users != null && users.length > 0) {
        resolve(users);
      } else {
        resolve(null);
      }
    });
  });
} 

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

function sortArray(iArray, iKey)
{
  var len = iArray.length;
  for (var i = 0; i < len; i++) {
    for (var j = 0; j < len - 1 - i; j++) {
      var itemI = iArray[j]
      var itemJ = iArray[j+1]
      if (itemI[iKey] < itemJ[iKey]) {      
        var temp = iArray[j+1];       
        iArray[j+1] = iArray[j];
        iArray[j] = temp;
      }
    }
  }
  return iArray;
}

function prefixZero(num, n) {
  return (Array(n).join(0) + num).slice(-n);
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

