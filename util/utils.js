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
  getSkillsByList
}