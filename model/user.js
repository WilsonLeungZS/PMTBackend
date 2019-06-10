var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

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
    Team: {
        type: Sequelize.INTEGER
    },
    Enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    Admin: {
        type: Sequelize.BOOLEAN,
        allowNull: false
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

User.sync();
module.exports = User;

