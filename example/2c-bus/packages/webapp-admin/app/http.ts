import { Result } from "effect";

export function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

const STATUS: Record<string, number> = {
    InvalidInput: 400,
    Unauthenticated: 401,
    Forbidden: 403,
    ExpenseNotFound: 404,
    InvalidTransition: 409,
    InvalidAmount: 422,
    InvalidFile: 422,
    ImportRowInvalid: 422,
};

/** A named error becomes a status and a body with its tag and fields. */
export function failure(error: { _tag: string }) {
    return json(STATUS[error._tag] ?? 500, { ...error, error: error._tag });
}

/** The outcome of bus.dispatch, as HTTP. */
export async function send(
    outcome: Promise<Result.Result<unknown, { _tag: string }>>,
    status = 200,
) {
    const result = await outcome;
    return Result.isSuccess(result)
        ? json(status, result.success)
        : failure(result.failure);
}
