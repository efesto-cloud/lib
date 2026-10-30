export default interface IMailer {
    send(mail: { to: string; subject: string }): Promise<void>;
}
