var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var Utils = require('../util/utils');

var Role = require('../models/role');

router.get('/getRoleList', async function (req, res, next) {
    const role = await Role.findAll();
    if (role.length != 0) {
        return res.json(Utils.responseMessage(0, role, 'get role successfully!'));
    } else {
        return res.json(Utils.responseMessage(1, null, 'get role fail!'));
    }
});

// Create or update role
router.post('/updaterole', function (req, res, next) {
    console.log('Start to create or update role');
    let roleData = {
        Id: req.body.Id,
        Name: req.body.Name,
        level: req.body.level,
        remark: req.body.remark,
    }
    Role.findOrCreate({
        where: {
            Id: req.body.Id || null
        },
        defaults: roleData
    }).spread(async function (role, created) {
        if (created) {
            console.log('role -> ', role)
            return res.json(Utils.responseMessage(0, role, 'Create role successfully!'));
        }
        else if (role != null && !created) {
            await role.update(roleData);
            return res.json(Utils.responseMessage(0, role, 'Update role successfully!'));
        }
        else {
            return res.json(Utils.responseMessage(1, null, 'Created or updated role fail!'));
        }
    })
});





module.exports = router;
