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