# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report vulnerabilities privately through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. This keeps the details private until a fix is available.

We aim to acknowledge a report within a few days and to address confirmed issues promptly.

## Scope

etsy-oracle is a self-hosted tool. You run it with your own Etsy API credentials and your own data store. Keep your API keys out of version control (the repo ignores `.env` files) and treat your local database as your own data.

## Supported versions

The project is in early development. Security fixes target the `main` branch until a versioned release exists.
