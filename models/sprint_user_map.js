/*
 * @Description: SprintUserMap table in database
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var Sprint = require('./sprint');
var User = require('./user');

var SprintUserMap = sequelize.define('sprint_user_map', {
    Id:{ 
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Capacity: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    },
    MaxCapacity: {
        type: Sequelize.INTEGER,
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

SprintUserMap.belongsTo(Sprint, {foreignKey: 'SprintId'});
SprintUserMap.belongsTo(User, {foreignKey: 'UserId'});

SprintUserMap.sync();
module.exports = SprintUserMap;

