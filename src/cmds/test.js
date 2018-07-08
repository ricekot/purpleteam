const config = require('config/config');
const log = require('purpleteam-logger').logger();
const api = require('src/apiDecoratingAdapter');

api.init(log);

exports.flags = 'test';
exports.description = 'Launch purpleteam to attack your specified target';
exports.setup = (sywac) => {
  debugger;
  sywac.option(
    '-c, --config-file <config-file path>',
    {
      type: 'file', desc: 'Build user supplied configuration file. Must be a file conforming to the schema defined in the purpleteam documentation.', strinct: true, mustExist: true
    }
  )
};
exports.run = async (parsedArgv, context) => {
  if (parsedArgv.c) {    
    const configFileContents = await api.getBuildUserConfigFile(parsedArgv.c);    
    // Todo: KC: In the future we could deserialise configFileContents, and possibly validate before sending to the Orchestrator.
    //    https://github.com/danivek/json-api-serializer looks to be well maintained.
    //    https://github.com/SeyZ/jsonapi-serializer     looks to be a little neglected.



    await api.test(configFileContents);


    // Use a setInterval or promise to keep the process running.

      setInterval(() => {
        console.log('This will not run');
      }, 5000);
    












    //  stream tester log           Print each tester to a table row, and to log file
    //  stream slave log            To artifacts dir



debugger;
    // Todo: KC: Start the testing.
    log.notice('Ok, so test is running', { tags: ['test'] });
  } else {
    context.cliMessage('You must provide a valid build user configuration file that exists on the local file system.');
  }

};
