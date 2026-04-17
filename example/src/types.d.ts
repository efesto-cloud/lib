import "@efesto-cloud/usecase";

declare module "@efesto-cloud/usecase" {
    export interface IExecutionContext {
        actor:
            | { type: "STAFF"; staff_id: string }
            | { type: "USER"; user_id: string };
        timestamp: Date;
        uuid: string;
    }
}
