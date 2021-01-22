var Sequelize = require('sequelize');
var Skill = require('../models/skill');

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

// Skills Related Function
function getAllSkillsList() {
  return new Promise((resolve,reject) =>{
    console.log('Start getAllSkillsList')
    var rtnResult = [];
    Skill.findAll({
      order: [
        ['Group', 'ASC']
      ]
    }).then(function(skills) {
      if (skills != null && skills.length > 0) {
        for (let i=0; i<skills.length; i++) {
          var resJson = {};
          resJson.skillId = skills[i].Id;
          resJson.skillName = skills[i].Name;
          resJson.skillDesc = skills[i].Description;
          resJson.skillGroup = skills[i].Group;
          rtnResult.push(resJson);
        }
      } 
      resolve(rtnResult);
    })
  });
}

function handleSkillsArray (iSkills) {
  if (iSkills != null && iSkills != '') {
    var skillsArray = iSkills.split(',');
    for (var i=0; i<skillsArray.length; i++) {
      skillsArray[i] = skillsArray[i].replace(new RegExp('#','g'),'');
    }
    return skillsArray.toString();
  } else {
    return '';
  }
}

function getSkillsByList (iSkillsIdArray, iSkillsList) {
  var skills = [];
  var skillsIdArray = iSkillsIdArray.split(',');
  if (iSkillsList != null && iSkillsList.length > 0) {
    for(var i=0; i<skillsIdArray.length; i++) {
      for (var j=0; j<iSkillsList.length; j++) {
        if (Number(skillsIdArray[i]) == iSkillsList[j].skillId) {
          skills.push(iSkillsList[j].skillName);
        }
      }
    }
  }
  return skills;
}

async function generateResponseTasksInfo (tasks) {
  if (tasks != null && tasks.length > 0) {
    var rtnResult = [];
    var skillsList = await this.getAllSkillsList();
    for(var i=0; i<tasks.length; i++){
      var resJson = {};
      resJson.taskId = tasks[i].Id;
      resJson.taskHasSubtask = tasks[i].HasSubtask;
      resJson.taskParentTaskName = tasks[i].ParentTaskName;
      resJson.taskName = tasks[i].Name;
      resJson.taskCategory = tasks[i].Category;
      resJson.taskType = tasks[i].Type;
      resJson.taskTitle = tasks[i].Title;
      resJson.taskDescription = tasks[i].Description;
      resJson.taskReferenceTask = tasks[i].ReferenceTask;
      resJson.taskTypeTag = tasks[i].TypeTag;
      resJson.taskDeliverableTag = tasks[i].DeliverableTag;
      resJson.taskSprintId = tasks[i].SprintId;
      resJson.taskCreator = tasks[i].Creator;
      resJson.taskRequiredSkills = this.handleSkillsArray(tasks[i].RequiredSkills).split(',').map(Number);
      resJson.taskRequiredSkillsStr = this.getSkillsByList(this.handleSkillsArray(tasks[i].RequiredSkills), skillsList).toString();
      resJson.taskStatus = tasks[i].Status;
      resJson.taskEffort = tasks[i].Effort;
      resJson.taskEstimation = tasks[i].Estimation;
      resJson.taskIssueDate = tasks[i].IssueDate;
      resJson.taskTargetComplete = tasks[i].TargetComplete;
      resJson.taskActualComplete = tasks[i].ActualComplete;
      resJson.taskRespLeaderId = tasks[i].RespLeaderId;
      resJson.taskAssigneeId = tasks[i].AssigneeId;
      resJson.taskAssignee = tasks[i].user != null? tasks[i].user.Name: null;
      rtnResult.push(resJson);
    }
    // console.log('Return result -> ', rtnResult);
    return rtnResult;
  } else {
    return null;
  }
}

/*
async function getSkillsStrByIdArray (iSkillsIdArray) {
  var skillsArray = iSkillsIdArray.split(',');
  await Skill.findAll({
    where: {
      Id: { [Op.in]: skillsArray }
    }
  }).then(function(skills) {
    var skillsStr = '';
    if (skills != null && skills.length > 0) {
      for (let i=0; i<skills.length; i++) {
        skillsStr = skillsStr + skills[i].Name + ', ';
      }
      skillsStr.substring(0, skillsStr.length - 1);
    }
    return skillsStr;
  })
}
*/

module.exports = {
  responseMessage,
  getAllSkillsList,
  handleSkillsArray,
  getSkillsByList,
  generateResponseTasksInfo
}