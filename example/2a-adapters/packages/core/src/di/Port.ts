/** DI keys of the ports. Adapters bind them; use cases inject them. */
export const Port = {
    Database: Symbol.for("Database"),
    UnitOfWork: Symbol.for("UnitOfWork"),
    ExpenseRepository: Symbol.for("ExpenseRepository"),
    ExpenseStatusChangeRepository: Symbol.for("ExpenseStatusChangeRepository"),
    MemberRepository: Symbol.for("MemberRepository"),
    Mailer: Symbol.for("Mailer"),
    ExpenseFileReader: Symbol.for("ExpenseFileReader"),
} as const;
