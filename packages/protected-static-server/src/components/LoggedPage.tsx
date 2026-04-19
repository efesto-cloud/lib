
interface LoggedPageProps {
    issued_at: Date;
    expires_at: Date;
    uuid: string;
}

export default function LoggedPage({
    issued_at,
    expires_at,
    uuid,
}: LoggedPageProps) {
    return (
        <html lang="it">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta charSet="UTF-8" />
                <link rel="icon" href="/static/icon.png" />
                <style>
                    {`
                        * {
                            box-sizing: border-box;
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f4f4f4;
                            margin: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                        }
                        .container {
                            background: #fff;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                            text-align: center;
                            width: 100%;
                            max-width: 400px;
                        }
                        .success-message {
                            font-size: 1.4em;
                            color: #28a745;
                            margin-bottom: 20px;
                            font-weight: bold;
                        }
                        .username {
                            font-size: 1.1em;
                            margin-bottom: 10px;
                            color: #555;
                        }
                        .date {
                            font-size: 0.8em;
                            color: #777;
                            margin: 5px 0;
                        }
                        .session-info {
                            background: #f8f9fa;
                            padding: 10px;
                            border-radius: 5px;
                            margin-top: 15px;
                            font-size: 0.85em;
                        }
                        .website-button {
                            display: block;
                            width: 100%;
                            padding: 12px 20px;
                            border-radius: 5px;
                            border: none;
                            background: #28a745;
                            color: #fff;
                            cursor: pointer;
                            font-size: 1.1em;
                            text-decoration: none;
                            margin: 20px 0;
                        }
                        .website-button:hover {
                            background: #218838;
                        }
                        .logout-button {
                            width: 100%;
                            padding: 10px 20px;
                            border-radius: 5px;
                            border: none;
                            background: #007BFF;
                            color: #fff;
                            cursor: pointer;
                            font-size: 1em;
                        }
                        .logout-button:hover {
                            background: #0056b3;
                        }
                    `}
                </style>
            </head>
            <body>
                <div className="container">
                    <div className="success-message">Accesso Effettuato con Successo!</div>
                    
                    <a href="/" className="website-button">
                        Vai al Sito Web
                    </a>
                    
                    <div className="session-info">
                        <div className="username">Utente: {uuid}</div>
                        <div className="date">Accesso effettuato: {issued_at.toLocaleString()}</div>
                        <div className="date">Scade: {expires_at.toLocaleString()}</div>
                    </div>
                    
                    <form method="POST" action="/logout">
                        <button type="submit" className="logout-button">Logout</button>
                    </form>
                </div>
            </body>
        </html>
    );
}