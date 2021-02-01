/*
 * @Description: Task table in database
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var User = require('./user');
var Sprint = require('./sprint')

var Task = sequelize.define('task', {
    Id:{ 
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    HasSubtask: { type: Sequelize.STRING, defaultValue: 'N' },
    ParentTaskName: { type: Sequelize.STRING, defaultValue: null },
    Name: { type: Sequelize.STRING, allowNull: false },
    Category: { type: Sequelize.STRING, defaultValue: 'PMT-TASK' },
    Type: { type: Sequelize.STRING, defaultValue: null },
    Title: { type: Sequelize.STRING, allowNull: false },
    Description: { type: Sequelize.STRING, defaultValue: null },
    ReferenceTask: { type: Sequelize.STRING, defaultValue: null },
    TypeTag: { type: Sequelize.STRING, defaultValue: null },
    DeliverableTag: { type: Sequelize.STRING, defaultValue: null },
    Creator: { type: Sequelize.STRING, defaultValue: 'PMT' },
    RequiredSkills: { type: Sequelize.STRING, defaultValue: null },
    Customer: { type: Sequelize.STRING, defaultValue: null },
    Status: { type: Sequelize.STRING, defaultValue: 'Drafting' },
    Effort: { type: Sequelize.FLOAT(11,1), defaultValue: 0 },
    Estimation: { type: Sequelize.INTEGER, defaultValue: 0 },
    IssueDate: { type: Sequelize.STRING, defaultValue: null },
    TargetComplete: { type: Sequelize.STRING, defaultValue: null },
    ActualComplete: { type: Sequelize.STRING, defaultValue: null },
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

Task.belongsTo(User, {foreignKey: 'RespLeaderId'});
Task.belongsTo(User, {foreignKey: 'AssigneeId'});
Task.belongsTo(Sprint, {foreignKey: 'SprintId'});

Task.sync();
module.exports = Task;