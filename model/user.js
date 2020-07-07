/*
 * @Description: 
 * @Author: 
 * @Date: 2020-06-04 09:41:37
 * @LastEditTime: 2020-06-16 16:22:11
 * @LastEditors: Wanlin Chen
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');
var Team = require('./team/team');

var User = sequelize.define('user', {
    Id:{ 
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    Name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    Nickname: {
        type: Sequelize.STRING
    },
    EmployeeNumber: {
        type: Sequelize.STRING,
    },
    Email: {
        type: Sequelize.STRING
    },
    IsActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    Role: {
        type: Sequelize.STRING,
        allowNull: false
    },
    ThemeStyle: {
        type:Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    NameMapping: {
        type: Sequelize.STRING
    },
    Level: {
        type:Sequelize.INTEGER,
        allowNull: false,
        defaultValue: -1
    },
    Assignment: {
        type: Sequelize.STRING
    },
    EmailGroups: {
        type: Sequelize.STRING
    },
    SkillType: {
        type: Sequelize.STRING
    },
    createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        get() {
            return moment(this.getDataValue('createdAt')).format('YYYY-MM-DD HH:mm:ss');
        }
    },
    updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        get() {
            return moment(this.getDataValue('updatedAt')).format('YYYY-MM-DD HH:mm:ss');
        }
    }
}, {
    freezeTableName: false
});

User.belongsTo(Team, {foreignKey: 'TeamId'});

User.sync();
module.exports = User;

