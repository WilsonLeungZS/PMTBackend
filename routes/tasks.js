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
var Reference = require('../model/reference')
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

router.get('/getLv3TaskList', async function(req, res, next) {
  console.log('/getLv3TaskList!')
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  var taskCriteria = generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  if (req.query.reqSkill != null && req.query.reqSkill != ''){
    var reqParentTaskName = await getLv2BySkill(req.query.reqSkill)
    if(reqParentTaskName!=null){
      taskCriteria.ParentTaskName = {
        [Op.or] : reqParentTaskName
      }      
    }
  }
  if (req.query.reqOpportunity != null && req.query.reqOpportunity != ''){
    var reqParentTaskName = await getTasksByParentName(req.query.reqOpportunity)
    if(reqParentTaskName!=null){
      taskCriteria.ParentTaskName = {
        [Op.or] : reqParentTaskName
      }      
    }
  }
  console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
  console.log(taskCriteria)
  var orderSeq = [];
  if (Number(req.query.reqTaskLevel == 1)) {
    orderSeq = ['TopTargetStart', 'DESC']
  } else if (Number(req.query.reqTaskLevel == 3)){
    orderSeq = ['ParentTaskName']
  }
  else {
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
    //limit: reqSize
    // offset: reqSize * (reqPage - 1),    
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      console.log("---Number(req.query.reqTaskLevel == 3)--")
      var response = await generateTaskListByPath(tasks);
      console.log('Return Response ---------------------------------------->')
      console.log(response)
      console.log('Return Response ----------------------------------------<')
      console.log(req.query.reqOpportunity)
      for(var i = 0 ; i <response.length ; i ++){
        if(response[i][0].task_parent_name ===req.query.reqOpportunity){
          response2.push(response[i])
        }
        response[i][0].task_effort = await getSubTaskTotalEffortForPlanTask(response[i][0].task_name,req.query.reqCurrentTimeGroup,0)
        console.log(response[i][0].task_effort)
        response[i][0].task_subtasks_estimation =  await getSubTaskTotalEstimationForPlanTask(response[i][0].task_name,req.query.reqCurrentTimeGroup,0)
      }
      return res.json(responseMessage(0, response, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    } 
  })
});

router.post('/getSkillFromReference',function(req, res, next) {
  console.log('/getSkillFromReference')
  Reference.findOne({
    where:{Id:20},
  }).then(async function(reference){
    console.log(reference)
    if(reference!=null){
      var rtnResult = reference.Value.split(",")
    return res.json(responseMessage(1, rtnResult, ''));
    }else{
      return res.json(responseMessage(1, null, 'Failed to update reference'));
    }
  })
})

router.post('/saveSkillToReference',function(req, res, next) {
  console.log('/saveSkillToReference')
  var TaskSkill = JSON.parse(req.body.reqTaskSkill)
  Reference.findOne({
    where:{Id:20},
  }).then(async function(reference){
    console.log(reference)
    if(reference!=null){
      var resJson = {}
      resJson.reference_value = reference.Value.split(",")
      console.log()
      var resLen = resJson.reference_value.length
      for(var i = 0 ; i < TaskSkill.length ; i ++){
        var equal = false
        for(var j = 0 ; j < resLen ; j ++){
          if(TaskSkill[i] === resJson.reference_value[j]){
            equal = true
            break
          }
        }
        if(equal === false){
          resJson.reference_value.push(TaskSkill[i])
        }
      }
    var rtnResult =   await updateReference(resJson.reference_value)
    return res.json(responseMessage(1, rtnResult, ''));
    }else{
      return res.json(responseMessage(1, null, 'Failed to update reference'));
    }
  })
})

function updateReference(rValue){
  return new Promise(async (resolve,reject) => {
    Reference.update(
      {Value: rValue.toString()},
      {where: {Id: 20}}).then(function(reference) {
      if(reference != null) {
        resolve(reference);
      } else {
        resolve(null);
      }
    });      
  })
}



