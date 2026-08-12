
interface LoginFormProps {
    errorMessage?: string;
}

export default function LoginForm({ errorMessage }: LoginFormProps) {
    return (
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta charSet="UTF-8" />
                <link rel="icon" href="/static/icon.png" />
                <style>
                    {`
                        :root {
                            --light: #faf8f8;
                            --lightgray: #e5e5e5;
                            --gray: #b8b8b8;
                            --darkgray: #4e4e4e;
                            --dark: #2b2b2b;
                            --secondary: #284b63;
                            --tertiary: #84a59d;
                            --headerFont: "Albert Sans", sans-serif;
                            --bodyFont: "Barlow", sans-serif;
                        }

                        @media (prefers-color-scheme: dark) {
                            :root {
                                --light: #161618;
                                --lightgray: #393639;
                                --gray: #646464;
                                --darkgray: #d4d4d4;
                                --dark: #ebebec;
                                --secondary: #7b97aa;
                            }
                        }

                        * {
                            box-sizing: border-box;
                        }

                        body {
                            font-family: var(--bodyFont);
                            background: var(--light);
                            color: var(--dark);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 1rem;
                            line-height: 1.6;
                        }

                        .login-container {
                            background: var(--light);
                            border: 1px solid var(--lightgray);
                            border-radius: 8px;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                            padding: 2rem;
                            width: 100%;
                            max-width: 400px;
                        }

                        .login-header {
                            font-family: var(--headerFont);
                            font-size: 1.5rem;
                            font-weight: 600;
                            color: var(--dark);
                            margin: 0 0 1.5rem 0;
                            text-align: center;
                        }

                        .login-instructions {
                            color: var(--darkgray);
                            font-size: 0.95rem;
                            margin-bottom: 1.5rem;
                            line-height: 1.6;
                        }

                        .login-instructions ul {
                            margin: 0.5rem 0 0 0;
                            padding-left: 1.25rem;
                        }

                        .login-instructions li {
                            margin: 0.25rem 0;
                        }

                        .form-group {
                            margin-bottom: 1rem;
                        }

                        .form-label {
                            display: block;
                            color: var(--darkgray);
                            font-weight: 500;
                            margin-bottom: 0.5rem;
                            font-size: 0.95rem;
                        }

                        .form-input {
                            width: 100%;
                            padding: 0.75rem;
                            font-family: var(--bodyFont);
                            font-size: 1rem;
                            color: var(--dark);
                            background: var(--light);
                            border: 1px solid var(--lightgray);
                            border-radius: 5px;
                            transition: border-color 0.2s ease, box-shadow 0.2s ease;
                        }

                        .form-input:focus {
                            outline: none;
                            border-color: var(--secondary);
                            box-shadow: 0 0 0 3px rgba(40, 75, 99, 0.1);
                        }

                        .form-input::placeholder {
                            color: var(--gray);
                        }

                        .btn-primary {
                            width: 100%;
                            padding: 0.75rem 1.5rem;
                            font-family: var(--bodyFont);
                            font-size: 1rem;
                            font-weight: 600;
                            color: #ffffff;
                            background: var(--secondary);
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            transition: background 0.2s ease, transform 0.1s ease;
                        }

                        .btn-primary:hover {
                            background: var(--tertiary);
                        }

                        .btn-primary:active {
                            transform: translateY(1px);
                        }

                        .error-message {
                            color: #e74c3c;
                            background: rgba(231, 76, 60, 0.1);
                            border: 1px solid rgba(231, 76, 60, 0.3);
                            padding: 0.75rem;
                            border-radius: 5px;
                            margin-bottom: 1rem;
                            font-size: 0.9rem;
                        }

                        @media (max-width: 800px) {
                            .login-container {
                                padding: 1.5rem;
                            }

                            .login-header {
                                font-size: 1.25rem;
                            }
                        }
                    `}
                </style>
            </head>
            <body>
                <div className="login-container">
                    <h1 className="login-header">Repository Documentale Thera Hub</h1>

                    <div className="login-instructions">
                        <p>Per accedere all'area riservata:</p>
                        <ul>
                            <li>Inserisci il codice segreto inviato via email</li>
                            <li>Oppure clicca sul link nell'email ricevuta</li>
                        </ul>
                    </div>

                    {errorMessage && (
                        <div className="error-message">
                            {errorMessage}
                        </div>
                    )}

                    <form method="POST" action="/login">
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">
                                Codice Segreto
                            </label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                className="form-input"
                                placeholder="Inserisci il codice"
                                required
                                autoFocus
                            />
                        </div>

                        <button type="submit" className="btn-primary">
                            Accedi
                        </button>
                    </form>
                </div>
            </body>
        </html>
    );
}