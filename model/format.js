var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var User = require('../model/user');

var Format = sequelize.define('format',{
    Id:{ type:Sequelize.INTEGER,primaryKey: true, autoIncrement:true},
    customizeName : { type:Sequelize.STRING},
    report : { type:Sequelize.STRING},
    format : { type:Sequelize.STRING},
},{
    freezeTableName: false
});

Format.belongsTo(User,{foreignKey:'userId'});

Format.sync();
module.exports = Format; 