import process from "node:process";

export default class TeardownUtil {
    private _isShuttingDown: boolean = false;
    private fns: ((signal?: string) => Promise<void>)[] = [];

    constructor() {
        ["SIGINT", "SIGTERM"].forEach((signal) => {
            process.on(signal, () => {
                if (this._isShuttingDown) {
                    process.exit(1); // Force exit on repeated signals
                }
                this._isShuttingDown = true;
                this.execute(signal).finally(() => process.exit(0));
            });
        });
    }

    register(fn: () => Promise<void> = () => Promise.resolve()) {
        this.fns.push(fn);
        return this;
    }

    private async execute(signal: string = "unknown") {
        for (const fn of this.fns) {
            await fn(signal);
        }
    }
}
