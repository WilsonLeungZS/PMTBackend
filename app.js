/*
 * @Description: Controller of backend
 * @Author: Wilson Liang
 * @Date: 2021-01-12
 * @LastEditTime: 2021-01-12
 * @LastEditors: Wilson Liang
 */ 
var express = require('express');
var compression = require('compression');
var createError = require('http-errors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var sprintsRouter = require('./routes/sprints')
var tasksRouter = require('./routes/tasks');
var worklogRouter = require('./routes/worklogs');
//var formatRouter = require('./routes/formats');
//var scheduleRouter = require('./routes/schedules')

var app = express();

app.use(compression());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With,Content-Type");
  res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
  next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/sprints', sprintsRouter);
app.use('/tasks', tasksRouter);
app.use('/worklogs', worklogRouter);
//app.use('/schedules', scheduleRouter);
//app.use('/formats', formatRouter);

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