router.get('/getLv3TaskListForSingleTable', function(req, res, next) {
  console.log('/getLv3TaskListForSingleTable')
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  console.log(req.query)
  var taskCriteria = generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  var orderSeq = [];
  if (Number(req.query.reqTaskLevel == 3)){
    orderSeq = ['ParentTaskName']
  }
  else {
    orderSeq = ['createdAt', 'DESC']
  }
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      //where: taskTypeCriteria
    }],
    where: taskCriteria,
    order: [
      orderSeq
    ],
    limit: (reqSize - 1),
    offset: (reqSize - 1) * (reqPage - 1),    
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      console.log("---Number(req.query.reqTaskLevel == 3) for single table--")
      var response = await generateTaskListByPath(tasks);
      response[0][0].task_effort = await getSubTaskTotalEffortForPlanTask(response[0][0].task_name, req.query.reqCurrentTimeGroup, 0);;
      response[0][0].task_subtasks_estimation = await getSubTaskTotalEstimationForPlanTask(response[0][0].task_name, req.query.reqCurrentTimeGroup, 0);
      console.log(response)
      return res.json(responseMessage(0, response[0], ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    } 
  })
});

//1getTaskList. Get Task list for web PMT
router.get('/getTaskList', function(req, res, next) {
  console.log('/getTaskList')
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  var taskCriteria = generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  var orderSeq = [];
  if (Number(req.query.reqTaskLevel == 1)) {
    orderSeq = ['TopTargetStart', 'DESC']
  } else if (Number(req.query.reqTaskLevel == 3)&&Boolean(req.query.reqFilterShowRefPool)===false){
    orderSeq = ['ParentTaskName']
    reqSize = 10000000
  }
  else {
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

function getTaskByName(itaskName){
  return new Promise(async (resolve,reject) => {
    Task.findOne({
      where: {
        TaskName: itaskName
      }
    }).then(function(tasks) {
      if(tasks != null) {
        resolve(tasks);
      } else {
        resolve(null);
      }
    });      
  })
}

function generateTaskListByPath(iTaskObjArray) {
  return new Promise(async (resolve, reject) => {
    var lv2TaskList = []
    var lv2TaskListInfo = []
    var rtnResult = []  
    iTaskObjArray = await generatePlanTaskList(iTaskObjArray);
    for(var i = 0 ; i <iTaskObjArray.length ; i++){
      if(!lv2TaskList.includes(iTaskObjArray[i].task_parent_name)){
        lv2TaskList.push(iTaskObjArray[i].task_parent_name)
      }
    }
    for(var i = 0 ; i< lv2TaskList.length; i ++){
      lv2TaskListInfo.push(await getTaskByName(lv2TaskList[i])); 

    }
    lv2TaskListInfo = await generatePlanTaskList(lv2TaskListInfo);
    for(var j = 0 ; j < lv2TaskListInfo.length ; j ++){
      var resArr = []
      resArr.push(lv2TaskListInfo[j])
      for(var i = 0 ; i < iTaskObjArray.length ; i ++){
        if(iTaskObjArray[i].task_parent_name === lv2TaskListInfo[j].task_name){
          resArr.push(iTaskObjArray[i])
        }
      }
      resArr[0].task_length = resArr.length-1
      resArr[0].task_table_loading = false
      resArr[0].task_current_page = 1
      resArr[0].task_page_size = 20
      resArr = resArr.sort((a,b) => a.task_id-b.task_id)
      rtnResult.push(resArr)
    }
    resolve(rtnResult)
  });
}


router.get('/getTaskListTotalSize', async function(req, res, next) {
  console.log('getTaskListTotalSize')
  console.log(req.query)
  var taskCriteria =  generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  if (req.query.reqSkill != null && req.query.reqSkill != ''){
    var reqParentTaskName = await getLv2BySkill(req.query.reqSkill)
    console.log(reqParentTaskName)
    if(reqParentTaskName!=null){
      taskCriteria.ParentTaskName = {
        [Op.or] : reqParentTaskName
      }      
    }
  }
  if (req.query.reqOpportunity != null && req.query.reqOpportunity != ''){
    var reqParentTaskName = await getTasksByParentName(req.query.reqOpportunity)
    if(reqParentTaskName!=null){
      taskCriteria.ParentTaskName = {
        [Op.or] : reqParentTaskName
      }      
    }
  }
  console.log(taskCriteria)
  console.log(taskTypeCriteria)
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: taskTypeCriteria
    }],
    where: taskCriteria
  }).then(async function(tasks) {
    console.log(tasks)
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
    //TaskName: {[Op.notLike]: 'Dummy - %'},
    TaskLevel: reqTaskLevel,
    //Id: { [Op.ne]: null },
  }
  if (iReq.query.reqFilterShowRefPool != null && iReq.query.reqFilterShowRefPool != '') {
      if (iReq.query.reqFilterShowRefPool != 'true') {
        criteria.TypeTag = {[Op.or]: [{[Op.ne]: 'Regular Task'}, null]}
      }
    }
  if(iReq.query.reqCurrentTimeGroup != null){
    if (iReq.query.reqCurrentTimeGroup!='' &&!iReq.query.reqCurrentTimeGroup.includes('All') && !iReq.query.reqCurrentTimeGroup.includes('null') && !iReq.query.reqCurrentTimeGroup.includes('0') ){
      criteria.TaskGroupId = {[Op.in]: iReq.query.reqCurrentTimeGroup}
    }else if(iReq.query.reqCurrentTimeGroup.includes('0') || iReq.query.reqCurrentTimeGroup.includes('null') ){
      criteria.TaskGroupId = null
    }    
  }      
  if(iReq.query.reqParentTaskName != null && iReq.query.reqParentTaskName != ''){
    criteria.ParentTaskName = iReq.query.reqParentTaskName 
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
  if (iReq.query.reqLeadingBy != null&&iReq.query.reqLeadingBy!='') {
    criteria.RespLeaderId = iReq.query.reqLeadingBy
  }
  return criteria
}

function getLv2BySkill(reqSkill) {
  return new Promise(async (resolve, reject) => {
    console.log(reqSkill)
    var rtnResult = []  
    Task.findAll({
      where: {
        Skill : { [Op.like]: '%'+reqSkill+'%'} , 
        TaskLevel : 2
      }
      }).then(async function(tasks) {
        if(tasks != null && tasks.length > 0) {
          for (var i = 0 ; i < tasks.length ; i ++){
            rtnResult.push(tasks[i].TaskName)
          }
          resolve(rtnResult)
      }else{
        resolve(null)
      }
    })
  });
}

function getTasksByParentName(iParentTaskName) {
  return new Promise(async (resolve, reject) => {
    var rtnResult = []  
    Task.findAll({
      where: {
        ParentTaskName :  iParentTaskName , 
        TaskLevel : 2
      }
      }).then(async function(tasks) {
        if(tasks != null && tasks.length > 0) {
          for (var i = 0 ; i < tasks.length ; i ++){
            rtnResult.push(tasks[i].TaskName)
          }
          resolve(rtnResult)
      }else{
        resolve(null)
      }
    })    
  });      
}

function getLv1ByOppname(reqOpp) {
  return new Promise(async (resolve, reject) => {
    console.log(reqOpp)
    var rtnResult = []  
    Task.findAll({
      where: {
        TopOppName :  {[Op.in]:'%'+reqOpp+'%'} , 
        TaskLevel : 1
      }
      }).then(async function(tasks) {
        console.log(tasks)
        if(tasks != null && tasks.length > 0) {
          for (var i = 0 ; i < tasks.length ; i ++){
            rtnResult = await getTasksByParentName(tasks[i].TaskName)
          }
          resolve(rtnResult)
      }else{
        resolve(null)
      }
    })
  });
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

function getTimeGroupById(TimeGroupId) {
  return new Promise((resolve, reject) => {
    TaskGroup.findOne({
      where: {
        Id: TimeGroupId
      }
    }).then(function(taskgroup) {
      if(taskgroup != null) {
        resolve(taskgroup)
      } else {
        resolve(null);
      }
    });
  });
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
      var timegroupId = iTaskObjArray[i].TaskGroupId;
      if (timegroupId != null && timegroupId!= ''){
        timegroupId= await getTimeGroupById(timegroupId);
      }
      resJson.task_group_id = timegroupId
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
    if(task != null) {
      var response = await generateTaskInfo(task);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getTasksByParentName', function(req, res, next) {
  console.log('Start to get tasks by ParentName: ' + req.body.reqParentTaskName)
  var rtnResult =  []
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      ParentTaskName: req.body.reqParentTaskName
    }
  }).then(async function(iTaskObjArray) {
    if(iTaskObjArray != null && iTaskObjArray.length>0) {
      for(var i = 0 ; i < iTaskObjArray.length ; i ++){
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
      return res.json(responseMessage(0, rtnResult, '')); 
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getTaskTypeByName', function(req, res, next) {
  Task.findOne({
    include: [{
      model: TaskType, 
      attributes: ['Name','Id']
    }],
    where: {
      TaskName: req.body.reqTaskName 
    }
  }).then(function(task) {
    if (task != null) {
      console.log(task.task_type)
      var response = task.task_type.Id
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  });
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
    resJson.task_skill = iTask.Skill
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
    resJson.task_TypeTag = iTask.TypeTag
    resJson.task_table_loading = false
    resJson.task_current_page = 1
    resJson.task_page_size = 20    
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
      TypeTag:{[Op.or]: [{[Op.ne]: 'Regular Task'}, null]}
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

router.get('/countByTaskGroup', function(req, res, next) {
  console.log('countByTaskGroup')
  var reqTaskGroupId = Number(req.query.reqTaskGroupId);
  Task.findAll({
    where: {
        TaskGroupId : reqTaskGroupId,
        TaskLevel : 3,
        Status : {[Op.ne] : 'Drafting'}
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(tasks) {
      if(tasks != null && tasks.length > 0) {
        var rtnResult = {
          planningC : 0,
          runningC : 0,
          doneC :0,
          draftingC:0       
        }
        for(var i = 0 ; i < tasks.length ; i++){
          if(tasks[i].Status === 'Planning'){
            rtnResult.planningC ++
          }else if(tasks[i].Status === 'Running'){
            rtnResult.runningC ++
          }else if(tasks[i].Status === 'Done'){
            rtnResult.doneC ++
          }else {
            rtnResult.draftingC ++
          }
        }
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});


async function saveTask(req, res) {
  var reqTask = JSON.parse(req.body.reqTask);
  var reqTaskName = reqTask.task_name;
  var reqTaskParent = reqTask.task_parent_name;
  var reqTaskSkill = null
  if((reqTaskName == null || reqTaskName == '') && reqTaskParent != 'N/A'){
    reqTaskName = await getSubTaskName(reqTaskParent);
  }
  console.log(reqTask)
  if(Number(reqTask.task_level) === 2){
    reqTaskSkill = reqTask.task_skill.toString()
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
    Skill: reqTaskSkill
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

          if(reqTask.task_TypeTag == 'Regular Task'){
            await Task.update( {Status: reqTask.task_status }, { where: { ParentTaskName: reqTaskName } });
  
            Schedule.update({ Status: reqTask.task_status }, { where: { TaskName: reqTaskName } });
            
            if(reqTask.task_status == 'Running') taskItems.createTaskByScheduleJob(reqTaskName);
  
            if(reqTask.task_status == 'Done'){
              Schedule.findAll({
                attributes: ['JobId'],
                where: { 
                  TaskName: reqTaskName
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
                Schedule.update( {Status: 'Done'}, {where: {JobId: tempJobId} });
              });
            }
          }
        }
        console.log('Task ' + reqTaskName + ' status is ' + reqTask.task_status);
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
        resJson.task_type_tag = task[i].TypeTag;
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
router.post('/getLevel2TaskListByParentTask', function(req, res, next) {
  console.log('Start to get level 2 task by parent task name: ' + req.body.reqParentTaskName)
  var reqTaskGroupId = Number(req.body.reqTaskGroupId);
  var reqPage = Number(req.body.reqPage);
  var reqSize = Number(req.body.reqSize);
  var reqTaskGroupFlag = Number(req.body.reqTaskGroupFlag);
  Task.findAll({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: {
      ParentTaskName: req.body.reqParentTaskName,
      TaskLevel: 2,
      //Status: {[Op.ne]: 'Drafting'}
    },
    order: [
      ['createdAt', 'DESC']
    ],
    limit: reqSize,
    offset: reqSize * (reqPage - 1)
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
    rtnResult = rtnResult.sort((a,b) => a.task_id-b.task_id) 
    resolve(rtnResult);
  });
}

router.get('/refreshLevel2TaskSubEstimation', function(req, res, next) {
  console.log('Start to refresh level 2 task sub est');
  console.log(req.query)
  var reqTaskId = Number(req.query.reqTaskId);
  var reqTaskGroupFlag = Number(req.query.reqTaskGroupFlag);
  Task.findOne({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: {
      Id: reqTaskId
    }
  }).then(async function(task) {
    if(task != null) {
      var resJson = {}
      resJson.task_subtasks_estimation = await getSubTaskTotalEstimationForPlanTask(task.TaskName, req.query.reqTaskGroupId, reqTaskGroupFlag);
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
    console.log('getSubTaskTotalEstimationForPlanTask')
    var criteria = '';
    if (iTaskGroupId > 0 ) {
      if (iTaskGroupFlag == 0) {
        if(iTaskGroupId.length == 1){
          criteria = ' where raw_data.TaskGroupId = ' + iTaskGroupId
        }else{
          criteria = ' where raw_data.TaskGroupId in ' + iTaskGroupId
        }
      }
      if (iTaskGroupFlag == 1) {
        if(iTaskGroupId.length == 1){
          criteria = ' where (raw_data.TaskGroupId = ' + iTaskGroupId + ' or raw_data.TaskGroupId is null)'
        }else{
          criteria = ' where (raw_data.TaskGroupId in ' + iTaskGroupId + ' or raw_data.TaskGroupId is null)'
        }        
      }
    } 
    else if (iTaskGroupId.length == 0 ) {
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
    console.log('getSubTaskTotalEffortForPlanTask')
    var criteria = {TypeTag : { [Op.ne]: 'Regular Task' },}
    if (iTaskGroupId.length > 0 ) {
      if (iTaskGroupFlag == 0) {
        criteria = {
          ParentTaskName: iTaskName,
          TaskLevel: 3,
          TaskGroupId: { [Op.in]: iTaskGroupId },
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
    else if (iTaskGroupId.length == 0 ) {
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
    console.log(criteria)
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
          console.log(rtnTotalEffort)
        }
        resolve(rtnTotalEffort);
      } else {
        resolve(0);
      }
    });
  })
}

router.get('/getPlanTaskSizeByParentTask', function(req, res, next) {
  console.log('Start to get plan task Size by parent task name: ' + req.query.reqParentTaskName)
  var reqParentTaskName = req.query.reqParentTaskName;
  var reqTaskGroupFlag = Number(req.query.reqTaskGroupFlag);
  var criteria = {
    ParentTaskName: reqParentTaskName,
    TaskLevel: 3
  }
  if(req.query.reqCurrentTimeGroup != null){
    if (!req.query.reqCurrentTimeGroup.includes('All') && !req.query.reqCurrentTimeGroup.includes('null') && !req.query.reqCurrentTimeGroup.includes('0') ){
      criteria.TaskGroupId = {[Op.in]: req.query.reqCurrentTimeGroup}
    }else if(req.query.reqCurrentTimeGroup.includes('0') || req.query.reqCurrentTimeGroup.includes('null') ){
      criteria.TaskGroupId = null
    }    
  }
  if (req.query.reqFilterAssignee != null && req.query.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(req.query.reqFilterAssignee)
  }
  if (req.query.reqLeadingBy != null && req.query.reqLeadingBy != '') {
    criteria.RespLeaderId = Number(req.query.reqLeadingBy)
  }
  if (req.query.reqFilterStatus != null && req.query.reqFilterStatus != '') {
    criteria.Status = req.query.reqFilterStatus
  }
  console.log(criteria)
  Task.findAll({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: criteria,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(tasks) {
    console.log(tasks)
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

router.get('/getPlanTaskListByParentTask', function(req, res, next) {
  console.log('Start to get plan task list by parent task name: ' + req.query.reqParentTaskName)
  var reqParentTaskName = req.query.reqParentTaskName;
  var reqTaskGroupFlag = Number(req.query.reqTaskGroupFlag);
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  var criteria = {
    ParentTaskName: reqParentTaskName,
    TaskLevel: 3,
    TypeTag:{[Op.or]: [{[Op.ne]: 'Regular Task'}, null]}
  }
  if (req.query.reqCurrentTimeGroup != null && !req.query.reqCurrentTimeGroup.includes('null') && !req.query.reqCurrentTimeGroup.includes('0') && !req.query.reqCurrentTimeGroup.includes('All')){
    criteria.TaskGroupId = {[Op.in]: req.query.reqCurrentTimeGroup}
  }else if(req.query.reqCurrentTimeGroup.includes('0') || req.query.reqCurrentTimeGroup.includes('null')){
    criteria.TaskGroupId = null
  }
  if (req.query.reqFilterAssignee != null && req.query.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(req.query.reqFilterAssignee)
  }
  if (req.query.reqLeadingBy != null && req.query.reqLeadingBy != '') {
    criteria.RespLeaderId = Number(req.query.reqLeadingBy)
  }
  if (req.query.reqFilterStatus != null && req.query.reqFilterStatus != '') {
    criteria.Status = req.query.reqFilterStatus
  }
  console.log(criteria)
  Task.findAll({
    include: [{model: TaskType, attributes: ['Id', 'Name']}],
    where: criteria,
    order: [
      ['ParentTaskName']
    ],
    // limit: reqSize,
    // offset: reqSize * (reqPage - 1)
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var response = await generatePlanTaskList(tasks);
      var res2 = await getTaskByName(reqParentTaskName)
      var response2 = []
      response2.push(res2)
      response2 = await generatePlanTaskList(response2)
      for(var i = 0 ; i < response.length ;i ++){   
        response2.push(response[i])
      }
      response2[0].task_effort = await getSubTaskTotalEffortForPlanTask(response2[0].task_name, req.query.reqCurrentTimeGroup, 0);
      response2[0].task_subtasks_estimation = await getSubTaskTotalEstimationForPlanTask(response2[0].task_name,req.query.reqCurrentTimeGroup,0)
      response2[0].task_length = response2.length-1
      response2[0].task_table_loading = false
      response2[0].task_current_page = 1
      response2[0].task_page_size = 20
      console.log('Debug -------------<')
      console.log(response2)
      console.log('Debug -------------->')      
      return res.json(responseMessage(0, response2, ''));  
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
      resJson.task_status = iTaskObjArray[i].Status;
      resJson.task_effort = iTaskObjArray[i].Effort;
      resJson.task_skill = iTaskObjArray[i].Skill;
      resJson.task_type_id = iTaskObjArray[i].TaskTypeId;
      resJson.task_estimation = iTaskObjArray[i].Estimation;
      resJson.task_subtasks_estimation = await getSubTaskTotalEstimation(iTaskObjArray[i].TaskName);
      resJson.task_reference = iTaskObjArray[i].Reference;
      if(iTaskObjArray[i].Reference != null && iTaskObjArray[i].Reference != '') {
        resJson.task_reference_desc = await getTaskDescription(iTaskObjArray[i].Reference);
      } else {
        resJson.task_reference_desc = null;
      }
      var timegroupId = iTaskObjArray[i].TaskGroupId;
      if (timegroupId != null && timegroupId!= ''){
        var rtnTaskGroup =  await getTimeGroupById(timegroupId);
        resJson.group_id = rtnTaskGroup.Id
        resJson.group_name = rtnTaskGroup.Name
        timegroupId = resJson.group_name
      }
      resJson.task_group_id = timegroupId
      resJson.task_responsible_leader_id = iTaskObjArray[i].RespLeaderId;
      var assigneeId = iTaskObjArray[i].AssigneeId;
      if (assigneeId != null && assigneeId != '') {
        var assigneeName = await getUserById(assigneeId);
        resJson.task_assignee = assigneeName;
      } else {
        resJson.task_assignee = null;
      }
      var resResult = [];
      if(iTaskObjArray[i].TaskLevel!=2){
        //resJson.task_type_id = await getTaskType(iTaskObjArray[i].TaskName);
        resJson.task_TypeTag = iTaskObjArray[i].TypeTag;
        resJson.task_deliverableTag = iTaskObjArray[i].DeliverableTag;
        resJson.task_type_id = iTaskObjArray[i].TaskTypeId;
        var subTaskList = await getSubTasks(iTaskObjArray[i].TaskName);
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

function getNowFormatDate() {//获取当月时间 yyyy-MM-dd
  var currentDate = {}
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var strDate = date.getDate();
  if (strDate >= 1 && strDate <= 9) {
    strDate = '0' + strDate ;
  }
  if ( month == 2 ){
    currentDate.StartTime = Number(year-1) + '-' + '12' + '-' + strDate
    currentDate.EndTime = year + '-' + '04' + '-' + strDate  
  }else if ( month == 1 ){
    currentDate.StartTime = Number(year-1) + '-' + '11' + '-' + strDate  
    currentDate.EndTime = year + '-' + '03' + '-' + strDate  
  }else if ( month == 11 ){
    currentDate.StartTime = year + '-' + '09' + '-' + strDate 
    currentDate.EndTime = Number(year+1) + '-' + '01' + '-' + strDate        
  }else if ( month == 12 ){
    currentDate.StartTime = year + '-' + '10' + '-' + strDate 
    currentDate.EndTime = Number(year+1) + '-' + '02' + '-' + strDate        
  }else{
    currentDate.StartTime = year + '-' + '0' + Number(month-2) + '-' + strDate 
    if(month>=3&&month<=7){
      currentDate.EndTime = year + '-' + '0' + Number(month+2) + '-' + strDate   
    }else{
      currentDate.EndTime = year + '-' + Number(month+2) + '-' + strDate 
    } 
  }
  return currentDate;
}

//Task Group
router.get('/getTaskGroup', function(req, res, next) {
  var rtnResult = [];
  var groupCriteria = {}
  if( req.query.tGroupId != "0"){
    groupCriteria = { 
      Id: req.query.tGroupId,
      //RelatedTaskName: req.query.tGroupRelatedTask,
      //EndTime: {[Op.gt]: req.query.tToday},
      //RelatedTaskName: { [Op.or]: [null ,'']  },
    };
  } else {
    if(req.query.isShowCurrent === 'true'){
      if(req.query.isShowRelate === 'true'){
        var today = getNowFormatDate ()
        groupCriteria = { 
          Id: { [Op.ne]: null },
          //RelatedTaskName: req.query.tGroupRelatedTask,
          EndTime: {[Op.lte]: today.EndTime},
          StartTime: {[Op.gte]: today.StartTime}
        };           
      }else{
        var date = new Date();
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var strDate = date.getDate();
        if (strDate >= 1 && strDate <= 9) {
          strDate = '0' + strDate ;
        }
        if(month >=1 && month <=9){
          month = '0' + month ;
        }        
        var today = year + '-' + month + '-' + strDate 
        groupCriteria = { 
          Id: { [Op.ne]: null },
          //RelatedTaskName: req.query.tGroupRelatedTask,
          EndTime: {[Op.gte]: today},
          StartTime: {[Op.lte]: today}
        };          
      }
    }else{
      groupCriteria = { 
        Id: { [Op.ne]: null },
        RelatedTaskName: { [Op.or]: [null ,'']  },
      };         
    }
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
        resJson.group_group_dis = false
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

