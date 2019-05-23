import fs from 'fs';
import {promisify} from 'util';
import {JSDOM} from 'jsdom';
import {HTML_REPORT_TEMPLATE_PATH, ACTION_METADATA_DICT, NOT_AVAILABLE, TYPE_SCRIPT} from '../../constants';

const readFile = promisify(fs.readFile);
const actionMetadataService = {
    title: NOT_AVAILABLE,
    iconClass: null,
    getTitle(name) {
        return name;
    },
};

/**
 * Read the report html template and appends to it the DOM elements which represents
 * the scripts and commands
 * @param {string} scriptsMappingResult - The mapping result as an Object
 * @param {string} packageJsonFilePath
 * @returns {string} - An HTML serialization of the DOM
 */
export async function generateReport(scriptsMappingResult, packageJsonFilePath) {
    const html = await readFile(HTML_REPORT_TEMPLATE_PATH);
    const dom = new JSDOM(html);
    // Set the title for the report
    dom.window.document.querySelector(
        'h2'
    ).innerHTML = `Mapping npm scripts for package.json file under  <span class="target_dir">${packageJsonFilePath}</span>`;
    // Get the entire actions HTML element and append it
    const scriptsMapHtmlElement = getActionsMapHtmlElement(scriptsMappingResult);
    dom.window.document.querySelector('div.report').appendChild(scriptsMapHtmlElement);
    return dom.serialize();
}

/**
 * Goes over the given actions array and creates a HTML element for each.
 * @param {Array} actions
 * @returns {Object} - The DOM object created
 */
function getActionsMapHtmlElement(actions) {

    /**
     * This inner function get called for any action object. This is where a 
     * recursion happens when we deal with nested or "pre"/"post" scripts
     * @param {Array} actions - The Array of actions, either scripts or commands
     * @param {HTMLElement} parentElem - The parent element to append the newly 
     * created HTML element
     * @returns {HTMLElement} - The parent element given with the appended elements
     * to it
     */
    function appendActionElementsToElement(actions, parentElem) {
        actions.forEach(singleAction => {
            // CURRENT
            const actionElem = getActionHtmlElem(singleAction, dom, counter++);
            const innerContentElem = actionElem.querySelector('.content-inner');
            // If there are params, create an HTML element for it and append to
            // the innerContentElem
            if (singleAction.params && singleAction.params.length > 0) {
                actionElem.classList.add('wrap-collapsible');
                const paramsElem = getParamsHtmlElem(singleAction, dom);
                innerContentElem.appendChild(paramsElem);
            }

            // PRE script - if the script has a "pre" to it, like "prebuild" for
            // "build"
            if (singleAction.pre && singleAction.pre !== NOT_AVAILABLE) {
                appendActionElementsToElement([singleAction.pre], actionElem);
            }

            // NESTED ACTIONS
            if (singleAction.actions) {
                actionElem.classList.add('wrap-collapsible');
                appendActionElementsToElement(singleAction.actions, actionElem);
            }

            // POST script - if the script has a "post" to it, like "postbuild" for
            // "build"
            if (singleAction.post && singleAction.post !== NOT_AVAILABLE) {
                appendActionElementsToElement([singleAction.post], actionElem);
            }

            if (parentElem.classList.contains('main-container')) {
                parentElem.appendChild(actionElem);
            } else {
                parentElem.querySelector('.content-inner').appendChild(actionElem);
            }
        });

        return parentElem;
    }

    const dom = new JSDOM();
    const container = dom.window.document.createElement('div');
    container.classList.add('main-container');
    let counter = 0
    return appendActionElementsToElement(actions, container);
}

/**
 * Creates an HTML element for a single action
 * @param {Object} actionObject - A single Object representing an action
 * @param {Object} dom - The DOM Object which allow us to manipulate the DOM
 * @param {number} counter - A counter that we use for keeping a unique ID for 
 * HTML for the sake of collapsible behavior
 */
function getActionHtmlElem(actionObject, dom, counter) {
    const actionTypeMetadata = ACTION_METADATA_DICT[actionObject.type];
    const metadataHelper = Object.assign(actionMetadataService, actionTypeMetadata);
    const locationStr = actionObject.location ? ` (under ${actionObject.location})` : '';
    const title = `${metadataHelper.getTitle(actionObject.name)}${locationStr}`;
    const actionId = `${actionObject.name.replace(/\s/g, '')}-${counter}`;

    const actionsElem = dom.window.document.createElement('div');
    actionsElem.classList.add('action', actionObject.type);

    actionsElem.innerHTML = `
        <input id="${actionId}" class="toggle" type="checkbox">
        <label for="${actionId}" class="lbl-toggle"><i class="${metadataHelper.iconClass}"></i>${title}</label>
        <div class="collapsible-content">
            <div class="content-inner" />
        </div>
    `;

    return actionsElem;
}

/**
 * Returns an HTML element which has the params of a single action as a Table
 * @param {Object} actionObject - A single Object representing an action
 * @param {Object} dom - The DOM Object which allow us to manipulate the DOM
 * @return {HTMLElement} - An HTML element which holds the params of the action
 */
function getParamsHtmlElem(actionObject, dom) {
    const paramsElem = dom.window.document.createElement('div');
    paramsElem.classList.add('params');
    paramsElem.innerHTML = `
    <div class="params_title">Parameters</div>
    <table class="params_table">
        <thead class="params_table_header">
            <tr>
                <th>Name</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody class="params_table_body"></tbody>
    </table>
    `;

    const paramsTableBodyElem = paramsElem.querySelector('.params_table_body');

    let paramsHtml = '';
    actionObject.params.map(singleParam => {
        const value = singleParam.value ? singleParam.value : '-';
        paramsHtml += `
        <tr>
            <td>${singleParam.name}</td>
            <td>${value}</td>
        </tr>
        `;
    });
    paramsTableBodyElem.innerHTML += paramsHtml;
    return paramsElem;
}
