/*
 * @Description: API route handle task related request
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */

var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var Utils = require('../util/utils');

var Task = require('../models/task');
var User = require('../models/user');
var Sprint = require('../models/sprint');
var Reference = require('../models/reference');
var Timeline = require('../models/timeline');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
  return res.json({message: 'Response task resource'});
});

// Get task list count
router.get('/getTasksListCount', async function(req, res, next) {
  var criteria = {
    Status: {[Op.ne]: 'Obsolete'}
  }
  // Assignee id criteria
  var reqAssigneeId = req.query.reqAssigneeId;
  if (reqAssigneeId != null && reqAssigneeId != '') {
    criteria.AssigneeId = reqAssigneeId;
    var reqDate = req.query.reqDate;
    if (reqDate != null && reqDate != '') {
      var sprintIdArray = await Utils.getSprintIdByDateAndUserId(reqDate, reqAssigneeId);
      console.log('sprintIdArray -> ', sprintIdArray);
      if (sprintIdArray != null && sprintIdArray.length > 0) {
        criteria.SprintId = {
          [Op.in]: sprintIdArray
        }
      } else {
        return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
      }
    }
  }
  Task.count({
    where: criteria
  }).then(async function(result) {
    return res.json(Utils.responseMessage(0, result, ''));
  })
});

