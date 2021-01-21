/*
 * @Description: API route handle sprint related request
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */

var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var Utils = require('../util/utils');

var Sprint = require('../models/sprint');
var User = require('../models/user');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
  return res.json({message: 'Response sprint resource'});
});

// Get active sprints list
router.get('/getActiveSprintsList', function(req, res, next) {
  Sprint.findAll({
    include: [{
      model: User, 
      attributes: ['Id', 'Name']
    }],
    where: {
      Status: { [Op.ne]: 'Obsolete' }
    },
    order: [
      ['StartTime', 'DESC']
    ]
  })
  .then(async function(sprints) {
    if (sprints != null && sprints.length > 0) {
      var responseSprints = await generateResponseSprintsInfo(sprints);
      return res.json(Utils.responseMessage(0, responseSprints, ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
    }
  })
});

async function generateResponseSprintsInfo(sprints) {
  if (sprints != null && sprints.length > 0) {
    var rtnResult = [];
    var skillsList = await Utils.getAllSkillsList();
    for(var i=0; i<sprints.length; i++){
      var resJson = {};
      resJson.sprintId = sprints[i].Id;
      resJson.sprintName = sprints[i].Name;
      resJson.sprintStartTime = sprints[i].StartTime;
      resJson.sprintEndTime = sprints[i].EndTime;
      resJson.sprintBaseline = sprints[i].Baseline;
      resJson.sprintWorkingDays = sprints[i].WorkingDays;
      resJson.sprintBaseCapacity = sprints[i].BaseCapacity;
      resJson.sprintRequiredSkills = sprints[i].RequiredSkills.split(',').map(Number);
      resJson.sprintRequiredSkillsStr = Utils.getSkillsByList(sprints[i].RequiredSkills, skillsList).toString();
      resJson.sprintStatus = sprints[i].Status;
      resJson.sprintLeaderId = sprints[i].user.Id;
      resJson.sprintLeader = sprints[i].user.Name;
      rtnResult.push(resJson);
    }
    // console.log('Return result -> ', rtnResult);
    return rtnResult;
  } else {
    return null;
  }
}

// Get Sprint Information 
router.get('/getSprintById', function(req, res, next) {
  var reqSprintId = Number(req.query.reqSprintId);
  Sprint.findOne({
    include: [{
      model: User, 
      attributes: ['Id', 'Name']
    }],
    where: {
      Id: reqSprintId
    }
  })
  .then(async function(sprint) {
    if (sprint != null) {
      var sprintArray = [sprint]
      var responseSprints = await generateResponseSprintsInfo(sprintArray);
      return res.json(Utils.responseMessage(0, responseSprints[0], ''));
    } else {
      return res.json(Utils.responseMessage(1, null, 'No sprint exist'));
    }
  })
});

// Create or update sprint
router.post('/updateSprint', function(req, res, next) {
  console.log('Start to create or update sprint');
  var reqSprintObj = generateRequestSprintObject(req.body);
  Sprint.findOrCreate({
    where: {
      Name: req.body.reqSprintName
    }, 
    defaults: reqSprintObj
  }).spread(async function(sprint, created) {
    if(created) {
      return res.json(Utils.responseMessage(0, sprint, 'Create sprint successfully!'));
    } 
    else if(sprint != null && !created) {
      await sprint.update(reqSprintObj);
      return res.json(Utils.responseMessage(0, sprint, 'Update sprint successfully!'));
    }
    else {
      return res.json(Utils.responseMessage(1, null, 'Created or updated sprint fail!'));
    }
  })
});

function generateRequestSprintObject (iRequest) {
  var reqSprintObj = {
    Name: iRequest.reqSprintName != ''? iRequest.reqSprintName: null,
    StartTime: iRequest.reqSprintStartTime != ''? iRequest.reqSprintStartTime: null,
    EndTime: iRequest.reqSprintEndTime != ''? iRequest.reqSprintEndTime: null,
    Baseline: iRequest.reqSprintBaseline != ''? iRequest.reqSprintBaseline: null,
    WorkingDays: iRequest.reqSprintWorkingDays != ''? iRequest.reqSprintWorkingDays: 0,
    BaseCapacity: iRequest.reqSprintBaseCapacity != ''? iRequest.reqSprintBaseCapacity: null,
    RequiredSkills: iRequest.reqSprintRequiredSkills != ''? iRequest.reqSprintRequiredSkills: null,
    Status: iRequest.reqSprintStatus != ''? iRequest.reqSprintStatus: 'Active',
    LeaderId: iRequest.reqSprintLeaderId != ''? iRequest.reqSprintLeaderId: null,
  }
  return reqSprintObj;
}

module.exports = router;