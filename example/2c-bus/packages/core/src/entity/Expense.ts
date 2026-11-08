import Entity from "@efesto-cloud/entity";
import type { ExpenseDto } from "@expenses/contract/dto/ExpenseDto";
import type InvalidAmount from "@expenses/contract/errors/InvalidAmount";
import InvalidTransition from "@expenses/contract/errors/InvalidTransition";
import { canTransition } from "@expenses/contract/rules/expenseStateMachine";
import type { ExpenseStatus } from "@expenses/contract/type/ExpenseStatus";
import { Result } from "better-result";
import Amount from "../value_object/Amount.js";
import type ExpenseStatusChange from "./ExpenseStatusChange.js";

type ExpenseProps = {
    author_id: string;
    description: string;
    amount: Amount;
    status: ExpenseStatus;
    created_at: string;
};

export default class Expense extends Entity<ExpenseProps, string> {
    static create(input: {
        author_id: string;
        description: string;
        amount_cents: number;
    }): Result<Expense, InvalidAmount> {
        return Amount.create(input.amount_cents).map(
            (amount) =>
                new Expense(
                    {
                        author_id: input.author_id,
                        description: input.description,
                        amount,
                        status: "draft",
                        created_at: new Date().toISOString(),
                    },
                    crypto.randomUUID(),
                ),
        );
    }

    static restore(id: string, props: ExpenseProps): Expense {
        return new Expense(props, id, 1);
    }

    get author_id() {
        return this.props.author_id;
    }

    get status() {
        return this.props.status;
    }

    /** Moves to `to` if the state machine allows it, and returns the history row. */
    transition(
        to: ExpenseStatus,
        by: string,
    ): Result<ExpenseStatusChange, InvalidTransition> {
        const from = this.props.status;
        if (!canTransition(from, to)) {
            return Result.err(
                new InvalidTransition({ expense_id: this._id, from, to }),
            );
        }
        this.props.status = to;
        return Result.ok({
            expense_id: this._id,
            from,
            to,
            changed_by: by,
            changed_at: new Date().toISOString(),
        });
    }

    toDTO(): ExpenseDto {
        return {
            id: this._id,
            author_id: this.props.author_id,
            description: this.props.description,
            amount_cents: this.props.amount.cents,
            status: this.props.status,
            created_at: this.props.created_at,
        };
    }
}
