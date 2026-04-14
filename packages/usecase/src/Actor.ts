export type ActorProps<T extends string = string> = {
  id: string | null;
  type: T;
};

export default abstract class Actor<T extends string = string> {
  readonly id: string | null;
  readonly type: T;

  constructor(props: ActorProps<T>) {
    this.id = props.id;
    this.type = props.type;
  }
}
