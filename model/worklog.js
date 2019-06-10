var Sequelize = require('sequelize');
var moment = require('moment');
var sequelize = require('../config/db');
var Task = require('../model/task/task');
var User = require('../model/user');

var Worklog = sequelize.define('worklog', {
    Id:{ type:Sequelize.INTEGER, primaryKey: true, autoIncrement:true }, 
    Remark: { type: Sequelize.STRING },
    Effort: { type: Sequelize.INTEGER, defaultValue: 0},
    WorklogMonth: { type: Sequelize.STRING},
    WorklogDay: { type: Sequelize.STRING },
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

Worklog.belongsTo(Task, {foreignKey: 'TaskId'});
Worklog.belongsTo(User, {foreignKey: 'UserId'});

//Worklog.sync({force: true});
Worklog.sync();
module.exports = Worklog;
