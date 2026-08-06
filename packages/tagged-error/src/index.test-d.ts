import { TaggedError } from "./index.js";

class CartNotFound extends TaggedError("CartNotFound") {}
class EmptyCart extends TaggedError("EmptyCart") {}
class OutOfStock extends TaggedError("OutOfStock")<{ sku: string }> {}

type CheckoutError = CartNotFound | EmptyCart | OutOfStock;
declare const error: CheckoutError;

// narrowing dentro l'handler: `e` deve essere OutOfStock, non l'union
const _narrowed: number = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: (e) => e.sku.length,
});

// il ritorno e l'union dei ritorni degli handler, non `unknown`
const _mixed: string | number | boolean | null = error.match({
    CartNotFound: () => "not-found" as const,
    EmptyCart: () => 0,
    OutOfStock: () => true,
});

// @ts-expect-error - manca l'handler per OutOfStock
const _incomplete = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
});

const _extraKey = error.match({
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: () => 409,
    // @ts-expect-error - variante inesistente
    NonEsiste: () => 500,
});

void _narrowed;
void _mixed;
void _incomplete;
void _extraKey;
