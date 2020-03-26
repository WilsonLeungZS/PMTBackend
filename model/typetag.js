/*
 * @Description: 
 * @Author: 
 * @Date: 2020-03-26 11:33:17
 * @LastEditTime: 2020-03-26 12:02:35
 * @LastEditors: Wanlin Chen
 */
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var TypeTag = sequelize.define('typetag',{
    Id:{ type:Sequelize.INTEGER,primaryKey: true, autoIncrement:true},
    TypeTagName :{ type:Sequelize.STRING},
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

TypeTag.sync();
module.exports = TypeTag; 