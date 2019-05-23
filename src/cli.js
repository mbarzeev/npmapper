import {mapNpmScripts} from './index';
import {HTML_REPORT_TYPE} from './constants';
import program from 'commander';

program
    .option('-d, --dir <string>', 'The directory npmapper should work on (where the package.json is at)', process.cwd())
    .option('-s, --script-name <string>', 'A specific npm script you want to map')
    .option('-t, --report-type <type>', 'The desired type of the report. Default is HTML. use json to generate a json report', HTML_REPORT_TYPE);

export function cli(args) {
    program.parse(args);
    const targetDir = program.dir;
    const scriptName = program.scriptName;
    const reportType = program.reportType;
    mapNpmScripts({targetDir, scriptName, reportType});
}
