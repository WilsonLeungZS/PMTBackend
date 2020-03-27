var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var TypeTag = require('../model/typetag');
var User = require('../model/user');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response typetag resource'});
});


module.exports = router;