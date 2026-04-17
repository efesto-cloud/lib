import type { IObservable } from "@efesto-cloud/observable";
import { useEffect, useState } from "react";

export default function useStringObservable(
    arg: IObservable<string>,
    onChange: (val: string) => void = () => {},
) {
    const [prevArg, setPrevArg] = useState(arg);
    const [str, setStr] = useState<string>(() => arg.get());

    if (prevArg !== arg) {
        setPrevArg(arg);
        setStr(arg.get());
    }

    useEffect(() => arg.subscribe(setStr), [arg]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setStr(val);
        onChange(val);
    };

    return [str, handleChange] as const;
}
