export type Member = {
    id: string;
    name: string;
    email: string;
    role: "staff" | "admin";
};

export function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}
