import type TLoginSessionState from "./TLoginSessionState.js";

const LoginSessionStateEnum: { [key in TLoginSessionState]: key } = {
    EXPIRED: "EXPIRED",
    FRESH: "FRESH",
    STALE: "STALE",
};

export default LoginSessionStateEnum;
