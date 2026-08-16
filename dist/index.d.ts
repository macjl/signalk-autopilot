import { ActionResult } from '@signalk/server-api';
export declare const types: {
    [key: string]: (app: any) => Autopilot;
};
export interface Autopilot {
    id: number;
    start(props: any): void;
    stop(): void;
    states?(): {
        name: string;
        engaged: boolean;
    }[];
    modes?(): string[];
    putState(context: string | undefined, path: string | undefined, value: any, cb?: any): ActionResult;
    putTargetHeading(context: string | undefined, path: string | undefined, value: any, cb?: any): ActionResult;
    putTargetWind(context: string | undefined, path: string | undefined, value: any, cb?: any): any;
    putAdjustHeading(context: string | undefined, path: string | undefined, value: any, cb?: any): ActionResult;
    putTack(context: string | undefined, path: string | undefined, value: any, cb?: any): ActionResult;
    putAdvanceWaypoint(context: string | undefined, path: string | undefined, value: any, cb?: any): ActionResult;
    putHullType?(context: string | undefined, path: string | undefined, value: any, cb?: any): ActionResult;
    putAutoTurn?(context: string | undefined, path: string | undefined, value: any, cb?: any): ActionResult;
    properties(): any;
    putStatePromise(value: string): Promise<void>;
    putTargetHeadingPromise(value: number): Promise<void>;
    putTargetWindPromise(value: number): Promise<void>;
    putAdjustHeadingPromise(value: number): Promise<void>;
    putTackPromise(value: string): Promise<void>;
    putAdvanceWaypointPromise(): Promise<void>;
}
export default function (app: any): any;
//# sourceMappingURL=index.d.ts.map