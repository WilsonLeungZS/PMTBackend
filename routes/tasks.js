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
  Task.findOne({
    include: [{
      model: User, 
      attributes: ['Id', 'Name', 'Nickname']
    }],
    where: {
      ParentTaskName: reqTaskName
    },
    order: [
      ['IssueDate', 'DESC']
    ]
  }).then(async function(tasks) {
    if (tasks != null && tasks.length > 0) {
      var responseTasks = [];
      for (var i=0; i<tasks.length; i++) {
        var resJson = {}
        resJson.subtaskId = tasks[i].Id;
        resJson.subtaskName = tasks[i].Name;
        resJson.subtaskTitle = tasks[i].Title;
        resJson.subtaskStatus = tasks[i].Status;
        resJson.subtaskAssigneeId = tasks[i].AssigneeId;
        resJson.subtaskAssignee = tasks[i].user.Name;
        responseTasks.push(resJson);
      }
      return res.json(Utils.responseMessage(0, responseTasks, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sub task exist'));
    }
  })
});

module.exports = router;