/*
 * @Description: 
 * @Author: 
 * @Date: 2020-06-04 09:41:37
 * @LastEditTime: 2020-06-13 14:10:14
 * @LastEditors: Wanlin Chen
 */ 
var express = require('express');
var compression = require('compression');
var createError = require('http-errors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var tasksRouter = require('./routes/tasks');
var worklogRouter = require('./routes/worklogs');
var formatRouter = require('./routes/formats');
var scheduleRouter = require('./routes/schedules')

var app = express();

app.use(compression());

// view engine setup
//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With,Content-Type");
  res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
  //res.header("Cache-Control", "max-age=10, public");
  next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/tasks', tasksRouter);
app.use('/worklogs', worklogRouter);
app.use('/schedules', scheduleRouter);
app.use('/formats', formatRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.status(500).json({
    message: err.message,
    error: err
  });
});

module.exports = app;
