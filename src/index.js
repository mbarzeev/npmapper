import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import reduce from 'awaity/reduce';
import open from 'open';
import {generateReport as generateHtmlReport} from './reports/html/html-reporter';
import {
    REPORTS_OUTPUT_PATH,
    REPORT_FILE_NAME,
    TYPE_SCRIPT,
    TYPE_COMMAND,
    HTML_REPORT_TYPE,
    JSON_REPORT_TYPE,
    NOT_AVAILABLE,
    SERIAL_COMMAND_DELIMITER,
    PRE_SCRIPT_PREFIX,
    POST_SCRIPT_PREFIX,
    NESTED_SCRIPT_REGEX,
    PREFIX_REGEX,
    PREFIX_VALUE_REGEX,
    CONFIG_PROP_REGEX,
    COMMAND_NAME_REGEX,
    PARAMS_REGEX,
    EQUAL_SIGN_REGEX,
    NPM_PARAMS,
} from './constants';

let originJsonFilePath;

/**
 * The tool's entry point. Extracts the CLI params, calls to map the scripts and
 * creates a report
 * @param {Object} options - An object containing the params passed on the CLI
 */
export async function mapNpmScripts(options) {
    const {targetDir, scriptName, reportType} = options;
    const jsonFilePath = path.resolve(targetDir, 'package.json');
    try {
        originJsonFilePath = jsonFilePath;
        const result = await parseNpmScripts(jsonFilePath, scriptName);
        createReport(result, targetDir, reportType);
    } catch (error) {
        console.error(`${chalk.red.bold(error)}`);
        throw error;
    }
}

/**
 * Reads the package.json file content and calls to retrieve the mapping result
 * from it
 * @param {string} jsonFilePath - The path to the package.json file
 * @param {string} desiredScript - A specific script we wish to map
 * @returns {Array} The mapping result Array
 */
export async function parseNpmScripts(jsonFilePath, desiredScript) {
    // Check if the file is accessible
    await getIsJsonFileAccessible(jsonFilePath);
    // Read the file
    const jsonFileContent = await getJsonFileContent(jsonFilePath);
    // Map the npm scripts
    const scripts = desiredScript ? [desiredScript] : Object.keys(jsonFileContent.scripts);
    const result = await getScriptsArray(jsonFileContent, scripts);
    // If we are "jumping" to another package.json file we indicate it by
    // setting the location of the first script on that location
    if (jsonFilePath !== originJsonFilePath) {
        result[0].location = jsonFilePath;
    }
    return result;
}

/**
 * Returns an Array representing the scripts tree according to the scripts provided
 * @param {Object} jsonFileContent - An object representing the package.json content
 * @param {Array} scripts - An array of scripts to map
 * @returns {Array} An Array representing the scripts
 */
async function getScriptsArray(jsonFileContent, scripts) {
    return await reduce(
        scripts,
        async (accumulate, scriptName) => {
            const singleScriptObject = await getSingleScriptObject(scriptName, jsonFileContent);
            accumulate.push(singleScriptObject);
            return accumulate;
        },
        []
    );
}

/**
 * Returns a single script object by the given script name. This method also
 * supports recursion if there are nested scripts detected.
 * If needed, it can also "jump" to another package.json if a nested script with
 * prefix param was detected
 * @param {string} scriptName - The script name we wish to map
 * @param {Object} jsonFileContent - An object representing the package.json content
 * @returns {Object} A single script object with all the data gathered for it
 * @throws Will throw an error if the script cannot be found
 */
