var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var Utils = require('../util/utils');


var Skill = require('../models/skill');

// Create or update skill
router.post('/updateSkill', function (req, res, next) {
    console.log('Start to create or update skill');
    let skillData = {
        Id: req.body.Id,
        Name: req.body.Name,
        Description: req.body.Description,
        Group: req.body.Group,
    }
    Skill.findOrCreate({
        where: {
            Id: req.body.Id || null
        },
        defaults: skillData
    }).spread(async function (skill, created) {
        if (created) {
            console.log('skill -> ', skill)
            return res.json(Utils.responseMessage(0, skill, 'Create skill successfully!'));
        }
        else if (skill != null && !created) {
            await skill.update(skillData);
            return res.json(Utils.responseMessage(0, skill, 'Update skill successfully!'));
        }
        else {
            return res.json(Utils.responseMessage(1, null, 'Created or updated skill fail!'));
        }
    })
});

module.exports = router;
