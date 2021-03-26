/*
 * @Description: Timeline table in database
 * @Author: Wilson Liang
 * @Date: 2021-03-25
 * @LastEditTime: 2021-03-25
 * @LastEditors: Wilson Liang
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var Timeline = sequelize.define('timeline', {
    Id:{ 
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Name: {
        type: Sequelize.STRING(255),
        allowNull: false
    },
    StartTime: {
        type: Sequelize.STRING(50),
        allowNull: false
    },
    EndTime: {
        type: Sequelize.STRING(50),
        allowNull: false
    },
    WorkingDays: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    Status: {
        type: Sequelize.STRING(20),
        defaultValue: 'Active'
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

Timeline.sync();
module.exports = Timeline;

