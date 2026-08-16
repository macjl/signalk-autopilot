"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Copyright 2019 Scott Bender <scott@scottbender.net>
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const actionPromise_1 = require("./actionPromise");
const state_path = 'steering.autopilot.state.value';
const routeTrackTruePath = 'navigation.course.calcValues.bearingTrackTrue.value';
const routeTargetMagneticFallbackPaths = [
    'navigation.course.calcValues.bearingTrackMagnetic.value',
    'navigation.course.calcValues.bearingMagnetic.value'
];
const routeXtePath = 'navigation.course.calcValues.crossTrackError.value';
const magneticVariationPath = 'navigation.magneticVariation.value';
const defaultRouteXteLookahead = 100;
const defaultRouteMaxXteCorrection = 60;
const SUCCESS_RES = { state: 'COMPLETED', statusCode: 200 };
const FAILURE_RES = { state: 'COMPLETED', statusCode: 400 };
const source = 'autopilot';
function default_1(app) {
    let currentState = 'standby';
    let currentTarget = undefined;
    let stateInterval;
    let routeXteLookahead = defaultRouteXteLookahead;
    let routeMaxXteCorrection = degsToRad(defaultRouteMaxXteCorrection);
    const pilot = {
        id: 10,
        start: (props) => {
            routeXteLookahead =
                positiveFinite(props?.routeXteLookahead) || defaultRouteXteLookahead;
            routeMaxXteCorrection = degsToRad(positiveFinite(props?.routeMaxXteCorrection) ||
                defaultRouteMaxXteCorrection);
            stateInterval = setInterval(() => {
                const delta = {
                    updates: [
                        {
                            values: [
                                { path: 'steering.autopilot.state', value: currentState }
                            ]
                        }
                    ]
                };
                if (currentState === 'route') {
                    currentTarget = getRouteTargetHeading();
                }
                if ((currentState === 'auto' || currentState === 'route') &&
                    currentTarget !== undefined) {
                    delta.updates[0].values.push({
                        path: 'steering.autopilot.target.headingMagnetic',
                        value: currentTarget
                    });
                }
                else if (currentState === 'wind' && currentTarget !== undefined) {
                    delta.updates[0].values.push({
                        path: 'steering.autopilot.target.windAngleApparent',
                        value: currentTarget
                    });
                }
                app.handleMessage(source, delta);
            }, 1000);
        },
        stop: () => {
            clearInterval(stateInterval);
        },
        states: () => {
            return [
                { name: 'standby', engaged: false },
                { name: 'auto', engaged: true },
                { name: 'wind', engaged: true },
                { name: 'route', engaged: true }
            ];
        },
        modes: () => {
            return ['auto', 'wind', 'route'];
        },
        putTargetHeadingPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putTargetHeading(undefined, undefined, value, cb)),
        putTargetHeading: (_context, _path, _value, _cb) => {
            return { message: 'Unsupported', ...FAILURE_RES };
        },
        putStatePromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putState(undefined, undefined, value, cb)),
        putState: (context, path, value, _cb) => {
            const delta = {
                updates: [
                    {
                        values: [{ path: 'steering.autopilot.state', value }]
                    }
                ]
            };
            if (value === 'auto') {
                const heading = app.getSelfPath('navigation.headingMagnetic.value') || 0;
                currentTarget = heading;
                delta.updates[0].values.push({
                    path: 'steering.autopilot.target.headingMagnetic',
                    value: heading
                });
            }
            else if (value === 'wind') {
                const windAngle = app.getSelfPath('environment.wind.angleApparent.value') || 0;
                currentTarget = windAngle;
                delta.updates[0].values.push({
                    path: 'steering.autopilot.target.windAngleApparent',
                    value: windAngle
                });
            }
            else if (value === 'route') {
                const heading = getRouteTargetHeading() ||
                    app.getSelfPath('navigation.headingMagnetic.value') ||
                    0;
                currentTarget = heading;
                delta.updates[0].values.push({
                    path: 'steering.autopilot.target.headingMagnetic',
                    value: heading
                });
            }
            currentState = value;
            app.handleMessage(source, delta);
            return SUCCESS_RES;
        },
        putTargetWindPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putTargetWind(undefined, undefined, value, cb)),
        putTargetWind: (_context, _path, value, _cb) => {
            const state = app.getSelfPath(state_path);
            const targetDegrees = Number(value);
            if (state !== 'wind') {
                return { message: 'Autopilot not in wind mode', ...FAILURE_RES };
            }
            if (!Number.isFinite(targetDegrees)) {
                return { message: 'Invalid wind target', ...FAILURE_RES };
            }
            const newTarget = degsToRad(targetDegrees);
            currentTarget = newTarget;
            app.handleMessage(source, {
                updates: [
                    {
                        values: [
                            {
                                path: 'steering.autopilot.target.windAngleApparent',
                                value: newTarget
                            }
                        ]
                    }
                ]
            });
            return SUCCESS_RES;
        },
        putAdjustHeadingPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putAdjustHeading(undefined, undefined, value, cb)),
        putAdjustHeading: (context, path, value, _cb) => {
            const state = app.getSelfPath(state_path);
            if (state !== 'auto' && state !== 'wind') {
                return {
                    message: 'Autopilot not in auto or wind mode',
                    ...FAILURE_RES
                };
            }
            else if (state === 'auto') {
                const target = app.getSelfPath('steering.autopilot.target.headingMagnetic.value');
                const newTarget = target + degsToRad(value);
                currentTarget = newTarget;
                const delta = {
                    updates: [
                        {
                            values: [
                                {
                                    path: 'steering.autopilot.target.headingMagnetic',
                                    value: newTarget
                                }
                            ]
                        }
                    ]
                };
                app.handleMessage(source, delta);
                return SUCCESS_RES;
            }
            else {
                const target = app.getSelfPath('steering.autopilot.target.windAngleApparent.value');
                const newTarget = target + degsToRad(value);
                currentTarget = newTarget;
                const delta = {
                    updates: [
                        {
                            values: [
                                {
                                    path: 'steering.autopilot.target.windAngleApparent',
                                    value: newTarget
                                }
                            ]
                        }
                    ]
                };
                app.handleMessage(source, delta);
                return SUCCESS_RES;
            }
        },
        putTackPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putTack(undefined, undefined, value, cb)),
        putTack: (_context, _path, value, _cb) => {
            const state = app.getSelfPath(state_path);
            if (state !== 'wind') {
                return { message: 'Autopilot not in wind mode', ...FAILURE_RES };
            }
            if (value !== 'port' && value !== 'starboard') {
                return { message: 'Unsupported tack direction', ...FAILURE_RES };
            }
            const target = app.getSelfPath('steering.autopilot.target.windAngleApparent.value');
            const reference = Number.isFinite(target)
                ? target
                : app.getSelfPath('environment.wind.angleApparent.value');
            const newTarget = (value === 'port' ? -1 : 1) * Math.abs(reference || 0);
            currentTarget = newTarget;
            app.handleMessage(source, {
                updates: [
                    {
                        values: [
                            {
                                path: 'steering.autopilot.target.windAngleApparent',
                                value: newTarget
                            }
                        ]
                    }
                ]
            });
            return SUCCESS_RES;
        },
        putAdvanceWaypointPromise: () => (0, actionPromise_1.toActionPromise)((cb) => pilot.putAdvanceWaypoint(undefined, undefined, undefined, cb)),
        putAdvanceWaypoint: (_context, _path, _value, _cb) => {
            const state = app.getSelfPath(state_path);
            if (state !== 'route') {
                return { message: 'Autopilot not in track mode', ...FAILURE_RES };
            }
            // Emulator has no route model — acknowledge so client flows that test
            // the round-trip succeed.
            return SUCCESS_RES;
        },
        properties: () => {
            return {
                routeXteLookahead: {
                    type: 'number',
                    title: 'Emulator route XTE lookahead distance',
                    description: 'Cross-track error distance, in meters, that produces about half the maximum route correction.',
                    default: defaultRouteXteLookahead
                },
                routeMaxXteCorrection: {
                    type: 'number',
                    title: 'Emulator route maximum XTE correction',
                    description: 'Maximum heading correction applied in route mode, in degrees.',
                    default: defaultRouteMaxXteCorrection
                }
            };
        }
    };
    return pilot;
    function getRouteTargetHeading() {
        const trackHeadingTrue = app.getSelfPath(routeTrackTruePath);
        if (Number.isFinite(trackHeadingTrue)) {
            return trueHeadingToMagnetic(correctedRouteHeading(trackHeadingTrue), app.getSelfPath(magneticVariationPath));
        }
        for (const path of routeTargetMagneticFallbackPaths) {
            const value = app.getSelfPath(path);
            if (Number.isFinite(value)) {
                return correctedRouteHeading(value);
            }
        }
        return undefined;
    }
    function correctedRouteHeading(trackHeading) {
        const xte = app.getSelfPath(routeXtePath);
        if (!Number.isFinite(xte)) {
            return compassAngle(trackHeading);
        }
        const correction = clamp(-Math.atan(xte / routeXteLookahead), -routeMaxXteCorrection, routeMaxXteCorrection);
        return compassAngle(trackHeading + correction);
    }
}
function degsToRad(degrees) {
    return degrees * (Math.PI / 180.0);
}
function trueHeadingToMagnetic(headingTrue, magneticVariation) {
    if (!Number.isFinite(magneticVariation))
        return compassAngle(headingTrue);
    return compassAngle(headingTrue - magneticVariation);
}
function compassAngle(angle) {
    return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function positiveFinite(value) {
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
//# sourceMappingURL=emulator.js.map