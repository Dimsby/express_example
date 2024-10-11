import express from 'express';
import bodyParser from 'body-parser';
import * as routers from './routes';
import cookieParser from 'cookie-parser';
import swaggerDefs from './swagger/def';
import swaggerAffiliateDefs from './swagger/defsAffilaites';

import swaggerUI from 'swagger-ui-express';
import * as socket from './services/socket';
import { config } from './config';
import { Storage } from './services/storage';
import { initCacheNode } from './services/cache/cacheNode';

require('dotenv').config();


const fs = require('fs');
const cors = require('cors');


// node-cron tasks
import './tasks';

import { logger, routesLogger } from "./services/logger";
import * as util from "util";
import Settings, { settings } from "./model/Settings";
import Metrics from "./model/Metrics";
import { connectDB } from './utils/mongoose';
import ClientStats from "./model/ClientStats";
import path from "path";


const app = express();

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));


// logging
app.use(routesLogger);

process.on('unhandledRejection', function (reason, p) {
  logger.error('UNHANDLED REJECTION', reason)
  process.exit(1);
});


console.log = function (...msg) {
  logger.info(util.format(...msg))
};

app.use(function (err, req, res, next) {
  logger.error('Unexpected Server Error', err)
  res.status(500).send('Unexpected Server Error')
})


app.use(cors({
  origin: config.cors.origin,
  credentials: true }));

app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDefs));

/*
app.use('/affiliate-docs', swaggerUI.serve, swaggerUI.setup(swaggerAffiliateDefs, {
  explorer: true
})); */

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

//app.use(express.static('public'));
app.use(express.static(__dirname + '/storage'));

Storage.init(config.recordings.storage.opts);

app.get('/custom', (req: express.Request, res: express.Response) => {
  res.status(200).send('Success');
});



const mainRouter = express.Router();

mainRouter.use('/test', routers.testRouter);
mainRouter.use('/auth', routers.authRouter);
mainRouter.use('/users', routers.userRouter);
mainRouter.use('/lookup', routers.lookupRouter);
mainRouter.use('/streams', routers.streamsRouter);
mainRouter.use('/stories', routers.storiesRouter);
mainRouter.use('/private-space', routers.privateSpaceRouter);
mainRouter.use('/subscribe', routers.subscribeRouter);
mainRouter.use('/payments', routers.paymentsRouter);
mainRouter.use('/stats', routers.statsRouter);
mainRouter.use('/cloud', routers.cloudRouter);
mainRouter.use('/messages', routers.messagesRouter);
mainRouter.use('/liveshows', routers.liveshowRouter);
mainRouter.use('/tasks', routers.tasksRouter);
mainRouter.use('/transactions', routers.transactionsRouter);
mainRouter.use('/whitelist', routers.whitelistRouter);
mainRouter.use('/settings', routers.settingsRouter);
mainRouter.use('/service', routers.serviceRouter);
mainRouter.use('/user-paid-social', routers.userPaidSocialRouter);
mainRouter.use('/user-paid-pm', routers.userPaidPMRouter);
mainRouter.use("/admin", routers.adminRouter)
mainRouter.use("/discord", routers.discordRouter)
mainRouter.use("/guests", routers.guestRouter)
mainRouter.use("/records", routers.recordsRouter)
mainRouter.use("/giftcards", routers.giftCardsRouter)
mainRouter.use("/airdrop", routers.airdropRouter)
mainRouter.use("/analytics", routers.analyticsRouter)
mainRouter.use("/postback", routers.postbackRouter)
mainRouter.use("/affiliates", routers.affiliatesRouter)
mainRouter.use("/docs", routers.docsRouter)

// serve static files from src/storage/static/
mainRouter.use("/static", express.static(path.join(__dirname, './storage/static/')))
// serve static files from minio
mainRouter.use("/mstatic", routers.staticRouter)

app.use('/api', mainRouter);

// affiliate docs open api json
app.get("/api/affiliate-docs/swagger.json", (req, res) => res.json(swaggerAffiliateDefs));
// all docs open api json
app.get("/api/docs/swagger.json", (req, res) => res.json(swaggerDefs));

/*app.use(express.static("client/build"));
app.get("*", (req, res) => {
  console.log(path.join(__dirname, "../client", "build", "index.html"));
  res.sendFile(path.join(__dirname, "../client", "build", "index.html")); // relative path
});*/

// fixing nodemon issue with EADDRINUSE:
process.once('SIGUSR2', function () {
  process.kill(process.pid, 'SIGUSR2');
});
process.on('SIGINT', function () {
  // this is only called on ctrl+c, not restart
  process.kill(process.pid, 'SIGINT');
});
//////////////////////////////////////////

const startServer = async () => {
  await connectDB();

  await ClientStats.resetOnRebuild();

  initCacheNode()

  /**
   * Cleaning up all recordings that were in process when servers went reloading
   * Don't need to wait for them
   */
  // finilizeRecordingsServerOnReload();

  Settings.initSettings().then(() => console.log('settings loaded', settings))
  Metrics.updateStatics().then(() => console.log('metrics updated')).catch((e) => logger.error('metrics failed', e))

  const web3Connection = require('./utils/web3');
  web3Connection.connect().then((web3) => {
    logger.info('============= Web3 Connected =============');
    global.WEB3 = web3;

    // start consumer
    if (config.web3.consume) web3Connection.consume_Transfer_event();
      else console.log('web3 consume_Transfer_event disabled')
  })

  if (config.app.use_https !== 'false') {
    // Certificate
    const privateKey = fs.readFileSync(config.cert.private, 'utf8');
    const certificate = fs.readFileSync(config.cert.cert, 'utf8');
    const ca = fs.readFileSync(config.cert.ca, 'utf8');
  
    const credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca
    };
  
    const https = require('https');
  
    const httpsServer = https.createServer(credentials, app);
    socket.initSocketIo(httpsServer);
  
    httpsServer.listen(config.http.port, () => {
      console.log(`HTTPS Server running on port ${config.http.port}`);
    });
  } else {
    const http = require('http');
  
    const httpServer = http.createServer(app);
    socket.initSocketIo(httpServer);
  
    httpServer.listen(config.http.port, () => {
      console.log(`HTTP Server running on port ${config.http.port}`);
    });
  }
}

startServer();