// Get task list
router.get('/getTasksList', async function(req, res, next) {
  var reqSize = Number(req.query.reqSize);
  var reqPage = Number(req.query.reqPage);
  var criteria = {
    Status: {[Op.ne]: 'Obsolete'}
  }
  // Assignee id criteria
  var reqAssigneeId = req.query.reqAssigneeId;
  if (reqAssigneeId != null && reqAssigneeId != '') {
    criteria.AssigneeId = reqAssigneeId;
    var reqDate = req.query.reqDate;
    if (reqDate != null && reqDate != '') {
      var sprintIdArray = await Utils.getSprintIdByDateAndUserId(reqDate, reqAssigneeId);
      if (sprintIdArray != null && sprintIdArray.length > 0) {
        criteria.SprintId = {
          [Op.in]: sprintIdArray
        }
      } else {
        return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
      }
    }
  }
  Task.findAll({
    include: [
      {
        model: User, 
        attributes: ['Id', 'Name', 'Nickname', 'WorkingHrs']
      },
      {
        model: Sprint
      },
    ],
    where: criteria,
    limit: reqSize,
    offset: reqSize * (reqPage - 1),
    order: [
      ['IssueDate', 'DESC']
    ]
  }).then(async function(tasks) {
    if (tasks != null && tasks.length > 0) {
      var responseTasks = await Utils.generateResponseTasksInfo(tasks);
      return res.json(Utils.responseMessage(0, responseTasks, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No task exist'));
    }
  })
});

// Get task list count by skill
router.post('/getTasksListCountBySkill', function(req, res, next) {
  var criteria = { SprintId: null };
  // Show Done task nor not
  var reqShowDoneTask = req.body.reqShowDoneTask;
  console.log('reqShowDoneTask -> ', reqShowDoneTask);
  if (reqShowDoneTask == 'true') {
    criteria.Status = {[Op.notIn]: ['Obsolete']}
  } else {
    criteria.Status = {[Op.notIn]: ['Done', 'Obsolete']}
  }
  var andCriteria = {}
  var andCriteriaArray = []
  // Skill criteria
  var reqSkillsArray = req.body.reqSkillsArray;
  if (reqSkillsArray != null && reqSkillsArray != '') {
    var skills = [];
    var skillsArray = reqSkillsArray.split(',');
    for (var i=0; i<skillsArray.length; i++) {
      skills.push({RequiredSkills: {[Op.like]:'%#' + skillsArray[i] + '#%'}})
    }
    var skillsCriteria = {
      [Op.or]: skills
    }
    andCriteriaArray.push(skillsCriteria);
  }
  // Customer criteria
  var reqCustomersArray = req.body.reqTaskCustomer;
  if (reqCustomersArray != null && reqCustomersArray != '') {
    var customersArray = reqCustomersArray.split(',');
    criteria.CustomerId = {[Op.in]: customersArray}
  }
  // Keyword criteria
  var reqTaskKeyword = req.body.reqTaskKeyword;
  if (reqTaskKeyword != null && reqTaskKeyword != '') {
    var taskKeywordCriteria = {
      [Op.or]: [
        {Name: {[Op.like]:'%' + reqTaskKeyword + '%'}},
        {Title: {[Op.like]:'%' + reqTaskKeyword + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyword + '%'}},
      ]
    }
    andCriteriaArray.push(taskKeywordCriteria);
  }
  if (andCriteriaArray != null && andCriteriaArray.length > 0) {
    andCriteria = {
      [Op.and]: andCriteriaArray
    }
    Object.assign(criteria, andCriteria);
  }
  Task.count({
    where: criteria
  }).then(async function(result) {
    return res.json(Utils.responseMessage(0, result, ''));
  })
});

// Get task list by skill
router.post('/getTasksListBySkill', function(req, res, next) {
  var reqSize = Number(req.body.reqSize);
  var reqPage = Number(req.body.reqPage);
  var criteria = { SprintId: null };
  // Show Done task nor not
  var reqShowDoneTask = req.body.reqShowDoneTask;
  if (reqShowDoneTask == 'true') {
    criteria.Status = {[Op.notIn]: ['Obsolete']}
  } else {
    criteria.Status = {[Op.notIn]: ['Done', 'Obsolete']}
  }
  var andCriteria = {}
  var andCriteriaArray = []
  // Skill criteria
  var reqSkillsArray = req.body.reqSkillsArray;
  if (reqSkillsArray != null && reqSkillsArray != '') {
    var skills = [];
    var skillsArray = reqSkillsArray.split(',');
    for (var i=0; i<skillsArray.length; i++) {
      skills.push({RequiredSkills: {[Op.like]:'%#' + skillsArray[i] + '#%'}})
    }
    var skillsCriteria = {
      [Op.or]: skills
    }
    andCriteriaArray.push(skillsCriteria);
  }
  // Customer criteria
  var reqCustomersArray = req.body.reqTaskCustomer;
  if (reqCustomersArray != null && reqCustomersArray != '') {
    var customersArray = reqCustomersArray.split(',');
    criteria.CustomerId = {[Op.in]: customersArray}
  }
  // Keyword criteria
  var reqTaskKeyword = req.body.reqTaskKeyword;
  if (reqTaskKeyword != null && reqTaskKeyword != '') {
    var taskKeywordCriteria = {
      [Op.or]: [
        {Name: {[Op.like]:'%' + reqTaskKeyword + '%'}},
        {Title: {[Op.like]:'%' + reqTaskKeyword + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyword + '%'}},
      ]
    }
    andCriteriaArray.push(taskKeywordCriteria);
  }
  if (andCriteriaArray != null && andCriteriaArray.length > 0) {
    andCriteria = {
      [Op.and]: andCriteriaArray
    }
    Object.assign(criteria, andCriteria);
  }
  Task.findAll({
    where: criteria,
    limit: reqSize,
    offset: reqSize * (reqPage - 1),
    order: [
      ['IssueDate', 'DESC']
    ]
  }).then(async function(tasks) {
    if (tasks != null && tasks.length > 0) {
      var responseTasks = await Utils.generateResponseTasksInfo(tasks);
      return res.json(Utils.responseMessage(0, responseTasks, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No task exist'));
    }
  })
});

// Get task by id
router.get('/getTaskById', function(req, res, next) {
  var reqTaskId = Number(req.query.reqTaskId);
  Task.findOne({
    include: [{
      model: User, 
      attributes: ['Id', 'Name', 'Nickname', 'WorkingHrs']
    },
    {
      model: Sprint
    }],
    where: {
      Id: reqTaskId
    }
  }).then(async function(task) {
    if (task != null) {
      var tasks = [task]
      var responseTasks = await Utils.generateResponseTasksInfo(tasks);
      return res.json(Utils.responseMessage(0, responseTasks[0], ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No task exist'));
    }
  })
});

// Get task title by name
router.get('/getTaskByName', function(req, res, next) {
  var reqTaskName = req.query.reqTaskName;
  Task.findOne({
    where: {
      Name: reqTaskName
    }
  }).then(async function(task) {
    if (task != null) {
      var tasks = [task]
      var responseTasks = await Utils.generateResponseTasksInfo(tasks);
      return res.json(Utils.responseMessage(0, responseTasks[0], ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No task exist'));
    }
  })
});

// Get task list by ReferenceTask
router.get('/getTaskListByReferenceTask', function(req, res, next) {
  Task.findAll({
    include: [{
      model: Sprint,
      include: [{
          model: Timeline, 
        },
      ],
    }],
    where: {
      ReferenceTask: req.query.referenceTask
    },
  }).then(async function(tasks) {
    if (tasks != null && tasks.length > 0) {
      let data = [];
      let record = {};
      tasks.forEach((item)=>{
        if(record[item.SprintId] || record[item.SprintId] == 0){
          data[record[item.SprintId]].push(item)
        }else{
          record[item.SprintId] = data.length
          data.push([item])
        }
      })
      return res.json(Utils.responseMessage(0, data, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No task exist'));
    }
  })
});

// Get tasks list by name
router.get('/getSubtasksListByName', function(req, res, next) {
  var reqTaskName = req.query.reqTaskName;
  Task.findAll({
    include: [{
      model: User, 
      attributes: ['Id', 'Name', 'Nickname']
    }],
    where: {
      ParentTaskName: reqTaskName
    },
    order: [
      ['IssueDate', 'ASC']
    ]
  }).then(async function(tasks) {
    if (tasks != null && tasks.length > 0) {
      var responseTasks = [];
      for (var i=0; i<tasks.length; i++) {
        var resJson = {}
        resJson.subtaskId = tasks[i].Id;
        resJson.subtaskParentTaskName = tasks[i].ParentTaskName;
        resJson.subtaskName = tasks[i].Name;
        resJson.subtaskCategory = tasks[i].Category;
        resJson.subtaskTitle = tasks[i].Title;
        resJson.subtaskStatus = tasks[i].Status;
        resJson.subtaskEffort = tasks[i].Effort;
        resJson.subtaskEstimation = tasks[i].Estimation;
        resJson.subtaskAssigneeId = tasks[i].AssigneeId;
        resJson.subtaskAssignee = tasks[i].user != null ? tasks[i].user.Name: null;
        resJson.subtaskRequiredSkills = Utils.handleSkillsArray(tasks[i].RequiredSkills).split(',').map(Number);
        responseTasks.push(resJson);
      }
      return res.json(Utils.responseMessage(0, responseTasks, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sub task exist'));
    }
  })
});

// Remove Task
router.post('/removeTask', async function(req, res, next) {
  var reqTaskId = req.body.reqTaskId;
  var reqTaskParentTaskName = req.body.reqTaskParentTaskName;
  Task.findOne({
    where: {
      Id: reqTaskId,
      Effort: 0
    }
  }).then(async function(task) {
    if (task != null) {
      await task.destroy();
      var hasSubtask = false;
      if (reqTaskParentTaskName != null && reqTaskParentTaskName != '') {
        hasSubtask = await updateTaskhasSubtaskInd(reqTaskParentTaskName);
      }
      if (hasSubtask) {
        return res.json(Utils.responseMessage(0, {hasSubtask: true}, 'Remove task successfully'));
      } else {
        return res.json(Utils.responseMessage(0, {hasSubtask: false}, 'Remove task successfully'));
      }
    } else {
      return res.json(Utils.responseMessage(1, null, 'No task exist/ Task has effort'));
    }
  })
});


// Create or update task assignee
router.post('/updateTaskAssignee', async function(req, res, next) {
  console.log('Start to create or update task');
  var reqTaskAssigneeId = null;
  if (req.body.reqTaskAssigneeId != '' && req.body.reqTaskAssigneeId != null) {
    reqTaskAssigneeId = req.body.reqTaskAssigneeId
  }
  Task.update({
    AssigneeId: reqTaskAssigneeId
  }, {
    where: {
      Id: req.body.reqTaskId
    }
  }).then(function (task) {
    if (task != null) {
      return res.json(Utils.responseMessage(0, task, 'udpate task assignee successfully!'));
    } else {
      return res.json(Utils.responseMessage(1, null, 'udpate task assignee fail!'));
    }
  });
});


// Create or update task
router.post('/updateTask', async function(req, res, next) {
  console.log('Start to create or update task');
  var reqTaskObj = await generateRequestTaskObject(req.body);
  Task.findOrCreate({
    where: {
      Id: req.body.reqTaskId
    }, 
    defaults: reqTaskObj
  }).spread(async function(task, created) {
    if(created) {
      await updateTaskhasSubtaskInd(reqTaskObj.ParentTaskName);
      return res.json(Utils.responseMessage(0, task, 'Create task successfully!'));
    } 
    else if(task != null && !created) {
      await task.update(reqTaskObj);
      await updateTaskhasSubtaskInd(reqTaskObj.ParentTaskName);
      return res.json(Utils.responseMessage(0, task, 'Update task successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated task fail!'));
    }
  })
});

async function generateRequestTaskObject (iRequest) {
  var taskName = '';
  if (iRequest.reqTaskName != '' && iRequest.reqTaskName != null) {
    console.log('No need to create new task name');
    taskName = iRequest.reqTaskName;
  } else {
    if (iRequest.reqTaskParentTaskName != '' && iRequest.reqTaskParentTaskName != null) {
      // For PMT sub task
      console.log('Create task name by task parent name');
      taskName = await Utils.getSubtaskName(iRequest.reqTaskParentTaskName, 'SUB');
    } 
    else if (iRequest.reqTaskReferenceTask != '' && iRequest.reqTaskReferenceTask != null) {
      // For PMT reference task
      console.log('Create task name by task reference name');
      taskName = await Utils.getSubtaskName(iRequest.reqTaskReferenceTask, 'REF');
    } 
    else {
      // For PMT task
      console.log('Create new PMT task name by task sequence');
      var currentYear = new Date().getFullYear().toString().substring(2,4);
      var pmtTaskSeqNbr = await getPMTTaskSequenceNumber();
      console.log('Sequence Number = ' + pmtTaskSeqNbr)
      if (currentYear != null && pmtTaskSeqNbr != null) {
        taskName = 'PMT' + currentYear + (pmtTaskSeqNbr).toString().padStart(5, '0');
      }
    }
  }
  console.log('Task Name => ', taskName);
  var reqTaskObj = {
    ParentTaskName: iRequest.reqTaskParentTaskName != ''? iRequest.reqTaskParentTaskName: null,
    Name: taskName,
    Category: iRequest.reqTaskCategory != ''? iRequest.reqTaskCategory: null,
    Type: iRequest.reqTaskType != ''? iRequest.reqTaskType: null,
    Title: iRequest.reqTaskTitle != ''? iRequest.reqTaskTitle: null,
    Description: iRequest.reqTaskDescription != ''? iRequest.reqTaskDescription: null,
    ReferenceTask: iRequest.reqTaskReferenceTask != ''? iRequest.reqTaskReferenceTask: null,
    TypeTag: iRequest.reqTaskTypeTag != ''? iRequest.reqTaskTypeTag: null,
    DeliverableTag: iRequest.reqTaskDeliverableTag != ''? iRequest.reqTaskDeliverableTag: null,
    Creator: iRequest.reqTaskCreator != ''? iRequest.reqTaskCreator: null,
    RequiredSkills: iRequest.reqTaskRequiredSkills != ''? iRequest.reqTaskRequiredSkills: null,
    CustomerId: iRequest.reqTaskCustomerId != ''? iRequest.reqTaskCustomerId: null,
    Status: iRequest.reqTaskStatus != ''? iRequest.reqTaskStatus: 'Drafting',
    Estimation: iRequest.reqTaskEstimation != ''? iRequest.reqTaskEstimation: 0,
    IssueDate: iRequest.reqTaskIssueDate != ''? iRequest.reqTaskIssueDate: new Date(),
    TargetComplete: iRequest.reqTaskTargetComplete != ''? iRequest.reqTaskTargetComplete: null,
    ActualComplete: iRequest.reqTaskActualComplete != ''? iRequest.reqTaskActualComplete: null,
    RespLeaderId: iRequest.reqTaskRespLeaderId != ''? iRequest.reqTaskRespLeaderId: null, 
    AssigneeId: iRequest.reqTaskAssigneeId != ''? iRequest.reqTaskAssigneeId: null,
    SprintId: iRequest.reqTaskSprintId != ''? iRequest.reqTaskSprintId: null,
    SprintIndicator: iRequest.reqTaskSprintIndicator != ''? iRequest.reqTaskSprintIndicator: null
  }
  console.log('Task Object => ', reqTaskObj);
  return reqTaskObj;
}

function updateTaskhasSubtaskInd(iTaskName) {
  return new Promise((resolve, reject) => {
    Task.count({
      where: {
        ParentTaskName: iTaskName
      }
    }).then(async function (count) {
      console.log('Parent task ['+iTaskName+'] sub task count -> ', count);
      if (Number(count) > 0) {
        // Has sub task, update indicator to "Y"
        console.log('Update to Y')
        await Task.update({HasSubtask: 'Y'}, {where: { Name: iTaskName }});
        resolve(true);
      } else {
        // No sub task, update indicator to "N"
        console.log('Update to N')
        await Task.update({HasSubtask: 'N'}, {where: { Name: iTaskName }});
        resolve(false);
      }
    })
  });
}

function getPMTTaskSequenceNumber () {
  return new Promise((resolve, reject) => {
    Reference.findOne({
      where: {
        Name: 'TaskSeq'
      }
    }).then(async function(reference) {
      if (reference != null) {
        var taskSeq = Number(reference.Value) + 1
        await reference.update({
          Value: taskSeq
        })
        resolve(taskSeq);
      } else {
        resolve(0);
      }
    })
  });
}

// Get task list for worklog
router.post('/getTasksByWorklogKeyword', async function(req, res, next) {
  var rtnResult = [];
  var reqKeyword = req.body.reqKeyword.trim();
  var reqTaskAssigneeId = Number(req.body.reqTaskAssigneeId);
  var reqDate = req.body.reqDate;
  console.log('Search task by keyword: ' + reqKeyword + ' for user ' + reqTaskAssigneeId + ', Date -> ' + reqDate);
  var criteria = {
    Name: {[Op.notLike]: 'Dummy - %'},
    [Op.or]: [
      {Name: {[Op.like]:'%' + reqKeyword + '%'}},
      {Title: {[Op.like]:'%' + reqKeyword + '%'}},
      {Description: {[Op.like]:'%' + reqKeyword + '%'}},
      {ReferenceTask: {[Op.like]:'%' + reqKeyword + '%'}}
    ],
    [Op.and]: [
      { Status: {[Op.ne]: 'Drafting'}},
      { Status: {[Op.ne]: 'Planning'}},
      //{ Status: {[Op.ne]: 'Done'}},
      {[Op.or]: [
        {[Op.and]: [
            { TypeTag: 'One-Off Task' },
            { SprintId: {[Op.ne]: null}},
            { AssigneeId: reqTaskAssigneeId },
        ]},
        { TypeTag: 'Public Task' }
      ]}
    ],
    Id: { [Op.ne]: null }
  }
  var sprintIdArray = await Utils.getSprintIdByDateAndUserId(reqDate, reqTaskAssigneeId);
  console.log('Sprint Id Array -> ', sprintIdArray);
  if (sprintIdArray != null && sprintIdArray.length > 0) {
    criteria.SprintId = {
      [Op.in]: sprintIdArray
    }
  } else {
    return res.json(Utils.responseMessage(1, null, 'Not assign to any sprint at date[' + reqDate + ']'));
  }
  Task.findAll({
    include: [{
      model: Sprint
    }],
    where: criteria,
    limit: 100,
    order: [
      ['IssueDate', 'DESC']
    ]
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      for(var i=0; i<tasks.length; i++){
        var resJson = {};
        resJson.taskId = tasks[i].Id;
        resJson.taskName = tasks[i].Name;
        resJson.taskTitle = tasks[i].Title;
        resJson.taskSprintName = tasks[i].sprint != null? tasks[i].sprint.Name: null;
        resJson.taskSprintTimeRange = tasks[i].sprint != null? tasks[i].sprint.StartTime + '~' + tasks[i].sprint.EndTime: null;
        rtnResult.push(resJson);
      }
      return res.json(Utils.responseMessage(0, rtnResult, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No task exist'));
    }
  })
});

module.exports = router;