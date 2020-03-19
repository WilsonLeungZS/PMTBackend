var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var Format = require('../model/format');
var User = require('../model/user');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response formats resource'});
});

//Format
router.post('/addCustomize',function(req,res,next){

    console.log('addCustomize')
    var userId = req.body.wUserId
    Format.findOrCreate({
        where: userId,
        defaults:{
            userId : req.body.wUserId,
            customizeName : req.body.wCustomizeName,
            report : req.body.wReport,
            format : req.body.wFormat
        }
    })
    .spread(function(format,created){
        if(created){
            return  res.json(responseMessage(0, taskType, 'Created Customize successfully!'));
        }else if(format !=null && !created){
            console.log("already exist!")
        }
    })
});

module.exports = router;

    console.log("addCustomize")
    console.log(req.body)
    var userId = req.body.userId
    var report = req.body.report
    var format = req.body.format
    var customizeName = req.body.customizeName
    Format.findOrCreate({
        where: {customizeName:customizeName},
        defaults:{
            userId : userId,
            report : report,
            format : format
        }
    })
    .spread(function(format,created){
        console.log(created)
        if(created){
            return res.json(responseMessage(0, format, ''));
        }
        else if(format != null && !created){
            return res.json(responseMessage(1, null, 'The format already exists'));
        }
    })
});

router.post('/getCustomizeById',function(req,res,next){
    var Id = req.body.wId;
    console.log(Id);
    Format.findOne({
        where:{
            Id: Id,
        }
    }).then(function(Format1){
        console.log(Format1)
        if(Format1!=null){
                var resJson = {};
                resJson.Id = Format1.Id;
                resJson.userId = Format1.userId;
                resJson.customizeName = Format1.customizeName;
                resJson.report = Format1.report;
                resJson.format = Format1.format
            return res.json(responseMessage(0,resJson,''));
        }else{
            return res.json(responseMessage(1, null, 'No customize user exist'));
        }
        
    })
});

router.post('/getCustomizeByUserId',function(req,res,next){
    console.log('Debug start');
    var rtnResult = [];
    var userId = req.body.wUserId;
    Format.findAll({
        where:{
            userId: userId
        }
    }).then(function(Format1){
        if(Format1.length>0){
            for(var i = 0;i<Format1.length;i++){
                var resJson = {};
                resJson.Id = Format1[i].Id;
                resJson.userId = Format1[i].userId;
                resJson.customizeName = Format1[i].customizeName;
                resJson.report = Format1[i].report;
                resJson.format = Format1[i].format
                rtnResult.push(resJson);
            }
            return res.json(responseMessage(0,rtnResult,''));
        }else{
            return res.json(responseMessage(1, null, 'No customize user exist'));
        }
        
    })
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
    var resJson = {}; 
    resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
    return resJson;
  }
module.exports = router;
