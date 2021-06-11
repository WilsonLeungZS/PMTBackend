var Sequelize = require('sequelize');
const Op = Sequelize.Op;

var Skill = require('../models/skill');
var Sprint = require('../models/sprint');
var User = require('../models/user');
var Task = require('../models/task');
var SprintUserMap = require('../models/sprint_user_map');
var Customer = require('../models/customer');
var Timeline = require('../models/timeline');

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
    var taskNameArray = [];
    var skillsList = await this.getAllSkillsList();
    var customersList = await this.getAllCustomersList();
    for(var i=0; i<tasks.length; i++){
      var resJson = {};
      resJson.taskId = tasks[i].Id;
      resJson.taskHasSubtask = tasks[i].HasSubtask;
      resJson.taskParentTaskName = tasks[i].ParentTaskName;
      resJson.taskName = tasks[i].Name;
      // To get sub task effort
      taskNameArray.push(tasks[i].Name); 
      resJson.taskCategory = tasks[i].Category;
      resJson.taskType = tasks[i].Type;
      // Set up task background color
      if (tasks[i].Type == 'Development') {
        resJson.taskBackgroundColor = 'rgb(246,253,254)';
      } else if (tasks[i].Type == 'Maintenance') {
        resJson.taskBackgroundColor = 'rgb(255,245,246)';
      } else if (tasks[i].Type == 'Others') {
        resJson.taskBackgroundColor = 'rgb(248,251,243)';
      } else {
        resJson.taskBackgroundColor = '';
      }
      resJson.taskTitle = tasks[i].Title;
      resJson.taskDescription = tasks[i].Description;
      resJson.taskReferenceTask = tasks[i].ReferenceTask;
      resJson.taskTypeTag = tasks[i].TypeTag;
      resJson.taskDeliverableTag = tasks[i].DeliverableTag != null ? tasks[i].DeliverableTag.split(','): null;
      resJson.taskCustomerId = tasks[i].CustomerId;
      resJson.taskCustomer = null;
      if (tasks[i].CustomerId != null) {
        var index = this.getIndexOfValueInArr(customersList, 'customerId', tasks[i].CustomerId);
        if (index != -1) {
          resJson.taskCustomer = customersList[index].customerName;
        }
      }
      resJson.taskSprintId = tasks[i].SprintId;
      resJson.taskSprintName = tasks[i].sprint != null? tasks[i].sprint.Name: null;
      resJson.taskSprintStartTime = tasks[i].sprint != null? tasks[i].sprint.StartTime: null;
      resJson.taskSprintEndTime = tasks[i].sprint != null? tasks[i].sprint.EndTime: null;
      resJson.taskSprintStatus = tasks[i].sprint != null? tasks[i].sprint.Status: null;
      resJson.taskCreator = tasks[i].Creator.replace('PMT:', '');
      resJson.taskRequiredSkills = this.handleSkillsArray(tasks[i].RequiredSkills).split(',').map(Number);
      resJson.taskRequiredSkillsStr = this.getSkillsByList(this.handleSkillsArray(tasks[i].RequiredSkills), skillsList).toString();
      resJson.taskStatus = tasks[i].Status;
      resJson.taskEffort = tasks[i].Effort;
      resJson.taskSubTaskEffort = 0;
      resJson.taskEstimation = tasks[i].Estimation;
      resJson.taskIssueDate = tasks[i].IssueDate;
      resJson.taskTargetComplete = tasks[i].TargetComplete;
      resJson.taskActualComplete = tasks[i].ActualComplete;
      resJson.taskRespLeaderId = tasks[i].RespLeaderId;
      resJson.taskAssigneeId = tasks[i].AssigneeId;
      resJson.taskAssignee = tasks[i].user != null? tasks[i].user.Name: null;
      resJson.taskAssigneeFullNickname = tasks[i].user != null? getUserFullNickname(tasks[i].user): null;
      resJson.taskSprintIndicator = tasks[i].SprintIndicator;
      rtnResult.push(resJson);
    }
    // console.log('Return result -> ', rtnResult);
    // Get task subtask effort
    if (rtnResult.length > 0 && taskNameArray.length > 0) {
      var subTaskEffortArray = await getSubTaskTotalEffort(taskNameArray);
      if (subTaskEffortArray != null && subTaskEffortArray.length > 0) {
        for (var j=0; j<rtnResult.length; j++) {
          var index = getIndexOfValueInArr(subTaskEffortArray, 'subTaskParent', rtnResult[j].taskName);
          if (index != -1) {
            rtnResult[j].taskSubTaskEffort = subTaskEffortArray[index].subTaskEffort;
          }
        }
      }
    }
    return rtnResult;
  } else {
    return null;
  }
}

