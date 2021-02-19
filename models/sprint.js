/*
 * @Description: Sprint table in database
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');
var User = require('./user');

var Sprint = sequelize.define('sprint', {
    Id:{ 
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    StartTime: {
        type: Sequelize.STRING,
        allowNull: false
    },
    EndTime: {
        type: Sequelize.STRING,
        allowNull: false
    },
    Baseline: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    WorkingDays: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    BaseCapacity: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    RequiredSkills: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    Status: {
        type: Sequelize.STRING,
        defaultValue: 'Active'
    },
    DataSource: {
        type: Sequelize.STRING(100),
        defaultValue: null
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

// Create foreign Key with user id
Sprint.belongsTo(User, {foreignKey: 'LeaderId'});

Sprint.sync();
module.exports = Sprint;