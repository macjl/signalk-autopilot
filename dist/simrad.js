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
const ts_pgns_1 = require("@canboat/ts-pgns");
const state_path = 'steering.autopilot.state.value';
const SUCCESS_RES = { state: 'COMPLETED', statusCode: 200 };
const FAILURE_RES = { state: 'COMPLETED', statusCode: 400 };
const PENDING_RES = { state: 'PENDING', statusCode: 202 };
/*
const state_command = '%s,3,130850,%s,255,11,41,9F,%s,FF,FF,0A,%s,00,FF,FF,FF'
const heading_command = '%s,2,130850,%s,255,12,41,9f,%s,ff,ff,0A,1A,00,%s,ff'
const tack_command = '%s,2,130850,%s,255,12,41,9f,%s,ff,ff,0A,11,00,00,ff,ff,ff'
const start_follow_up_command =
  '%s,2,130850,%s,255,12,41,9f,%s,ff,ff,02,0E,00,ff,ff,ff,ff'
*/
const states = [
    { name: 'standby', engaged: false },
    { name: 'auto', engaged: true },
    { name: 'wind', engaged: true },
    { name: 'route', engaged: true },
    { name: 'heading', engaged: true }
    //{ name: 'followUp', engaged: true },
    //{ name: 'nonFollowUp', engaged: true }
];
function default_1(app) {
    const defaultDeviceid = 3;
    const timers = [];
    let discovered;
    let srcId = -1;
    const pilot = {
        id: defaultDeviceid,
        start: (props) => {
            if (props.simradDeviceId !== undefined) {
                //deviceid = props.deviceid
                pilot.id = Number(props.simradDeviceId);
                app.debug('props.deviceid:', pilot.id);
            }
            srcId =
                props.simradSrcDeviceId !== undefined
                    ? Number(props.simradSrcDeviceId)
                    : -1;
        },
        stop: () => {
            timers.forEach((timer) => {
                clearInterval(timer);
            });
        },
        states: () => {
            return states;
        },
        putTargetHeadingPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putTargetHeading(undefined, undefined, value, cb)),
        putTargetHeading: (_context, _path, _value, _cb) => {
            return { message: 'Unsupported', ...FAILURE_RES };
        },
        putStatePromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putState(undefined, undefined, value, cb)),
        putState: (context, path, value, cb) => {
            if (!states.find((s) => s.name === value)) {
                return { message: `Invalid Autopilot State: ${value}`, ...FAILURE_RES };
            }
            else {
                /*
                if (value === 'followUp') {
                  sendN2k([
                    util.format(
                      start_follow_up_command,
                      new Date().toISOString(),
                      default_src,
                      padd(pilot.id.toString(16), 2)
                    )
                  ])
                } else if (value === 'nonFollowUp') {
                  sendN2k([
                    util.format(
                      start_follow_up_command,
                      new Date().toISOString(),
                      default_src,
                      padd(deviceid.toString(16), 2)
                    )
                  ])
                } else */ {
                    let pgn;
                    switch (value) {
                        case 'auto':
                            pgn = new ts_pgns_1.PGN_130850_SimnetCommandApNodrift({
                                address: pilot.id,
                                reserved5: 0
                            });
                            break;
                        case 'route':
                            pgn = new ts_pgns_1.PGN_130850_SimnetCommandApNav({
                                address: pilot.id,
                                reserved5: 0
                            });
                            break;
                        case 'heading':
                            pgn = new ts_pgns_1.PGN_130850_SimnetCommandApHeading({
                                address: pilot.id,
                                reserved5: 0
                            });
                            break;
                        case 'wind':
                            pgn = new ts_pgns_1.PGN_130850_SimnetCommandApWind({
                                address: pilot.id,
                                reserved5: 0
                            });
                            break;
                        default:
                        case 'standby':
                            pgn = new ts_pgns_1.PGN_130850_SimnetCommandApStandby({
                                address: pilot.id,
                                reserved5: 0
                            });
                            break;
                    }
                    sendN2k([pgn]);
                }
                verifyChange(app, state_path, value, cb);
                return PENDING_RES;
            }
        },
        putTargetWindPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putTargetWind(undefined, undefined, value, cb)),
        putTargetWind: (_context, _path, _value, _cb) => {
            return { message: 'Unsupported', ...FAILURE_RES };
        },
        putAdjustHeadingPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putAdjustHeading(undefined, undefined, value, cb)),
        putAdjustHeading: (context, path, value, _cb) => {
            const state = app.getSelfPath(state_path);
            if (state !== 'auto' && state !== 'heading' && state !== 'wind') {
                return {
                    message: 'Autopilot not in auto, heading or wind mode',
                    ...FAILURE_RES
                };
            }
            else {
                const pgn = new ts_pgns_1.PGN_130850_SimnetCommandApChangeCourse({
                    address: pilot.id,
                    reserved5: 0,
                    direction: value > 0 ? ts_pgns_1.SimnetDirection.Starboard : ts_pgns_1.SimnetDirection.Port,
                    angle: degsToRad(Math.abs(value))
                });
                sendN2k([pgn]);
                //verifyChange(app, target_wind_path, new_value, cb)
                return SUCCESS_RES;
            }
        },
        putTackPromise: (value) => (0, actionPromise_1.toActionPromise)((cb) => pilot.putTack(undefined, undefined, value, cb)),
        putTack: (_context, _path, _value, _cb) => {
            const state = app.getSelfPath(state_path);
            if (state !== 'wind' && state !== 'auto') {
                return { message: 'Autopilot not in wind or auto mode', ...FAILURE_RES };
            }
            else {
                sendN2k([
                    new ts_pgns_1.PGN_130850_SimnetCommandApTack({
                        address: pilot.id,
                        unknownA: 0,
                        unknownB: 0
                    })
                ]);
                return SUCCESS_RES;
            }
        },
        putAdvanceWaypointPromise: () => (0, actionPromise_1.toActionPromise)((cb) => pilot.putAdvanceWaypoint(undefined, undefined, undefined, cb)),
        putAdvanceWaypoint: (_context, _path, _value, _cb) => {
            return { message: 'Unsupported', ...FAILURE_RES };
        },
        properties: () => {
            let defaultId = pilot.id.toString() ?? defaultDeviceid.toString();
            let description = 'No Simrad AP computer Found';
            if (!discovered) {
                //let full = app.deltaCache.buildFull(undefined, [ 'sources' ])
                //if ( full && full.sources ) {
                const sources = app.getPath('/sources');
                if (sources) {
                    Object.values(sources).forEach((v) => {
                        if (typeof v === 'object') {
                            Object.keys(v).forEach((id) => {
                                if (v[id] &&
                                    v[id].n2k &&
                                    (v[id].n2k.manufacturerCode == 'Navico' ||
                                        v[id].n2k.manufacturerCode == 'Simrad') &&
                                    v[id].n2k.deviceFunction == 150) {
                                    discovered = id;
                                }
                            });
                        }
                    });
                }
            }
            if (discovered) {
                defaultId = discovered;
                description = `Discovered a Simrad AP computer with id ${discovered}`;
                app.debug(description);
            }
            app.debug('*** post-discovery -> defaultId', defaultId);
            return {
                simradDeviceId: {
                    type: 'string',
                    title: 'Simrad Autopilot NMEA2000 ID',
                    description,
                    default: defaultId
                },
                simradSrcDeviceId: {
                    type: 'number',
                    title: 'Simrad Autopilot Source NMEA2000 ID',
                    description: "NMEA2000 Source ID to use when sending commands to the autopilot, don't change unless needed (only works with socketcan devices)",
                    default: -1
                }
            };
        }
    };
    function sendN2k(msgs) {
        if (app.debug.enabled) {
            app.debug('n2k_msg: ' + JSON.stringify(msgs));
        }
        msgs.map(function (msg) {
            if (typeof msg === 'string') {
                app.emit('nmea2000out', msg);
            }
            else {
                if (srcId !== -1) {
                    ;
                    msg.src = srcId;
                    msg.forceSrc = true;
                }
                app.emit('nmea2000JsonOut', msg);
            }
        });
    }
    return pilot;
}
function getPilotError(app) {
    let message;
    const notifs = app.getSelfPath('notifications.autopilot');
    if (notifs) {
        Object.values(notifs).forEach((info) => {
            if (info.state !== 'normal') {
                message = info.message;
            }
        });
    }
    return message;
}
function verifyChange(app, path, expected, cb) {
    let retryCount = 0;
    const interval = setInterval(() => {
        const val = app.getSelfPath(path);
        //app.debug('checking %s %j should be %j', path, val, expected)
        if (val !== undefined && val === expected) {
            app.debug('SUCCESS');
            cb(SUCCESS_RES);
            clearInterval(interval);
        }
        else {
            const message = getPilotError(app);
            if (message || retryCount++ > 5) {
                clearInterval(interval);
                const res = {
                    message: message ||
                        `Did not receive change confirmation ${val} != ${expected}`,
                    ...FAILURE_RES
                };
                cb(res);
            }
        }
    }, 1000);
}
function degsToRad(degrees) {
    return degrees * (Math.PI / 180.0);
}
//# sourceMappingURL=simrad.js.map