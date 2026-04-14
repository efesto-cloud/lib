export default interface IActor<T extends string = string> {
    id: string | null;
    type: T;
}
