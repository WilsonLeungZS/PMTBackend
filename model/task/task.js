var Sequelize = require('sequelize');
var moment = require('moment');
var sequelize = require('../../config/db');
var TaskType = require('./task_type');
var Team = require('../team/team');
var User = require('../user')


var Task = sequelize.define('task', {
    Id: { type:Sequelize.INTEGER, primaryKey: true, autoIncrement:true },
    ParentTaskName: { type: Sequelize.STRING },
    TaskName: { type: Sequelize.STRING, allowNull: false },
    Description: { type: Sequelize.STRING },
    Priority: { type: Sequelize.STRING },
    Status: { type:Sequelize.STRING, allowNull: false },
    Creator: { type: Sequelize.STRING, allowNull: false },
    Effort: { type:Sequelize.INTEGER },
    Estimation: { type:Sequelize.INTEGER },
    StartDate: { type:Sequelize.STRING },
    DueDate: { type:Sequelize.STRING },
    BusinessArea: { type:Sequelize.STRING },
    BizProject: { type:Sequelize.STRING },
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

Task.belongsTo(TaskType, {foreignKey: 'TaskTypeId'});
Task.belongsTo(Team, {foreignKey: 'AssignTeamId'});
Task.belongsTo(User, {foreignKey: 'AssignUserId'});


//Task.sync({force: true});
Task.sync();
module.exports = Task;


//TaskTypeId: { type:Sequelize.INTEGER, allowNull: false },