const cron = require('node-cron');

const job = cron.schedule("* * * * *", () => {
    console.log(' ping each minute ');
}, {
    scheduled: false
});

export default job
