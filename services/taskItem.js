var Task = require('../model/task/task');
var dateFormat = require('dateformat');
var Schedule = require('../model/schedule');
var nodeSchedule = require('node-schedule');

async function saveTask(req, res, remark) {
  var reqTask = null;
  if(String(remark) == String('createByUser')){
    reqTask = JSON.parse(req.body.reqTask);
  }else if(String(remark) == String('regularCreate')){
    reqTask = JSON.parse(req);
  }else{
    console.log('The task not create by user or regular job.');
  }
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
          //return res.json(responseMessage(0, task, 'Task Created'));
        } else {
          console.log("Task existed");
          /*if(reqTask.task_status == 'Running' && reqTask.task_TypeTag == 'Regular Task'){
            Schedule.update({
              Status: 'Running'
            },
              {where: {JobId: reqTaskName}
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
                  Schedule.update({
                    Status: 'Done'
                  },
                    {where: {JobId: tempJobId}
                  });
                  console.log('JobId: ' + tempJobId + ' was done.');
                }
              }
            });
          }*/
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
          if(String(remark) == String('createByUser')){
            return res.json(responseMessage(1, task, 'Task existed'));
          }else if(String(remark) == String('regularCreate')){
            console.log('Regular task create task: ' + reqTaskName);
          }else{
            console.log('The task not create by user or regular job.');
          }
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

  function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
    var resJson = {}; 
    resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
    return resJson;
  }

  function createTaskByScheduleJob(TaskId){
    console.log('Create Regular task ' + TaskId + ' time: ' + new Date());
    var day = dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss");
    var iParentTask = null;
    Task.findAll({
      attributes: ['ParentTaskName','TaskName','Description','Status','Creator',
      'TaskTypeId','Effort','Estimation','IssueDate','TargetCompleteDate','ActualCompleteDate',
      'BusinessArea','BizProject','TaskLevel','RespLeaderId','AssigneeId','Reference','Scope',
      'TopConstraint','TopOppName','TopCustomer','TopFacingClient','TopTypeOfWork','TopChanceWinning',
      'TopSowConfirmation','TopBusinessValue','TopTargetStart','TopTargetEnd','TopPaintPoints',
      'TopTeamSizing','TopSkill','TopOppsProject','TaskGroupId','TypeTag','DeliverableTag','Detail'],
      where: { 
        TaskName: TaskId
      },
    })
    .then(async function(sch) {
      if(sch.length === 0){
        console.log('No Regular task was found, ' + 'list size: ' + sch.length);
        return false;
      }
      for(var i = 0; i < sch.length; i++){
        iParentTask = sch[i].ParentTaskName;
        var subTaskLength = await getSubTaskCount(iParentTask);
        console.log('George: ' + subTaskLength);
        var TaskName = iParentTask + '-' + subTaskLength;
        console.log('George TaskName: ' + TaskName);
        var taskObj = {
          task_parent_name: iParentTask,
          task_name: TaskName,
          task_desc: sch[i].Description,
          task_status: 'Planning',
          task_creator: sch[i].Creator,
          task_type_id: sch[i].TaskTypeId,
          task_effort: sch[i].Effort,
          task_estimation: sch[i].Estimation,
          task_issue_date: day,
          task_target_complete: null,
          task_actual_complete: null,
          task_level: sch[i].TaskLevel,
          task_responsible_leader: sch[i].RespLeaderId,
          task_assignee: null,
          task_reference: sch[i].Reference,
          task_scope: sch[i].Scope,
          task_top_constraint: null,
          task_top_opp_name: null,
          task_top_customer: null,
          task_top_facing_client: null,
          task_top_type_of_work: null,
          task_top_chance_winning: null,
          task_top_sow_confirmation: null,
          task_top_business_value: null,
          task_top_target_start: null,
          task_top_target_end: null,
          task_top_paint_points: null,
          task_top_team_sizing: null,
          task_top_skill: null,
          task_top_opps_project: null,
          task_group_id: sch[i].TaskGroupId,
          task_TypeTag: 'One-Off Task',
          task_deliverableTag: null,
          task_detail: null
        };
        saveTask(JSON.stringify(taskObj),null,'regularCreate');
      }
    });
  }

module.exports = {
  saveTask,
  createTaskByScheduleJob
}