var log4js = require('log4js');

log4js.configure({
    appenders:{
        console:{
            type : 'console',
        },
        log_file:{
            type: 'file',
            filename: 'logs/pmt.log', 
            alwaysIncludePattern: true,
            maxLogSize : 10485760,
            encoding : 'utf-8'
        },
    },
    categories: {
        default:{appenders:['log_file'], level:'info' },
        console:{appenders:['console'], level:'debug'},
    },
})

module.exports = log4js.getLogger('default');