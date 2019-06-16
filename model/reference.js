var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var Reference = sequelize.define('reference', {
    Id:{ 
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement:true
    },
    Name: { type: Sequelize.STRING },
    Type: { type: Sequelize.STRING },
    Value: { type: Sequelize.STRING },
    Remark: { type: Sequelize.STRING },
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

Reference.sync();
module.exports = Reference;

