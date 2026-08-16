"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Copyright 2016 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.types = void 0;
exports.default = default_1;
const raymarinen2k_1 = __importDefault(require("./raymarinen2k"));
const raystngconv_1 = __importDefault(require("./raystngconv"));
const raymarinest_1 = __importDefault(require("./raymarinest"));
const simrad_1 = __importDefault(require("./simrad"));
const emulator_1 = __importDefault(require("./emulator"));
const target_heading = 'steering.autopilot.target.headingMagnetic';
const target_wind = 'steering.autopilot.target.windAngleApparent';
const state_path = 'steering.autopilot.state';
const adjust_heading = 'steering.autopilot.actions.adjustHeading';
const tack = 'steering.autopilot.actions.tack';
const advance = 'steering.autopilot.actions.advanceWaypoint';
exports.types = {
    raymarineN2K: raymarinen2k_1.default,
    raymarineST: raymarinest_1.default,
    raySTNGConv: raystngconv_1.default,
    simrad: simrad_1.default,
    emulator: emulator_1.default
};
const apData = {
    options: {
        states: [
            { name: 'standby', engaged: false },
            { name: 'auto', engaged: true },
            { name: 'wind', engaged: true },
            { name: 'route', engaged: true }
        ],
        modes: [],
        actions: []
    },
    mode: null,
    state: null,
    engaged: false,
    target: null
};
const defaultEngagedMode = 'auto';
const isValidState = (value) => {
    return apData.options.states.findIndex((i) => i.name === value) !== -1;
};
const isValidMode = (value) => {
    if (apData.options.modes.length > 0) {
        return apData.options.modes.includes(value);
    }
    return apData.options.states.some((s) => s.name === value && s.engaged);
};
function default_1(app) {
    const plugin = {};
    let onStop = [];
    let autopilot;
    const pilots = {};
    let apType = ''; // autopilot type
    let lastState = undefined;
    let dodgeSaved = null;
    Object.keys(exports.types).forEach((type) => {
        const module = exports.types[type];
        //console.log(`${type}: ${module}`)
        if (module) {
            if (typeof module !== 'function') {
                app.error(`bad ap impl ${module} ${typeof module}`);
            }
            else {
                pilots[type] = module(app);
            }
        }
    });
    plugin.start = function (props) {
        apType = props.type;
        autopilot = pilots[props.type];
        autopilot.start(props);
        if (autopilot.states) {
            apData.options.states = autopilot.states();
        }
        if (autopilot.modes) {
            apData.options.modes = autopilot.modes();
        }
        app.registerPutHandler('vessels.self', state_path, autopilot.putState);
        app.registerPutHandler('vessels.self', target_heading, autopilot.putTargetHeading);
        app.registerPutHandler('vessels.self', target_wind, autopilot.putTargetWind);
        app.registerPutHandler('vessels.self', adjust_heading, autopilot.putAdjustHeading);
        app.registerPutHandler('vessels.self', tack, autopilot.putTack);
        app.registerPutHandler('vessels.self', advance, autopilot.putAdvanceWaypoint);
        /*
        const possibleValues = apData.options.states.map((s) => {
          return { title: s.name, value: s.name }
        })
    
        
        app.handleMessage(plugin.id, {
          updates: [
            {
              //values: [{ path: state_path, value: 'standby' }],
              meta: [
                {
                  path: state_path,
                  value: {
                    displayName: 'Autopilot State',
                    type: 'multiple',
                    possibleValues
                  }
                }
              ]
            }
          ]
        })
          */
        if (props.enableV2API === true || props.enableV2API === undefined) {
            registerProvider();
        }
    };
    plugin.stop = function () {
        onStop.forEach((f) => f());
        onStop = [];
        if (autopilot) {
            autopilot.stop();
        }
    };
    plugin.id = 'autopilot';
    plugin.name = 'Autopilot Control';
    plugin.description = 'Plugin that controls an autopilot';
    plugin.schema = function () {
        const config = {
            title: 'Autopilot Control',
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    title: 'Autopilot Type',
                    enum: [
                        'raymarineN2K',
                        'raySTNGConv',
                        'raymarineST',
                        'simrad',
                        'emulator'
                    ],
                    enumNames: [
                        'Raymarine NMEA2000',
                        'Raymarine SmartPilot -> SeaTalk-STNG-Converter',
                        'Raymarine Seatalk 1 AP',
                        'Simrad NMEA2000',
                        'Emulator'
                    ],
                    default: 'raymarineN2K'
                },
                enableV2API: {
                    type: 'boolean',
                    title: 'Enable Autopilot V2 API',
                    description: 'Enables the Signal K Autopilot V2 API',
                    default: true
                }
            }
        };
        Object.values(pilots).forEach((ap) => {
            if (ap && ap.properties) {
                config.properties = { ...config.properties, ...ap.properties() };
            }
        });
        return config;
    };
    // Autopilot API - register with Autopilot API
    const registerProvider = () => {
        app.debug('**** intialise Sk path subscriptions *****');
        subscribeToPaths();
        app.debug('**** register AP Provider *****');
        try {
            const provider = {
                getData: async (_deviceId) => {
                    return apData;
                },
                getState: async (_deviceId) => {
                    return apData.engaged ? 'enabled' : 'disabled';
                },
                setState: async (state, _deviceId) => {
                    if (state === 'enabled') {
                        const target = isValidMode(apData.mode)
                            ? apData.mode
                            : lastState || defaultEngagedMode;
                        await autopilot.putStatePromise(target);
                        apData.state = target;
                        apData.mode = target;
                        apData.engaged = true;
                    }
                    else if (state === 'disabled') {
                        await autopilot.putStatePromise('standby');
                        apData.state = 'standby';
                        apData.engaged = false;
                    }
                    else if (isValidState(state)) {
                        await autopilot.putStatePromise(state);
                        const stateObj = apData.options.states.find((s) => s.name === state);
                        apData.state = state;
                        apData.engaged = stateObj ? stateObj.engaged : false;
                        if (apData.engaged)
                            apData.mode = state;
                    }
                    else {
                        throw new Error(`${state} is not a valid value!`);
                    }
                },
                getMode: async (_deviceId) => {
                    return apData.mode;
                },
                setMode: async (mode, _deviceId) => {
                    if (isValidMode(mode)) {
                        await autopilot.putStatePromise(mode);
                        apData.mode = mode;
                        apData.state = mode;
                        apData.engaged = true;
                    }
                    else {
                        throw new Error(`${mode} is not a valid mode!`);
                    }
                },
                getTarget: async (_deviceId) => {
                    return apData.target;
                },
                setTarget: async (value, _deviceId) => {
                    if (apData.state === 'auto') {
                        return autopilot.putTargetHeadingPromise(radiansToDegrees(value));
                    }
                    else if (apData.state === 'wind') {
                        return autopilot.putTargetWindPromise(radiansToDegrees(value));
                    }
                    else {
                        throw new Error(`Unable to set target value! STATE = ${apData.state}`);
                    }
                },
                adjustTarget: async (value, _deviceId) => {
                    return autopilot.putAdjustHeadingPromise(Math.floor(radiansToDegrees(value)));
                },
                engage: async (_deviceId) => {
                    const target = lastState || defaultEngagedMode;
                    await autopilot.putStatePromise(target);
                    apData.state = target;
                    apData.mode = target;
                    apData.engaged = true;
                },
                disengage: async (_deviceId) => {
                    await autopilot.putStatePromise('standby');
                    apData.state = 'standby';
                    apData.engaged = false;
                },
                tack: async (direction, _deviceId) => {
                    return autopilot.putTackPromise(direction);
                },
                gybe: async (_direction, _deviceId) => {
                    throw new Error('Not implemented!');
                },
                dodge: async (value, _deviceId) => {
                    if (value === null) {
                        if (dodgeSaved !== null) {
                            const restoreState = dodgeSaved.state || 'standby';
                            await autopilot.putStatePromise(restoreState);
                            apData.state = restoreState;
                            apData.mode = dodgeSaved.mode;
                            const stateObj = apData.options.states.find((s) => s.name === restoreState);
                            apData.engaged = stateObj ? stateObj.engaged : false;
                            dodgeSaved = null;
                        }
                        return;
                    }
                    if (dodgeSaved === null) {
                        dodgeSaved = { state: apData.state, mode: apData.mode };
                    }
                    if (apData.state !== 'auto') {
                        await autopilot.putStatePromise('auto');
                        apData.state = 'auto';
                        apData.mode = 'auto';
                        apData.engaged = true;
                    }
                    if (value !== 0) {
                        await autopilot.putAdjustHeadingPromise(Math.round(radiansToDegrees(value)));
                    }
                },
                courseCurrentPoint: async (_deviceId) => {
                    throw new Error('Not implemented!');
                },
                courseNextPoint: async (_deviceId) => {
                    return autopilot.putAdvanceWaypointPromise();
                }
            };
            app.registerAutopilotProvider(provider, [apType]);
        }
        catch (error) {
            app.debug(error);
        }
    };
    // Subscribe to autopilot paths
    const subscribeToPaths = () => {
        app.subscriptionmanager?.subscribe({
            context: 'vessels.self',
            subscribe: [
                {
                    path: 'steering.autopilot.*',
                    period: 500
                }
            ]
        }, onStop, (err) => {
            console.log(`Autopilot subscriptions failed! ${err}`);
        }, (msg) => {
            processAPDeltas(msg);
        });
    };
    /** Process deltas for steering.autopilot data
     * Note: Only deltas where source.type = NMEA2000 and source.src = autopilot.id are processed!
     */
    const processAPDeltas = async (delta) => {
        if (!Array.isArray(delta.updates)) {
            return;
        }
        delta.updates.forEach((update) => {
            if (Array.isArray(update.values)) {
                update.values.forEach((pathValue) => {
                    if (update.$source === 'autopilot' ||
                        (update.source &&
                            update.source.type &&
                            update.source.type === 'NMEA2000')) {
                        // match the src value to the autopilot.id
                        if (update.$source !== 'autopilot' &&
                            Number(update.source.src) !== autopilot.id) {
                            return;
                        }
                        // map n2k device state to API.state & API.mode
                        if (pathValue.path === 'steering.autopilot.state') {
                            apData.state = isValidState(pathValue.value)
                                ? pathValue.value
                                : null;
                            const stateObj = apData.options.states.find((i) => i.name === pathValue.value);
                            apData.engaged = stateObj ? stateObj.engaged : false;
                            if (apData.engaged) {
                                apData.mode = apData.state;
                            }
                            app.autopilotUpdate(apType, {
                                state: apData.state,
                                mode: apData.mode,
                                engaged: apData.engaged
                            });
                            if (apData.state != null && apData.state !== 'standby') {
                                lastState = apData.state;
                            }
                        }
                        // map n2k device target value to API.target
                        if (pathValue.path ===
                            'steering.autopilot.target.windAngleApparent' &&
                            apData.state === 'wind') {
                            apData.target = pathValue.value;
                            app.autopilotUpdate(apType, { target: pathValue.value });
                        }
                        if ((pathValue.path === 'steering.autopilot.target.headingTrue' ||
                            pathValue.path ===
                                'steering.autopilot.target.headingMagnetic') &&
                            apData.state !== 'wind') {
                            apData.target = pathValue.value;
                            app.autopilotUpdate(apType, { target: pathValue.value });
                        }
                    }
                });
            }
        });
    };
    const radiansToDegrees = (value) => (value * 180) / Math.PI;
    //const degreesToRadians = (value: number) => value * (Math.PI / 180.0)
    return plugin;
}
//# sourceMappingURL=index.js.map