function getUserFullNickname (iUser) {
  console.log('User ->', iUser);
  var userFullNickname = '';
  if (iUser != null) {
    var userName = iUser.Name;
    var userNickname = iUser.Nickname;
    var userNameArray = userName.split('.');
    if (userNameArray != null && userNameArray.length > 0) {
      var userLastName = userNameArray[userNameArray.length - 1];
      if(userLastName != null && userLastName != '' && userNickname != null && userNickname != '') {
        userLastName = userLastName.replace(userLastName[0],userLastName[0].toUpperCase());
        userNickname = userNickname.replace(userNickname[0],userNickname[0].toUpperCase());
        userFullNickname = userNickname + '.' + userLastName;
      }
    }
  }
  return userFullNickname;
}

function getSubTaskTotalEffort (iTaskNameArray) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: { [Op.in]: iTaskNameArray }
      },
      order: [
        ['ParentTaskName', 'DESC']
      ]
    }).then(function(tasks) {
      if(tasks != null && tasks.length > 0) {
        var result = [];
        for (var i=0; i<tasks.length; i++) {
          var resJson = {};
          var index = getIndexOfValueInArr(result, 'subTaskParent', tasks[i].ParentTaskName);
          if (index != -1) {
            result[index].subTaskEffort = Number(result[index].subTaskEffort) + Number(tasks[i].Effort); 
          } else {
            resJson.subTaskParent = tasks[i].ParentTaskName;
            resJson.subTaskEffort = tasks[i].Effort;
            result.push(resJson);
          }
        }
        resolve(result);
      } else {
        resolve(null);
      }
    })
  });
}

