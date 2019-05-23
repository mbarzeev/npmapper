// import fs from 'fs';
// jest.mock('fs');
import path from 'path';
import {mapNpmScripts, getSingleCommandObject} from '../src/index';

describe('Main application', () => {
    describe('getSingleCommandObject method', () => {
        test('should return action object for a singe dashed parameter with value', () => {
            const command = 'dummy command -q qValue';
            const actual = getSingleCommandObject(command);
            expect(actual).toMatchSnapshot();
        });

        test('should return action object for a singe dashed parameter without value', () => {
            const command = 'dummy command -q';
            const actual = getSingleCommandObject(command);
            expect(actual).toMatchSnapshot();
        });

        test('should return action object for a multi dashed parameter with values', () => {
            const command =
                'dummy command --firstParam firstParamValue --secondParam secondParamValue --thirdParam thirdParamValue';
            const actual = getSingleCommandObject(command);
            expect(actual).toMatchSnapshot();
        });

        test('should return action object for a multi dashed parameter some with values and some without', () => {
            const command = 'dummy command --firstParam firstParamValue --secondParam --thirdParam';
            const actual = getSingleCommandObject(command);
            expect(actual).toMatchSnapshot();
        });

        test('should return action object for a multi dashed parameter with values with random spaces', () => {
            const command =
                'dummy command --firstParam    firstParamValue    --secondParam secondParamValue    --thirdParam thirdParamValue';
            const actual = getSingleCommandObject(command);
            expect(actual).toMatchSnapshot();
        });

        test('should return action object for a single dashed parameter with name and value separate with "=" sign', () => {
            const command = 'dummy command --firstParam=firstParamValue';
            const actual = getSingleCommandObject(command);
            expect(actual).toMatchSnapshot();
        });
    });
});
