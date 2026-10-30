import type { MemberDto } from "../dto/MemberDto.js";
import type IExpenseRepository from "../repo/IExpenseRepository.js";
import { PERMISSIONS, type Permission } from "./Permission.js";

export type PolicyDeps = { expenses: IExpenseRepository };

/** Answers one question: may this actor run this use case with this input? */
export type Policy<I> = {
    readonly name: string;
    allows(
        actor: MemberDto,
        input: I,
        deps: PolicyDeps,
    ): boolean | Promise<boolean>;
};

/** Any authenticated member. Written out on purpose: there is no default. */
export const anyMember: Policy<unknown> = {
    name: "anyMember",
    allows: () => true,
};

/** Not callable from outside: only other use cases and jobs run it. */
export const internal: Policy<unknown> = {
    name: "internal",
    allows: () => false,
};

export function can(permission: Permission): Policy<unknown> {
    return {
        name: `can(${permission})`,
        allows: (actor) => PERMISSIONS[actor.role].includes(permission),
    };
}

/**
 * Who the actor is with respect to the resource: a policy. An expense that
 * does not exist passes, so the use case can answer ExpenseNotFound.
 */
export const authorOfExpense: Policy<{ expense_id: string }> = {
    name: "authorOfExpense",
    allows: async (actor, input, { expenses }) => {
        const expense = await expenses.findById(input.expense_id);
        return expense === null || expense.author_id === actor.id;
    },
};