// Get sub task name
async function getSubtaskName(iTaskName, iFlag) {
  console.log('Start to get sub task Name!');
  var subTasks = [];
  if (iFlag == 'SUB') {
    subTasks = await getSubTasks(iTaskName);
  }
  if (iFlag == 'REF') {
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
// End of get sub tasks name

function calculateCapacity (iUserId, iStartTime, iEndTime) {
  return new Promise((resolve, reject) => {
    SprintUserMap.findAll({
      include: [{
        model: Sprint,
        where: {
          StartTime: {[Op.gte]: iStartTime},
          EndTime: {[Op.lte]: iEndTime}
        }
      }],
      where: {
        UserId: iUserId
      }
    }).then(function(maps) {
      if (maps != null && maps.length > 0) {
        var usedCapacity = 0;
        for(var i=0; i<maps.length; i++) {
          var capacity = maps[i].Capacity;
          usedCapacity = usedCapacity + capacity;
        }
        resolve(usedCapacity);
      } else {
        resolve(0);
      }
    });
  })
}


// Get sprint list by require skills
// Params: (1) iRequiredSkills = '#1#,#4#' / '1,4'    (2) iRequestTime = '2021-01-02'
function getSprintsByRequiredSkills (iRequiredSkills, iRequestTime, iDataSource = null, iSprintName = null) {
  return new Promise((resolve, reject) => {
    console.log('Method: getSprintsByRequiredSkills -> ', iRequiredSkills, iRequestTime);
    var criteria = {};
    if (iRequiredSkills != null && iRequiredSkills != '') {
      var skills = [];
      var skillsArray = iRequiredSkills.split(',');
      for (var i=0; i<skillsArray.length; i++) {
        if(skillsArray[i].indexOf('#') != -1) {
          skills.push({RequiredSkills: {[Op.like]:'%' + skillsArray[i] + '%'}});
        } else {
          skills.push({RequiredSkills: {[Op.like]:'%#' + skillsArray[i] + '#%'}});
        }
      }
      var skillsCriteria = {
        [Op.or]: skills
      }
      Object.assign(criteria, skillsCriteria);
    }
    if (iRequestTime != null && iRequestTime != '') {
      var timeCriteria = {
        StartTime: {[Op.lte]: iRequestTime},
        EndTime: {[Op.gte]: iRequestTime},
      }
      Object.assign(criteria, timeCriteria);
    }
    criteria.Status = { [Op.ne]: 'Obsolete' }
    if (iDataSource != null) {
      criteria.DataSource = { [Op.like]: '%' + iDataSource + '%' }
    }
    if (iSprintName != null) {
      criteria.Name = { [Op.like]: '%' + iSprintName + '%' }
    }
    Sprint.findAll({
      include: [{
        model: User, 
        attributes: ['Id', 'Name']
      },{
        model: Timeline
      }],
      where: criteria
    }).then(function(sprints) {
      resolve(sprints);
    })
  });
}

function getIndexOfValueInArr (iArray, iKey, iValue) {
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

function formatDate (date, fmt) { 
  var o = { 
    "M+" : date.getMonth()+1,                 
    "d+" : date.getDate(),                     
    "h+" : date.getHours(),                    
    "m+" : date.getMinutes(),                 
    "s+" : date.getSeconds(),                  
    "q+" : Math.floor((date.getMonth()+3)/3),
    "S"  : date.getMilliseconds()            
  }; 
  if(/(y+)/.test(fmt)) {
        fmt=fmt.replace(RegExp.$1, (date.getFullYear()+"").substr(4 - RegExp.$1.length)); 
  }
  for(var k in o) {
    if(new RegExp("("+ k +")").test(fmt)){
          fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
      }
  }
  return fmt; 
}

function getSprintIdByDateAndUserId (iDate, iUserId) {
  return new Promise((resolve, reject) => {
    SprintUserMap.findAll({
      include: [{
        model: Sprint,
        where: {
          StartTime: {[Op.lte]: iDate},
          EndTime: {[Op.gte]: iDate},
        }
      }],
      where: {
        Id: { [Op.ne]: null },
        UserId: iUserId
      }
    }).then(function(sprintUserMap) {
      if (sprintUserMap != null && sprintUserMap.length > 0) {
        var result = [];
        for (var i=0; i<sprintUserMap.length; i++) {
          result.push(sprintUserMap[i].SprintId);
        }
        resolve(result);
      } else {
        resolve(null);
      }
    });
  });
}

// Customers Related Function
function getAllCustomersList() {
  return new Promise((resolve,reject) =>{
    console.log('Start getAllCustomersList')
    var rtnResult = [];
    Customer.findAll({
      order: [
        ['createdAt', 'DESC']
      ]
    }).then(function(customers) {
      if (customers != null && customers.length > 0) {
        for (var i=0; i<customers.length; i++) {
          var resJson = {};
          resJson.customerId = customers[i].Id;
          resJson.customerName = customers[i].Name;
          resJson.customerDescription = customers[i].Description;
          resJson.customerHomepage = customers[i].Homepage;
          resJson.customerEmailDomain = customers[i].EmailDomain;
          resJson.customerRoleClientLeadId = customers[i].RoleClientLeadId;
          resJson.customerSprintLeadId = customers[i].SprintLeadId;
          rtnResult.push(resJson);
        }
      }
      resolve(rtnResult);
    })
  });
}

function handleCustomersArray (iCustomers) {
  if (iCustomers != null && iCustomers != '') {
    var customersArray = iCustomers.split(',');
    for (var i=0; i<customersArray.length; i++) {
      customersArray[i] = customersArray[i].replace(new RegExp('#','g'),'');
    }
    return customersArray.toString();
  } else {
    return '';
  }
}

function getCustomersByList (iCustomersIdArray, iCustomersList) {
  var customers = [];
  var customersIdArray = iCustomersIdArray.split(',');
  if (iCustomersList != null && iCustomersList.length > 0) {
    for(var i=0; i<customersIdArray.length; i++) {
      for (var j=0; j<iCustomersList.length; j++) {
        if (Number(customersIdArray[i]) == iCustomersList[j].customerId) {
          customers.push(iCustomersList[j].customerName);
        }
      }
    }
  }
  return customers;
}

function getAllTimelinesList() {
  return new Promise((resolve,reject) =>{
    console.log('Start getAllTimelinesList')
    var rtnResult = [];
    Timeline.findAll({
      where: {
        Status: {[Op.ne]: 'obsolete'}
      },
      order: [
        ['StartTime', 'ASC']
      ]
    }).then(async function(timelines) {
      if (timelines != null && timelines.length > 0) {
        var currentDate = formatDate(new Date(), 'yyyy-MM-dd');
        for (var i=0; i<timelines.length; i++) {
          var resJson = {};
          resJson.timelineId = timelines[i].Id;
          resJson.timelineName = timelines[i].Name;
          resJson.timelineStartTime = timelines[i].StartTime;
          resJson.timelineEndTime = timelines[i].EndTime;
          resJson.timelineWorkingDays = timelines[i].WorkingDays;
          resJson.timelineStatus = timelines[i].Status;
          if (timelines[i].EndTime < currentDate) {
            resJson.timelineCanObsolete = true;
            resJson.timelineCanCreate = false;
          } else {
            resJson.timelineCanObsolete = false;
            resJson.timelineCanCreate = true;
          }
          
          rtnResult.push(resJson);
        }
      }
      resolve(rtnResult);
    })
  });
}

module.exports = {
  responseMessage,
  getAllSkillsList,
  handleSkillsArray,
  getSkillsByList,
  generateResponseTasksInfo,
  getSubtaskName,
  calculateCapacity,
  getSprintsByRequiredSkills,
  getIndexOfValueInArr,
  formatDate,
  getSprintIdByDateAndUserId,
  getAllCustomersList,
  handleCustomersArray,
  getCustomersByList,
  getAllTimelinesList
}