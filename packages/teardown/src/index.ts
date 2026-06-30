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
        // Teardown is last-in/first-out: tear down in the reverse order of
        // setup, so the HTTP server stops accepting requests before the
        // services it depends on (queues, database, ...) are shut down.
        for (let i = this.fns.length - 1; i >= 0; i--) {
            await this.fns[i](signal);
        }
    }
}
