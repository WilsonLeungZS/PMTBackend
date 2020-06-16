/*
 * @Description: 
 * @Author: 
 * @Date: 2020-06-13 13:13:52
 * @LastEditTime: 2020-06-15 16:31:45
 * @LastEditors: Wanlin Chen
 */ 
var Sequelize = require('sequelize');
var db = require('../config/db');
var express = require('express');
var router = express.Router();
var Schedule = require('../model/schedule')
const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response formats resource'});
});

router.post('/saveRegularTask',function(req,res,next){
    console.log('saveRegularTask')
    Schedule.findOrCreate({
        where: { TaskId : req.body.reqTaskId}, 
        defaults: {
          Schedule: req.body.reqSchedule,
          RegularTime: req.body.reqRegularTaskTime,
          StartTime: req.body.reqStartTime,
          TaskId : req.body.reqTaskId,
          EndTime: req.body.reqEndTime
        }})
      .spread(function(schedule, created) {
        console.log(schedule)
        if(created) {
          return res.json(responseMessage(0, schedule, 'Create schedule successfully!'));
        } 
        else if(schedule != null && !created) {
            schedule.update({
                Schedule: req.body.reqSchedule,
                RegularTime: req.body.reqRegularTaskTime,
                StartTime: req.body.reqStartTime,
                EndTime: req.body.reqEndTime
          });
          return res.json(responseMessage(0, schedule, 'Update schedule successfully!'));
        }
        else {
          return res.json(responseMessage(1, null, 'Created or updated schedule fail!'));
        }
      })
});

router.post('/getSchedulesByTaskName',function(req,res,next){
    console.log('getSchedulesByTaskName')
    Schedule.findOne({
      where: {TaskId: req.body.reqTaskName}
    }).then(async function(schedule) {
        if(schedule!=null) {
          console.log(schedule)
          var rtnResult = {}
          rtnResult.task_startTime = schedule.StartTime
          rtnResult.task_RegularTaskTime = schedule.RegularTime
          rtnResult.task_endTime = schedule.EndTime
          rtnResult.task_scheduletime = schedule.Schedule
          return res.json(responseMessage(0, rtnResult, ''));
        } else {
          return res.json(responseMessage(1, null, 'No sub task exist'));
        }
    })
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
    var resJson = {}; 
    resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
    return resJson;
  }

module.exports = router;