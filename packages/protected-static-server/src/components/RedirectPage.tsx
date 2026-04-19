interface RedirectPageProps {
    url: string;
}

export default function RedirectPage({
    url
}: RedirectPageProps) {
    return (
        <html lang="it">
            <head><meta http-equiv="refresh" content={`0; url=${url}`} /></head>
            <body></body>
        </html>
    );
}