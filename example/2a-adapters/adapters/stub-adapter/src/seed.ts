import type StubStore from "./StubStore.js";

export function seed(store: StubStore) {
    const members = [
        {
            id: "m-anna",
            name: "Anna",
            email: "anna@example.com",
            role: "staff",
            token: "anna-token",
        },
        {
            id: "m-bruno",
            name: "Bruno",
            email: "bruno@example.com",
            role: "staff",
            token: "bruno-token",
        },
        {
            id: "m-carla",
            name: "Carla",
            email: "carla@example.com",
            role: "admin",
            token: "carla-token",
        },
    ] as const;
    for (const member of members)
        store.state.members.set(member.id, { ...member });
}
