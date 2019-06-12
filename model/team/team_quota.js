var Sequelize = require('sequelize');
var sequelize = require('../../config/db');
var moment = require('moment');
var Team = require('./team');
var TaskType = require('../task/task_type');

var TeamQuota = sequelize.define('team_quota', {
    Id:{ 
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    Quota: { type:Sequelize.STRING },
    Value: { type:Sequelize.STRING },
    Period: { type:Sequelize.STRING },
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

TeamQuota.belongsTo(TaskType, {foreignKey: 'TaskTypeId'});
TeamQuota.belongsTo(Team, {foreignKey: 'TeamId'});

TeamQuota.sync();
module.exports = TeamQuota;