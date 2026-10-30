import { Schema } from "effect";
import type { Db } from "../db.server.js";
import { json, type Member } from "../http.js";

type ExpenseRow = {
    id: string;
    author_id: string;
    description: string;
    amount_cents: number;
    status: string;
    created_at: string;
};

const transitions: Record<string, string[]> = {
    draft: ["submitted"],
    submitted: ["approved", "rejected"],
    approved: ["reimbursed"],
    rejected: [],
    reimbursed: [],
};

const NewExpense = Schema.Struct({
    description: Schema.String,
    amount_cents: Schema.Number,
});

export async function listMine(db: Db, member: Member) {
    const rows = db
        .prepare(
            "select * from expense where author_id = ? order by created_at",
        )
        .all(member.id);
    return json(200, rows);
}

export async function listSubmitted(db: Db, member: Member) {
    if (member.role !== "admin") return json(403, { error: "Forbidden" });
    const rows = db
        .prepare(
            "select * from expense where status = 'submitted' order by created_at",
        )
        .all();
    return json(200, rows);
}

export async function create(db: Db, member: Member, body: unknown) {
    const input = Schema.decodeUnknownOption(NewExpense)(body);
    if (input._tag === "None") return json(400, { error: "InvalidInput" });
    const { description, amount_cents } = input.value;
    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
        return json(422, { error: "InvalidAmount", amount_cents });
    }
    const row: ExpenseRow = {
        id: crypto.randomUUID(),
        author_id: member.id,
        description,
        amount_cents,
        status: "draft",
        created_at: new Date().toISOString(),
    };
    db.prepare(
        "insert into expense (id, author_id, description, amount_cents, status, created_at) values (?, ?, ?, ?, ?, ?)",
    ).run(
        row.id,
        row.author_id,
        row.description,
        row.amount_cents,
        row.status,
        row.created_at,
    );
    return json(201, row);
}

export async function importCsv(db: Db, member: Member, csv: string) {
    if (member.role !== "admin") return json(403, { error: "Forbidden" });
    const lines = csv.trim().split("\n").slice(1);
    db.exec("begin");
    try {
        for (const [index, line] of lines.entries()) {
            const [description, amount] = line.split(",");
            const amount_cents = Number(amount);
            if (
                !description ||
                !Number.isInteger(amount_cents) ||
                amount_cents <= 0
            ) {
                db.exec("rollback");
                return json(422, { error: "InvalidRow", row: index + 1 });
            }
            db.prepare(
                "insert into expense (id, author_id, description, amount_cents, status, created_at) values (?, ?, ?, ?, 'draft', ?)",
            ).run(
                crypto.randomUUID(),
                member.id,
                description,
                amount_cents,
                new Date().toISOString(),
            );
        }
        db.exec("commit");
    } catch (error) {
        db.exec("rollback");
        throw error;
    }
    return json(201, { created: lines.length });
}

export async function transition(
    db: Db,
    member: Member,
    expenseId: string,
    to: "submitted" | "approved" | "rejected" | "reimbursed",
    mail: (to: string, subject: string) => Promise<void>,
) {
    const expense = db
        .prepare("select * from expense where id = ?")
        .get(expenseId) as ExpenseRow | undefined;
    if (!expense)
        return json(404, { error: "ExpenseNotFound", expense_id: expenseId });
    if (to === "submitted" && expense.author_id !== member.id) {
        return json(403, { error: "Forbidden" });
    }
    if (to !== "submitted" && member.role !== "admin") {
        return json(403, { error: "Forbidden" });
    }
    if (!transitions[expense.status]?.includes(to)) {
        return json(409, {
            error: "InvalidTransition",
            from: expense.status,
            to,
        });
    }
    const now = new Date().toISOString();
    db.exec("begin");
    db.prepare("update expense set status = ? where id = ?").run(
        to,
        expense.id,
    );
    db.prepare(
        "insert into expense_status_change (expense_id, from_status, to_status, changed_by, changed_at) values (?, ?, ?, ?, ?)",
    ).run(expense.id, expense.status, to, member.id, now);
    db.exec("commit");
    if (to === "approved") {
        const author = db
            .prepare("select email from member where id = ?")
            .get(expense.author_id) as {
            email: string;
        };
        await mail(
            author.email,
            `Nota spese approvata: ${expense.description}`,
        );
    }
    return json(200, { ...expense, status: to });
}
