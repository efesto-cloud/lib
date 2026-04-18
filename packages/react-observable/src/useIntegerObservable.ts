import type { IObservable } from "@efesto-cloud/observable";
import { useEffect, useState } from "react";

export default function useIntegerObservable(
    arg: IObservable<number>,
    onChange: (val: number) => void = () => {},
) {
    const [prevArg, setPrevArg] = useState(arg);
    const [value, setValue] = useState<string>(() => arg.get().toString());

    if (prevArg !== arg) {
        setPrevArg(arg);
        setValue(arg.get().toString());
    }

    useEffect(() => arg.subscribe((v) => setValue(v.toString())), [arg]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setValue(val);
        const num = parseInt(val, 10);
        if (!Number.isNaN(num)) {
            onChange(num);
        }
    };

    return [value, handleChange] as const;
}
