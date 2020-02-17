var Sequelize = require('sequelize');
var sequelize = require('../../config/db');
var moment = require('moment');

var TaskGroup = sequelize.define('task_group', {
    Id:{ 
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    Name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    StartTime: {
        type: Sequelize.STRING
    },
    EndTime: {
        type: Sequelize.STRING
    },
    Remark: {
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

TaskGroup.sync();
module.exports = TaskGroup;