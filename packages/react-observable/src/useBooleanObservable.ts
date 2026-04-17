import type { IObservable } from "@efesto-cloud/observable";
import { useEffect, useState } from "react";

export default function useBooleanObservable(arg: IObservable<boolean>) {
    const [prevArg, setPrevArg] = useState(arg);
    const [value, setValue] = useState<boolean>(() => arg.get());

    if (prevArg !== arg) {
        setPrevArg(arg);
        setValue(arg.get());
    }

    useEffect(() => arg.subscribe(setValue), [arg]);

    return value;
}
