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
    IssueDate: { type:Sequelize.STRING },
    TargetCompleteDate: { type:Sequelize.STRING },
    ActualCompleteDate: { type:Sequelize.STRING },
    BusinessArea: { type:Sequelize.STRING },
    BizProject: { type:Sequelize.STRING },
    TaskLevel: {
        type: Sequelize.INTEGER,
        defaultValue: 1
    },
    RespLeaderId: { type:Sequelize.INTEGER },
    AssigneeId: { type:Sequelize.INTEGER },
    TopConstraint: { type:Sequelize.STRING },
    TopOppName: { type:Sequelize.STRING },
    TopCustomer: { type:Sequelize.STRING },
    TopFacingClient: { type:Sequelize.STRING },
    TopTypeOfWork: { type:Sequelize.STRING },
    TopChanceWinning : { type:Sequelize.STRING },
    TopSowConfirmation: { type:Sequelize.STRING },
    TopBusinessValue: { type:Sequelize.STRING },
    TopTargetStart: { type:Sequelize.STRING },
    TopTargetEnd: { type:Sequelize.STRING },
    TopPaintPoints: { type:Sequelize.STRING },
    TopTeamSizing: { type:Sequelize.STRING },
    TopSkill: { type:Sequelize.STRING },
    TopOppsProject: { type:Sequelize.STRING },
    Reference: { type:Sequelize.STRING },
    Scope: { type:Sequelize.STRING },
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

//Task.sync({force: true});
Task.sync();
module.exports = Task;
