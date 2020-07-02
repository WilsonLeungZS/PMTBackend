/*
 * @Description: 
 * @Author: 
 * @Date: 2020-06-13 12:59:52
 * @LastEditTime: 2020-06-15 16:38:03
 * @LastEditors: Wanlin Chen
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var Schedule = sequelize.define('schedule',{
    Id:{ type:Sequelize.INTEGER,primaryKey: true, autoIncrement:true},
    JobId:{ type:Sequelize.STRING},
    TaskName : { type:Sequelize.STRING},
    TaskId : { type:Sequelize.INTEGER},
    Schedule : { type:Sequelize.STRING},
    RegularTime : { type:Sequelize.STRING},
    StartTime : { type:Sequelize.STRING},
    EndTime : { type:Sequelize.STRING},
    PreviousTime : { type:Sequelize.STRING},
    LastTime : { type:Sequelize.STRING},
    Status : { type:Sequelize.STRING},
    cronJonTime: {type:Sequelize.STRING},
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
},{
    freezeTableName: false
});


Schedule.sync();
module.exports = Schedule; 