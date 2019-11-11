var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');
var Team = require('./team/team');

var User = sequelize.define('user', {
    Id:{ 
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    Name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    Email: {
        type: Sequelize.STRING
    },
    IsActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    Role: {
        type: Sequelize.STRING,
        allowNull: false
    },
    ThemeStyle: {
        type:Sequelize.INTEGER,
        allowNull: false,
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

User.belongsTo(Team, {foreignKey: 'TeamId'});

User.sync();
module.exports = User;