async function getSingleScriptObject(scriptName, jsonFileContent) {
    const scriptsConfig = jsonFileContent.config;

    // If the scriptName is actually an action which has a prefix parameter to it...
    if (PREFIX_REGEX.test(scriptName)) {
        const prefixValue = PREFIX_VALUE_REGEX.exec(scriptName)[1];
        let prefixPath;

        // If the config value is resolved from an npm config extract the value
        // from it otherwise take it as is
        if (CONFIG_PROP_REGEX.test(prefixValue)) {
            const configProp = prefixValue.replace(CONFIG_PROP_REGEX, '');
            prefixPath = scriptsConfig[configProp];
        } else {
            prefixPath = prefixValue;
        }

        // Remove all the command params and spaces from the nested script
        const trimmedScriptName = scriptName.replace(PARAMS_REGEX, '').trim();
        const nestedScriptTree = await parseNpmScripts(path.resolve(prefixPath, 'package.json'), trimmedScriptName);
        return nestedScriptTree[0];
    } else {
        // Does the script have params to it?
        const hasParams = PARAMS_REGEX.test(scriptName);
        let params = [];

        if (hasParams) {
            params = extractParamsFromActionStr(scriptName, scriptsConfig);
            scriptName = COMMAND_NAME_REGEX.exec(scriptName)[0];
        }

        const trimmedScriptName = scriptName && scriptName.trim();
        const scriptsObj = jsonFileContent.scripts;

        if (trimmedScriptName && scriptsObj[trimmedScriptName]) {
            const rawScriptObj = scriptsObj[trimmedScriptName];
            const actions = rawScriptObj.split(SERIAL_COMMAND_DELIMITER).map(step => step.trim());
            const actionsArray = await getActionsArray(actions, jsonFileContent);
            const resultScriptObj = {
                type: TYPE_SCRIPT,
                name: scriptName,
                pre: NOT_AVAILABLE,
                post: NOT_AVAILABLE,
                params,
                actions: [],
            };

            // If the script has a pre script
            if (scriptsObj[`${PRE_SCRIPT_PREFIX}${trimmedScriptName}`]) {
                resultScriptObj.pre = await getSingleScriptObject(
                    `${PRE_SCRIPT_PREFIX}${trimmedScriptName}`,
                    jsonFileContent
                );
            }

            // The script itself
            resultScriptObj.actions = actionsArray;

            // If the script has a post script
            if (scriptsObj[`${POST_SCRIPT_PREFIX}${trimmedScriptName}`]) {
                resultScriptObj.post = await getSingleScriptObject(
                    `${POST_SCRIPT_PREFIX}${trimmedScriptName}`,
                    jsonFileContent
                );
            }

            return resultScriptObj;
        } else {
            throw new Error(`No script by the name "${trimmedScriptName}" was found`);
        }
    }
}

/**
 * Given an action (script or command) string, it will attempt to extract the
 * params from it and return as a structured object
 * @param {String} actionStr - The full action string with params
 * @param {Object} scriptsConfig - An object representing the npm configuration
 * @returns {Array} The processed params array
 */
function extractParamsFromActionStr(actionStr, scriptsConfig = {}) {
    const totalFullParams = actionStr.match(PARAMS_REGEX);
    const params = totalFullParams.map(singleFullParam => {
        const isSeparateWithEqualSign = EQUAL_SIGN_REGEX.test(singleFullParam);
        const separator = isSeparateWithEqualSign ? '=' : ' ';
        let [name, value] = singleFullParam.split(separator);
        if (CONFIG_PROP_REGEX.test(value)) {
            const configProp = value.replace(CONFIG_PROP_REGEX, '');
            value = `${scriptsConfig[configProp]} (from npm configuration named "${configProp}")`;
        }
        return {
            name,
            value,
        };
    });
    return params;
}

/**
 * Goes over the raw actions array given and process it
 * @param {Array} rawActions
 * @param {Object} jsonFileContent - An object representing the package.json content
 * @returns {Array}
 */
async function getActionsArray(rawActions, jsonFileContent) {
    const scriptsConfig = jsonFileContent.config;
    return await reduce(
        rawActions,
        async (acc, curr) => {
            // If the action is a nested NPM script we wish to dig inside it
            if (NESTED_SCRIPT_REGEX.test(curr)) {
                const nestedScriptName = curr.replace(NESTED_SCRIPT_REGEX, '');
                // Trim and clear any NPM's params (in the future it will be nice
                // to support them as well)
                const trimmedNestedScriptName = nestedScriptName.replace(NPM_PARAMS, '').trim();
                const singleScriptObject = await getSingleScriptObject(trimmedNestedScriptName, jsonFileContent);
                acc.push(singleScriptObject);
            } else {
                // If the action is not a nested script we are dealing with a command
                acc.push(getSingleCommandObject(curr, scriptsConfig));
            }
            return acc;
        },
        []
    );
}

