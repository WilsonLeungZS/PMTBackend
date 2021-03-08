/*
 * @Description: DailyScrum table in database
 * @Author: Wilson Liang
 * @Date: 2021-03-05
 * @LastEditTime: 2021-03-05
 * @LastEditors: Wilson Liang
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var Sprint = require('./sprint');
var User = require('./user');

var DailyScrum = sequelize.define('daily_scrum', {
    Id:{ 
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ScrumDate: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    Attendance: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    Completion: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
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

DailyScrum.belongsTo(Sprint, {foreignKey: 'SprintId'});
DailyScrum.belongsTo(User, {foreignKey: 'UserId'});

DailyScrum.sync();
module.exports = DailyScrum;

