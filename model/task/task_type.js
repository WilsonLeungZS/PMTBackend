var Sequelize = require('sequelize');
var sequelize = require('../../config/db');
var moment = require('moment');

var TaskType = sequelize.define('task_type', {
    Id:{ 
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    ParentType: {
        type: Sequelize.STRING
    },
    Name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    Prefix: {
        type: Sequelize.STRING
    },
    Category: {
        type: Sequelize.STRING,
        allowNull: false
    },
    Value: { type: Sequelize.STRING },
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

TaskType.sync();
module.exports = TaskType;