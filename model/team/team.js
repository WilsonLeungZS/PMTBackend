var Sequelize = require('sequelize');
var sequelize = require('../../config/db');
var moment = require('moment');

var Team = sequelize.define('team', {
    Id:{ 
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    Name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    Description: { type: Sequelize.STRING },
    IsActive: { type: Sequelize.BOOLEAN },
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

Team.sync();
module.exports = Team;