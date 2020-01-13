var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var User = require('../model/user');
var moment = require('moment');

var Format = sequelize.define('format',{
    Id:{ type:Sequelize.INTEGER,primaryKey: true, autoIncrement:true},
    customizeName : { type:Sequelize.STRING},
    report : { type:Sequelize.STRING},
    format : { type:Sequelize.STRING},
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
},{
    freezeTableName: false
});

Format.belongsTo(User,{foreignKey:'userId'});

Format.sync();
module.exports = Format; 