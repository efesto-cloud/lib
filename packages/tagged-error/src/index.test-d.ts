import {
    matchError,
    matchErrorPartial,
    TaggedError,
    taggedErrorSchema,
} from "./index.js";

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

const _fn: number = matchError(error, {
    CartNotFound: () => 404,
    EmptyCart: () => 400,
    OutOfStock: (e) => e.sku.length,
});

// @ts-expect-error - handler mancante anche nella forma data-last
const _fnIncomplete = matchError(error, { CartNotFound: () => 404 });

const _partial: number = matchErrorPartial(error, {
    CartNotFound: () => 404,
    OutOfStock: (e) => e.sku.length,
    otherwise: () => 500,
});

// @ts-expect-error - otherwise e obbligatorio
const _noOtherwise = matchErrorPartial(error, { CartNotFound: () => 404 });

const _partialTypo = matchErrorPartial(error, {
    // @ts-expect-error - tag inesistente: senza il guard cadrebbe in silenzio
    // su otherwise invece di essere segnalato
    OutOfStok: () => "specifico",
    otherwise: () => "fallback",
});

void _fn;
void _fnIncomplete;
void _partial;
void _noOtherwise;
void _partialTypo;

// is() restringe al tipo concreto della classe ricevente, props inclusi
declare const unknownValue: unknown;
if (OutOfStock.is(unknownValue)) {
    const _sku: string = unknownValue.sku;
    const _tag: "OutOfStock" = unknownValue._tag;
    const _isError: Error = unknownValue;
    void _sku;
    void _tag;
    void _isError;
}
if (CartNotFound.is(unknownValue)) {
    const _cartTag: "CartNotFound" = unknownValue._tag;
    // @ts-expect-error - CartNotFound non dichiara props
    void unknownValue.sku;
    void _cartTag;
}

const _schema = taggedErrorSchema(CartNotFound, EmptyCart, OutOfStock);
const _out = _schema["~standard"].validate({ _tag: "OutOfStock", sku: "A" });
if (!(_out instanceof Promise) && _out.issues === undefined) {
    // l'output deve essere l'union delle classi concrete, non AnyTaggedError
    const _e: CartNotFound | EmptyCart | OutOfStock = _out.value;
    void _e;
}
void _schema;
