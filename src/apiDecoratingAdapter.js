const config = require('config/config');
const readFileAsync = require('util').promisify(require('fs').readFile);
const request = require('request-promise-native');
const EventSource = require('eventsource');

const { TesterUnavailable, TestPlanUnavailable } = require('src/strings');

let log;
let apiResponse;

const init = (logger) => {
  if (log) return;
  log = logger;
};

const apiUrl = config.get('purpleteamApi.url');
const testersConfig = config.get('testers');


const getBuildUserConfigFile = async (filePath) => {
  try {
    const fileContents = await readFileAsync(filePath, { encoding: 'utf8' });    
    return fileContents;
  } catch (err) {
    log.error(`Could not read file: ${filePath}, the error was: ${err}`, { tags: ['apiDecoratingAdapter'] });
    throw err;
  }
};


const postToApi = async (configFileContents, route) => {  
  await request({
    uri: `${apiUrl}/${route}`,
    method: 'POST',
    json: true,
    body: configFileContents,
    headers: { 'Content-Type': 'application/vnd.api+json', Accept: 'text/plain' }
  }).then((answer) => {
    apiResponse = answer;
  }).catch((err) => {
    const handle = {
      errorMessageFrame: innerMessage => `Error occured while attempting to communicate with the purpleteam SaaS. Error was: ${innerMessage}`,
      backendTookToLong: '"The purpleteam backend took to long to respond"',
      backendUnreachable: '"The purpleteam backend is currently unreachable".',
      validationError: `Validation of the supplied build user config failed: ${err.error.message}.`,
      syntaxError: `SyntaxError: ${err.error.message}.`,
      unknown: '"Unknown"',
      testPlanFetchFailure: () => {
        if (err.message.includes('socket hang up')) return 'backendTookToLong';
        if (err.message.includes('connect ECONNREFUSED')) return 'backendUnreachable';
        if (err.error.name === 'ValidationError') return 'validationError';
        if (err.error.name === 'SyntaxError') return 'syntaxError';
        return 'unknown';
      }
    };
    log.crit(handle.errorMessageFrame(handle[handle.testPlanFetchFailure()]), { tags: ['apiDecoratingAdapter'] });
  });
};


const recieveTestPlan = (logger) => {
  const loggerName = logger.options.name;
  const testerRepresentative = apiResponse.find(element => element.name === loggerName);

  if (testerRepresentative) {
    logger.log(testerRepresentative.message);
  } else {
    logger.log(`${loggerName} tester doesn't currently appear to be online`);
  }
};


const subscribeToTesterProgress = (logger) => {
  const loggerName = logger.options.name;
  const testerRepresentative = apiResponse.find(element => element.name === loggerName);

  if (testerRepresentative) {
    logger.log(testerRepresentative.message);
    if (testerRepresentative.message !== TesterUnavailable(loggerName)) {
      const eventSource = new EventSource(`${apiUrl}${testersConfig[loggerName].testerProgressRoute}`);
      eventSource.addEventListener('testerProgress', (event) => {
        if (event.origin === apiUrl) {
          logger.log(JSON.parse(event.data).progress);
        } else {
          logger.log(`Origin of event was incorrect. Actual: "${event.origin}", Expected: "${apiUrl}"`);
        }
      });
    }
  } else {
    logger.log(`${loggerName} tester doesn't currently appear to be online`);
  }
};


const recieveTestPlans = (loggers) => {
  loggers.forEach(l => recieveTestPlan(l));
};


const subscribeToTestersProgress = (loggers) => {
  loggers.forEach(l => subscribeToTesterProgress(l));
};


const getTestPlans = async configFileContents =>
  new Promise(async (resolve, reject) => {
    const route = 'testplan';

    await postToApi(configFileContents, route);

    return apiResponse ? resolve(recieveTestPlans) : reject();
  });


const test = async configFileContents =>
  new Promise(async (resolve, reject) => {
    const route = 'test';

    await postToApi(configFileContents, route);

    return apiResponse ? resolve(subscribeToTestersProgress) : reject();

    // To cancel the event stream:
    //    https://github.com/mtharrison/susie#how-do-i-finish-a-sse-stream-for-good
    //    https://www.html5rocks.com/en/tutorials/eventsource/basics/#toc-canceling
  });


module.exports = {
  init,
  getBuildUserConfigFile,
  getTestPlans,
  test
};
