/*
 * @Description: User table in database
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var User = sequelize.define('user', {
    Id:{ 
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    Nickname: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    EmployeeNbr: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    Email: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    Role: {
        type: Sequelize.STRING,
        defaultValue: 'General'
    },
    ThemeStyle: {
        type:Sequelize.INTEGER,
        defaultValue: 0
    },
    NameMappings: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    Level: {
        type:Sequelize.INTEGER,
        defaultValue: -1
    },
    EmailGroups: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    Skills: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    WorkingHrs: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    IsActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: 0
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

User.sync();
module.exports = User;

