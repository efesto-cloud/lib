import { TaggedError, type TaggedErrorInstance } from "better-result";
import { z } from "zod";

type Wire<Tag extends string, Shape extends z.ZodRawShape> = z.ZodObject<
    { _tag: z.ZodLiteral<Tag> } & Shape
>;

/** The class `taggedError` returns: a better-result TaggedError that knows how to travel. */
export type TaggedErrorWithCodec<
    Tag extends string,
    Shape extends z.ZodRawShape,
    Props = z.output<z.ZodObject<Shape>>,
> = {
    new (
        ...args: keyof Shape extends never ? [props?: Props] : [props: Props]
    ): TaggedErrorInstance<Tag, Props>;
    is<C extends abstract new (...args: never[]) => object>(
        this: C,
        value: unknown,
    ): value is InstanceType<C>;
    /** Built on `this`, so it decodes into the subclass, not into the base. */
    codec<C extends abstract new (...args: never[]) => object>(
        this: C,
    ): z.ZodCodec<Wire<Tag, Shape>, z.ZodCustom<InstanceType<C>>>;
};

/**
 * A named error and how it travels: one declaration gives the class and the
 * zod codec that turns it into JSON and back into an instance of the same class.
 * Only `_tag` and the declared fields cross a channel: no stack, no message.
 */
export function taggedError<Tag extends string, Shape extends z.ZodRawShape>(
    tag: Tag,
    shape: Shape,
): TaggedErrorWithCodec<Tag, Shape> {
    const wire = z.object({ _tag: z.literal(tag), ...shape });
    const codecs = new WeakMap<object, z.ZodType>();

    class Tagged extends TaggedError(tag) {
        static codec(this: new (props: object) => object) {
            // `this`, not `Tagged`: the codec must decode into the subclass that
            // calls it (ExpenseNotFound), or `instanceof` fails on the other side.
            // biome-ignore lint/complexity/noThisInStatic: see above
            // biome-ignore lint/complexity/noUselessThisAlias: two safe fixes in a row turn `this` into `Tagged`
            const Class = this;
            let codec = codecs.get(Class);
            if (!codec) {
                codec = z.codec(wire, z.instanceof(Class), {
                    decode: (value) => {
                        const { _tag, ...props } = value as Record<
                            string,
                            unknown
                        >;
                        return new Class(props);
                    },
                    encode: (error) => {
                        const { name: _name, ...fields } = {
                            ...error,
                        } as Record<string, unknown>;
                        return fields as never;
                    },
                });
                codecs.set(Class, codec);
            }
            return codec;
        }
    }
    return Tagged as unknown as TaggedErrorWithCodec<Tag, Shape>;
}
