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
var Reference = require('../models/reference');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
  return res.json({message: 'Response task resource'});
});

// Get task list count by skill
router.post('/getTasksListCountBySkill', function(req, res, next) {
  var reqSkillsArray = req.body.reqSkillsArray;
  var skillsCriteria = [];
  if (reqSkillsArray != null && reqSkillsArray != '') {
    var skillsArray = reqSkillsArray.split(',');
    for (var i=0; i<skillsArray.length; i++) {
      skillsCriteria.push({RequiredSkills: {[Op.like]:'%#' + skillsArray[i] + '#%'}})
    }
  }
  Task.count({
    where: {
      Status: {[Op.ne]: 'Done'},
      Status: {[Op.ne]: 'Obsolete'},
      SprintId: null,
      [Op.or]: skillsCriteria
    }
  }).then(async function(result) {
    return res.json(Utils.responseMessage(0, result, ''));
  })
});

// Get task list by skill
router.post('/getTasksListBySkill', function(req, res, next) {
  var reqSkillsArray = req.body.reqSkillsArray;
  var reqSize = Number(req.body.reqSize);
  var reqPage = Number(req.body.reqPage);
  var skillsCriteria = [];
  if (reqSkillsArray != null && reqSkillsArray != '') {
    var skillsArray = reqSkillsArray.split(',');
    for (var i=0; i<skillsArray.length; i++) {
      skillsCriteria.push({RequiredSkills: {[Op.like]:'%#' + skillsArray[i] + '#%'}})
    }
  }
  Task.findAll({
    where: {
      Status: {[Op.ne]: 'Done'},
      Status: {[Op.ne]: 'Obsolete'},
      SprintId: null,
      [Op.or]: skillsCriteria
    },
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

// Get sub tasks list by name
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
        resJson.subtaskName = tasks[i].Name;
        resJson.subtaskCategory = tasks[i].Category;
        resJson.subtaskTitle = tasks[i].Title;
        resJson.subtaskStatus = tasks[i].Status;
        resJson.subtaskEffort = tasks[i].Effort;
        resJson.subtaskEstimation = tasks[i].Estimation;
        resJson.subtaskAssigneeId = tasks[i].AssigneeId;
        resJson.subtaskAssignee = tasks[i].user != null ? tasks[i].user.Name: null;
        responseTasks.push(resJson);
      }
      return res.json(Utils.responseMessage(0, responseTasks, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sub task exist'));
    }
  })
});

// Create or update task
router.post('/updateTaskAssignee', async function(req, res, next) {
  console.log('Start to create or update task');
  Task.update({
    AssigneeId: req.body.reqTaskAssigneeId
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
      return res.json(Utils.responseMessage(0, task, 'Create task successfully!'));
    } 
    else if(task != null && !created) {
      await task.update(reqTaskObj);
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
      taskName = await getTaskName(iRequest.reqTaskParentTaskName, 'SUB');
      await updateTaskHasSubtaskInd(iRequest.reqTaskParentTaskName);
    } 
    else if (iRequest.reqTaskReferenceTask != '' && iRequest.reqTaskReferenceTask != null) {
      // For PMT reference task
      console.log('Create task name by task reference name');
      taskName = await getTaskName(iRequest.reqTaskReferenceTask, 'REF');
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
    Customer: iRequest.reqTaskCustomer != ''? iRequest.reqTaskCustomer: null,
    Status: iRequest.reqTaskStatus != ''? iRequest.reqTaskStatus: 'Drafting',
    Estimation: iRequest.reqTaskEstimation != ''? iRequest.reqTaskEstimation: 0,
    IssueDate: iRequest.reqTaskIssueDate != ''? iRequest.reqTaskIssueDate: new Date(),
    TargetComplete: iRequest.reqTaskTargetComplete != ''? iRequest.reqTaskTargetComplete: null,
    ActualComplete: iRequest.reqTaskActualComplete != ''? iRequest.reqTaskActualComplete: null,
    RespLeaderId: iRequest.reqTaskRespLeaderId != ''? iRequest.reqTaskRespLeaderId: null, 
    AssigneeId: iRequest.reqTaskAssigneeId != ''? iRequest.reqTaskAssigneeId: null,
    SprintId: iRequest.reqTaskSprintId != ''? iRequest.reqTaskSprintId: null
  }
  console.log('Task Object => ', reqTaskObj);
  return reqTaskObj;
}

function updateTaskHasSubtaskInd (iTaskName) {
  return new Promise((resolve, reject) => {
    Task.update({
      HasSubtask: 'Y'
    },{
      where: {
        Name: iTaskName
      }
    }).then(async function(task) {
      if (task != null) {
        resolve(task);
      } else {
        resolve(null);
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

async function getTaskName(iTaskName, iFlage) {
  console.log('Start to get sub task Name!');
  var subTasks = [];
  if (iFlage == 'SUB') {
    subTasks = await getSubTasks(iTaskName);
  }
  if (iFlage == 'REF') {
    subTasks = await getReferenceTasks(iTaskName);
  }
  var subTaskCount = 0;
  if(subTasks != null && subTasks.length > 0) {
    var taskLastNumberArray = [];
    for (var i=0; i<subTasks.length; i++) {
      var lastSubTaskName = subTasks[i].Name;
      var nameArr = lastSubTaskName.split('-');
      var lastNameNum = nameArr[nameArr.length-1] + '';
      if (lastNameNum.indexOf('(') != -1) {
        let index = lastNameNum.indexOf('(');
        lastNameNum = lastNameNum.substring(0, index);
      }
      lastNameNum = Number(lastNameNum);
      taskLastNumberArray.push(lastNameNum);
    }
    let max = taskLastNumberArray[0]
    taskLastNumberArray.forEach(item => max = item > max ? item : max)
    var subTasksLength = subTasks.length;
    console.log('Sub Task Last Number: ' + max);
    console.log('Sub Task Length: ' + subTasksLength);
    if(isNaN(max)){
      subTaskCount = subTasksLength;
    } else {
      subTaskCount = max;
    }
  } else {
    subTaskCount = 0;
  }
  subTaskCount = Number(subTaskCount) + 1;
  var taskName = iTaskName + '-' + subTaskCount;
  console.log('Sub Task Name: ' + taskName);
  return taskName;
}

function getSubTasks (iTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iTaskName
      },
      order: [
        ['IssueDate', 'DESC']
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

function getReferenceTasks (iTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ReferenceTask: iTaskName,
        ParentTaskName: null
      },
      order: [
        ['IssueDate', 'DESC']
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


module.exports = router;