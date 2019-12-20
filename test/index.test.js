import fs from 'fs-extra';
import path from 'path';
jest.mock('path');
jest.mock('fs');

jest.mock('../src/reports/html/html-reporter.js', () => ({
    generateReport: jest.fn().mockReturnValue('mockHtmlReportContent'),
}));

import {mapNpmScripts} from '../src/index';
import * as constants from '../src/constants';

describe('NPMapper tool - ', () => {
    const MOCK_PATH = 'mockPath';
    const jsonFileContent = `{"scripts":{"build":"mock build action", "test":"mock test action"}}`;

    beforeEach(() => {
        fs.access = jest.fn();
        fs.readFile = jest.fn();
        fs.readFile.mockReturnValue(jsonFileContent);
        console.error = jest.fn();
        path.resolve.mockImplementation(givenPath => givenPath);
    });

    describe('File availability', () => {
        it('should check if the package.json file is accessible', async () => {
            // await parseNpmScripts(MOCK_PATH);
            await mapNpmScripts({targetDir: MOCK_PATH});
            expect(fs.access).toHaveBeenCalledWith(MOCK_PATH, fs.constants.F_OK);
        });

        it('should fail is the file is not accessible', async () => {
            const ERROR_MSG = 'No package.json file can be found on mockPath';
            fs.access.mockImplementation(() => {
                throw new Error();
            });
            const throwableWrapperFunc = async () => {
                await mapNpmScripts({targetDir: MOCK_PATH});
            };
            await expect(throwableWrapperFunc()).rejects.toThrow(ERROR_MSG);
        });

        it('should attempt to read the package.json file', async () => {
            await mapNpmScripts({targetDir: MOCK_PATH});
            expect(fs.readFile).toHaveBeenCalledWith(MOCK_PATH, 'utf-8');
        });

        it('should fail if was unable to read the package.json file', async () => {
            const ERROR_MSG = 'Could not read the package.json file under mockPath';
            fs.readFile.mockImplementation(() => {
                throw new Error();
            });
            const throwableWrapperFunc = async () => {
                await mapNpmScripts({targetDir: MOCK_PATH});
            };
            await expect(throwableWrapperFunc()).rejects.toThrow(ERROR_MSG);
        });
    });

    describe('Parsing scripts', () => {
        it('should get the scripts array for a specific one', async () => {
            const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
            expect(result).toMatchSnapshot();
        });

        it('should fail if the script cannot be found on the package.json file', async () => {
            const NON_EXISTING_SCRIPT_NAME = 'nonExistingScriptName';
            const ERROR_MSG = `No script by the name "${NON_EXISTING_SCRIPT_NAME}" was found`;
            const throwableWrapperFunc = async () => {
                await mapNpmScripts({targetDir: MOCK_PATH, scriptName: NON_EXISTING_SCRIPT_NAME});
            };
            await expect(throwableWrapperFunc()).rejects.toThrow(ERROR_MSG);
        });

        it('should auto map pre scripts', async () => {
            const jsonFileContent = `
                    {
                       "scripts": {
                            "prebuild": "mock pre build script",
                            "build": "mock build script"
                        }
                    }`;
            fs.readFile.mockReturnValue(jsonFileContent);
            const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
            expect(result).toMatchSnapshot();
        });

        it('should auto map post scripts', async () => {
            const jsonFileContent = `
                    {
                       "scripts": {
                            "postbuild": "mock post build script",
                            "build": "mock build script"
                        }
                    }`;
            fs.readFile.mockReturnValue(jsonFileContent);
            const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
            expect(result).toMatchSnapshot();
        });

        it('should parse a nested npm script', async () => {
            const jsonFileContent = `
                {
                    "scripts": {
                        "build": "npm run other",
                        "other": "mock other action"
                    }
                }`;
            fs.readFile.mockReturnValue(jsonFileContent);
            const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
            expect(result[0].actions[0].name).toEqual('other');
            expect(result[0].actions[0].type).toEqual('script');
        });

        it('should parse a nested yarn script without using "run" to execute it', async () => {
            const jsonFileContent = `
                {
                    "scripts": {
                        "build": "yarn other",
                        "other": "mock other action"
                    }
                }`;
            fs.readFile.mockReturnValue(jsonFileContent);
            const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
            expect(result[0].actions[0].name).toEqual('other');
            expect(result[0].actions[0].type).toEqual('script');
        });

        it('should parse a nested yarn script with using "run" to execute it', async () => {
            const jsonFileContent = `
                {
                    "scripts": {
                        "build": "yarn run other",
                        "other": "mock other action"
                    }
                }`;
            fs.readFile.mockReturnValue(jsonFileContent);
            const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
            expect(result[0].actions[0].name).toEqual('other');
            expect(result[0].actions[0].type).toEqual('script');
        });

        describe('script parameters parsing', () => {
            it('should extract and append parameters if exist', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "npm run other --param1 value1",
                        "other": "mock other action"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should handle params which are defined with an "=" sign', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "mock script --param1=value1"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should resolve values which are defined in npm config', async () => {
                const jsonFileContent = `
                {
                    "config": {
                        "mockParamValueConfig": "mockParamValue"
                    },
                    "scripts": {
                        "build": "mock script --param1 $npm_package_config_mockParamValueConfig"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should return action object for a singe dashed parameter with value', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "mock script -param1 param1Value"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should return action object for a single dashed parameter without value', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "mock script -param1"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should return action object for a multi dashed parameter with values', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "mock script --firstParam firstParamValue --secondParam secondParamValue --thirdParam thirdParamValue"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should return action object for a multi dashed parameter some with values and some without', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "mock script --firstParam firstParamValue --secondParam --thirdParam"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            // TODO: This test does not pass well - the first param is not registered
            it('should return action object for a multi dashed parameter with values with random spaces', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "mock script --firstParam firstParamValue    --secondParam secondParamValue    --thirdParam thirdParamValue"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should return action object for a single dashed parameter with name and value separate with "=" sign', async () => {
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "mock script --firstParam=firstParamValue"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });
        });

        describe('handling "--prefix" parameter', () => {
            it('should hop to other package.json file when --prefix param is set to a value', async () => {
                // Note - for mock purposes, the same JSON file is read for both paths
                // therefore the scripts hold the "other" script as well
                const jsonFileContent = `
                {
                    "scripts": {
                        "build": "npm run other --prefix otherMockPath", 
                        "other": "mock other action"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });

            it('should hop to other package.json file when --prefix param is set to an npm configuration', async () => {
                // Note - for mock purposes, the same JSON file is read for both paths
                // therefore the scripts hold the "other" script as well
                const jsonFileContent = `
                {
                    "config": {
                        "mockPathConfig": "otherMockPath"
                    },
                    "scripts": {
                        "build": "npm run other --prefix $npm_package_config_mockPathConfig", 
                        "other": "mock other action"
                    }
                }`;
                fs.readFile.mockReturnValue(jsonFileContent);
                const result = await mapNpmScripts({targetDir: MOCK_PATH, scriptName: 'build'});
                expect(result).toMatchSnapshot();
            });
        });
    });

    describe('Reporting', () => {
        const MOCK_REPORTS_OUTPUT_PATH = 'mockReportsOutputPath';

        beforeAll(() => {
            fs.writeFile = jest.fn();
            fs.copySync = jest.fn();
            fs.existsSync = jest.fn();
            fs.mkdirSync = jest.fn();

            constants.REPORTS_OUTPUT_PATH = MOCK_REPORTS_OUTPUT_PATH;
        });

        it('should create an JSON report if requested', async () => {
            const expectedFileName = `${MOCK_REPORTS_OUTPUT_PATH}/${constants.REPORT_FILE_NAME}.json`;
            const expectedFileContent =
                '[{"type":"script","name":"build","pre":"N/A","post":"N/A","params":[],"actions":[{"type":"command","name":"mock build action","params":[]}]}]';

            await mapNpmScripts({
                targetDir: MOCK_PATH,
                scriptName: 'build',
                reportType: constants.JSON_REPORT_TYPE,
            });

            expect(fs.writeFile).toHaveBeenCalledWith(expectedFileName, expectedFileContent);
        });

        it('should create an HTML report if requested', async () => {
            const expectedFileName = `${MOCK_REPORTS_OUTPUT_PATH}/${constants.REPORT_FILE_NAME}.html`;

            await mapNpmScripts({
                targetDir: MOCK_PATH,
                scriptName: 'build',
                reportType: constants.HTML_REPORT_TYPE,
            });

            expect(fs.writeFile).toHaveBeenCalledWith(expectedFileName, 'mockHtmlReportContent');
        });

        it('should create the reports directory if it does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            await mapNpmScripts({
                targetDir: MOCK_PATH,
                scriptName: 'build',
                reportType: constants.HTML_REPORT_TYPE,
            });

            expect(fs.mkdirSync).toHaveBeenCalledWith(MOCK_REPORTS_OUTPUT_PATH);
        });

        it('should not create the reports directory if it exists', async () => {
            fs.existsSync.mockReturnValue(true);

            await mapNpmScripts({
                targetDir: MOCK_PATH,
                scriptName: 'build',
                reportType: constants.HTML_REPORT_TYPE,
            });

            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });
});
