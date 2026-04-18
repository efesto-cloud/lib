import type { IObservable } from "@efesto-cloud/observable";
import { useEffect, useState } from "react";

export default function useObservable<T>(arg: IObservable<T>): T {
    const [val, setVal] = useState<T>(arg.get());

    useEffect(() => arg.subscribe(setVal), [arg]);

    useEffect(() => setVal(arg.get()), [arg]);

    return val;
}