/**
 * Returns an Object which represents a single command with its params attached
 * @param {string} rawCommand
 * @param {Object} scriptsConfig - An object representing the npm configuration
 * @returns {Object} An Object representing a single command
 */
export function getSingleCommandObject(rawCommand, scriptsConfig) {
    let params = [];
    const hasParams = PARAMS_REGEX.test(rawCommand);

    if (hasParams) {
        params = extractParamsFromActionStr(rawCommand, scriptsConfig);
        rawCommand = COMMAND_NAME_REGEX.exec(rawCommand)[0];
    }
    return {type: TYPE_COMMAND, name: rawCommand, params};
}

/**
 * Returns the json file content found on the path given
 * @param {String} jsonFilePath
 */
async function getJsonFileContent(jsonFilePath) {
    try {
        const jsonFileContentData = await fs.readFile(jsonFilePath, 'utf-8');
        return JSON.parse(jsonFileContentData);
    } catch (error) {
        console.error('%s Could not read package.json file', chalk.red.bold('ERROR'));
        process.exit(1);
    }
}

/**
 * Attempts to access the json file given and exist if fails.
 * @param {String} jsonFilePath
 * @throws Will throw an error if a package.json file cannot be found in the
 * given path
 */
async function getIsJsonFileAccessible(jsonFilePath) {
    try {
        await fs.access(jsonFilePath, fs.constants.R_OK);
    } catch (error) {
        throw new Error(`No package.json file can be found on ${jsonFilePath}`);
    }
}

/**
 * Calls to generate a report according to the type requested
 * @param {Object} scriptsMappingResult - The mapping result as an Object
 * @param {string} packageJsonFilePath
 * @param {string} reportType - 'html' or 'json', default is html
 */
async function createReport(scriptsMappingResult, packageJsonFilePath, reportType) {
    switch (reportType) {
        case JSON_REPORT_TYPE:
            await createJsonReport(scriptsMappingResult);
            break;
        case HTML_REPORT_TYPE:
        default:
            await createHtmlReport(scriptsMappingResult, packageJsonFilePath);
            break;
    }
}

/**
 * Takes the scripts mapping results, converts it to a string and call to write
 * it to a file
 * @param {Object} scriptsMappingResult - The mapping
 */
async function createJsonReport(scriptsMappingResult) {
    const fileName = `${REPORT_FILE_NAME}.json`;
    writeReportFile(fileName, JSON.stringify(scriptsMappingResult));
}

/**
 * Calls to generate an HTML report from the mapping result, then copies assets
 * to support the report and opens the report in a browser
 * @param {Object} scriptsMappingResult - The mapping result as an Object
 * @param {string} packageJsonFilePath
 */
async function createHtmlReport(scriptsMappingResult, packageJsonFilePath) {
    const htmlReport = await generateHtmlReport(scriptsMappingResult, packageJsonFilePath);
    const fileName = `${REPORT_FILE_NAME}.html`;
    await writeReportFile(fileName, htmlReport);
    // Copy assets files to the target directory
    fs.copyFileSync(`${__dirname}/reports/html/report.css`, `${REPORTS_OUTPUT_PATH}/report.css`);
    fs.copyFileSync(`${__dirname}/reports/html/icofont.min.css`, `${REPORTS_OUTPUT_PATH}/icofont.min.css`);
    fs.copySync(`${__dirname}/reports/html/fonts`, `${REPORTS_OUTPUT_PATH}/fonts`);
    // Open the report in the default browser
    open(`${REPORTS_OUTPUT_PATH}/${REPORT_FILE_NAME}.html`);
}

/**
 * Writes the report to the file system using the given file name and the content
 * @param {string} fileName - The file name to be used for the report
 * @param {string} content - The content of the report
 */
async function writeReportFile(fileName, content) {
    if (!fs.existsSync(REPORTS_OUTPUT_PATH)) {
        await fs.mkdirSync(REPORTS_OUTPUT_PATH);
    }
    await fs.writeFile(`${REPORTS_OUTPUT_PATH}/${fileName}`, content);
}
