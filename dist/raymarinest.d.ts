declare function _exports(app: any): {
    start(props: any): void;
    stop(): void;
    putTargetHeadingPromise(value: any): Promise<void>;
    putTargetHeading(context: any, path: any, value: any, _cb: any): {
        state: string;
        statusCode: number;
    } | {
        state: string;
        statusCode: number;
        message: string;
    };
    putStatePromise(value: any): Promise<void>;
    putState(context: any, path: any, value: any, _cb: any): {
        state: string;
        statusCode: number;
    } | {
        state: string;
        statusCode: number;
        message: string;
    };
    putTargetWindPromise(value: any): Promise<void>;
    putTargetWind(context: any, path: any, value: any, _cb: any): {
        state: string;
        statusCode: number;
    } | {
        state: string;
        statusCode: number;
        message: string;
    };
    putAdjustHeadingPromise(value: any): Promise<void>;
    putAdjustHeading(context: any, path: any, value: any, _cb: any): {
        state: string;
        statusCode: number;
    } | {
        state: string;
        statusCode: number;
        message: string;
    };
    putTackPromise(value: any): Promise<void>;
    putTack(context: any, path: any, value: any, _cb: any): {
        state: string;
        statusCode: number;
    } | {
        state: string;
        statusCode: number;
        message: string;
    };
    putAdvanceWaypointPromise(): Promise<void>;
    putAdvanceWaypoint(_context: any, _path: any, _value: any, _cb: any): {
        state: string;
        statusCode: number;
        message: string;
    };
    properties(): {
        outputEvent: {
            type: string;
            title: string;
            default: string;
        };
    };
};
export = _exports;
//# sourceMappingURL=raymarinest.d.ts.map