/*
 * @Description: Customer table in database
 * @Author: Wilson Liang
 * @Date: 2021-03-22
 * @LastEditTime: 2021-03-22
 * @LastEditors: Wilson Liang
 */ 
var Sequelize = require('sequelize');
var sequelize = require('../config/db');
var moment = require('moment');

var User = require('./user');

var Customer = sequelize.define('customer', {
    Id:{ 
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Name: {
        type: Sequelize.STRING(255),
        allowNull: false
    },
    Description: {
        type: Sequelize.STRING(1000),
        defaultValue: null
    },
    Homepage: {
        type: Sequelize.STRING(1000),
        defaultValue: null
    },
    EmailDomain: {
        type: Sequelize.STRING(255),
        defaultValue: null
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

Customer.belongsTo(User, {foreignKey: 'RoleClientLeadId'});
Customer.belongsTo(User, {foreignKey: 'SprintLeadId'});

Customer.sync();
module.exports = Customer;

