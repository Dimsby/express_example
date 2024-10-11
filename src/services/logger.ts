import winston from 'winston'
import expressWinston from "express-winston";
import 'winston-daily-rotate-file';

import {format as formatfns} from "date-fns";

const {transports, format, createLogger} = winston
const {combine, printf, timestamp, prettyPrint, colorize, errors} = format

const msgToString = (msg: any): string => msg ? (typeof msg === 'object' ? JSON.stringify(msg) : msg) : '' // JSON.stringify(msg, undefined, 2)

const customLog = printf(info => {
    const msg = msgToString(info.message)
    const timestamp = Date.now()
    const formatted = formatfns(Date.now(), 'yyyyMMdd HH:mm:ss.SSS');

    // @ts-ignore
    const args = info[Symbol.for('splat')];

    let data = ''
    if (args) {
        args.forEach((arg) => {
            data += ` [${msgToString(arg)}]`
        })
    }

    //const data = args? (msgToString(args[0])) : false

    return `[${formatted}] [${timestamp}] [${info.level}] [${msg}] ${info.stack ? ('[' + info.stack + ']') : ''}${data}`
})

const options = {
    info: {
        level: 'info',
        dirname: 'logs/info',
        handleExceptions: true,
        filename: `combine-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '50m',
        maxFiles: '14d'
        //    format: combine(errors({ stack: true }), format.json()),
    },
    error: {
        level: 'error',
        dirname: 'logs/error',
        handleExceptions: true,
        filename: `error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '50m',
        maxFiles: '14d'
        //    format: combine(errors({ stack: true }), format.json()),
    },
    console: {
        level: 'debug',
        handleExceptions: true,
        colorize: true,
        //     format: combine(customLog),
    },
}

const logger = createLogger({
    format: combine(errors({stack: true}), customLog),
    transports: [
        new transports.DailyRotateFile(options.info),
        new transports.DailyRotateFile(options.error),
        new transports.Console(options.console)
    ],
    exitOnError: false
})

const routesLogger = expressWinston.logger({
    format: combine(customLog),
    transports: [
        new transports.DailyRotateFile(options.info)
    ],
    meta: true, // optional: control whether you want to log the meta data about the request (default to true)
    msg: "HTTPS {{req.method}} {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
    ignoreRoute: function (req, res) {
        return false;
    } // optional: allows to skip some log messages based on request and/or response
})

export {logger, routesLogger}