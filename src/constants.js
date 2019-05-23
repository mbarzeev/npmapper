const cwd = process.cwd();

export const HTML_REPORT_TEMPLATE_PATH = `${__dirname}/reports/html/report-template.html`;
export const REPORTS_OUTPUT_PATH = `${cwd}/npmapper`;
export const REPORT_FILE_NAME = 'npmapper-report';
export const TYPE_SCRIPT = 'script';
export const TYPE_COMMAND = 'command';
export const NOT_AVAILABLE = 'N/A';
export const SERIAL_COMMAND_DELIMITER = '&&';
export const PRE_SCRIPT_PREFIX = 'pre';
export const POST_SCRIPT_PREFIX = 'post';
export const NESTED_SCRIPT_REGEX = /^npm run\s/;
export const PREFIX_REGEX = /--prefix /;
export const PREFIX_VALUE_REGEX = /--prefix\s+("[^"]*"|\S*)/;
export const CONFIG_PROP_REGEX = /\$npm_package_config_/;
export const COMMAND_NAME_REGEX = /.*?(?=\s-)/;
export const PARAMS_REGEX = new RegExp(`(?<=\\s)-(?:(?!(\\s-|${SERIAL_COMMAND_DELIMITER})).)*`, 'gm');
export const EQUAL_SIGN_REGEX = /\=/;
export const NPM_PARAMS = /(--silent|--quiet)/;

export const SCRIPT_ACTION_METADATA = {
    title: 'NPM Script',
    iconClass: 'icofont-gear',
};

export const COMMAND_ACTION_METADATA = {
    title: 'Command',
    iconClass: 'icofont-automation',
};

export const ACTION_METADATA_DICT = {
    [TYPE_SCRIPT]: SCRIPT_ACTION_METADATA,
    [TYPE_COMMAND]: COMMAND_ACTION_METADATA,
};

export const HTML_REPORT_TYPE = 'html';
export const JSON_REPORT_TYPE = 'json';
