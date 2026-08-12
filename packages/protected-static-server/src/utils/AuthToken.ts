import { decode, sign, verify } from "jws";
import { randomUUID } from "node:crypto";
import z from "zod";

export interface Payload {
    iat: number;
    exp: number;
    uuid: string;
};

const BODY_VALIDATOR = z.object({
    iat: z.number().int().min(0),
    exp: z.number().int().min(0),
    uuid: z.string(),
});

const ALG = "HS256" as const;
const HEADER = { alg: ALG, typ: "JWT" };

export default class AuthToken {

    constructor(
        private readonly SECRET: string,
        private readonly MAX_AGE: string,
    ) {}
    
    validate(token: string) {
        try {
            if (!verify(token, ALG, this.SECRET))
                return null;

            const signature = decode(token);
            if (!signature)
                return null;
    
            const decodedPayload = BODY_VALIDATOR.safeParse(signature?.payload);
    
            if (!decodedPayload.success)
                return null;
    
            return decodedPayload.data;
        } catch (err) {
            return null;
        }
    }

    create() {
        const payload = {
            iat: Date.now(),
            exp: Date.now() + parseInt(this.MAX_AGE),
            uuid: randomUUID(),
        } satisfies Payload;
    
        const signature = sign({
            header: HEADER,
            payload,
            secret: this.SECRET,
        });
    
        return signature;
    }
}