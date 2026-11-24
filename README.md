<!-- Waynecorp -->
# RideSync

A mobile-first web app (installable PWA) that helps passengers, drivers and coordinators manage jeepney trips on the Binga ⇄ Baguio route: schedules, virtual queueing, vehicle availability, trip status, demand monitoring and notifications.

- **Passengers** – see schedules and live trip status, join a virtual queue, see vehicle availability and driver-confirmed seats, receive notifications.
- **Drivers** – see assigned trips and the live queue, update trip status, count walk-ins, confirm seats, report vehicle problems, set on/off duty.
- **Coordinators** – create/edit/delay/cancel trips, assign drivers and vehicles, monitor every queue, spot trips where demand exceeds seats, post announcements, manage roles.

Stack: plain PHP 7.4+/8 (PDO), MariaDB/MySQL, vanilla JavaScript. No build step, no framework, no dependencies.

See [docs/FEATURES.md](docs/FEATURES.md) for the full feature checklist.

## Repository layout

```
htdocs/            The website. Upload the CONTENTS of this folder to your host.
  config.sample.php  Settings template  ->  copy to config.php (never committed)
database/
  schema.sql         Clean database structure + starter vehicles (no personal data)
  seed_demo.sql      Optional demo trips for today
  migrations/        Upgrades for databases created by older versions
tests/e2e.py       End-to-end API test (runs in CI)
.github/workflows/ CI: lint + tests on every push
```

## Deploy on InfinityFree (or any PHP + MySQL host)

1. Create a MySQL database in your hosting control panel and note the host, name, user and password.
2. Open phpMyAdmin, select the database, and **import `database/schema.sql`**. (Optional: also import `database/seed_demo.sql`.)
3. Copy `htdocs/config.sample.php` to `htdocs/config.php` and fill in your database details, `APP_URL` and `MAIL_FROM`.
4. Upload everything inside `htdocs/` (including the hidden `.htaccess`) to your host's `htdocs` folder.
5. Open your site and **create the first account immediately – it automatically becomes the coordinator.** Everyone after that signs up as a passenger; the coordinator promotes drivers under *Profile → Role and access*. To stop a stranger from claiming that first account on a public site, set `ADMIN_EMAIL` in `config.php` to your own email: then only that address can become the first coordinator.
6. Open the site on a phone and use *Install app* (or the browser menu → Add to Home screen).

> `config.php` holds your database password. It is excluded by `.gitignore` and blocked from web access by `.htaccess`. Never commit or share it.

### Installing the app on phones

The app shows an **Install** button when the browser allows it, otherwise a **How to install** guide with steps for Android, iPhone, Samsung Internet, Edge/desktop and in-app browsers (Facebook/Messenger cannot install web apps; open the link in Chrome or Safari). If the install prompt never appears on InfinityFree, make sure `index.html` is the latest version: the manifest is requested with `?i=1` and `crossorigin="use-credentials"` so the host's anti-bot check does not block it.

## Run locally

```bash
mysql -u root -e "CREATE DATABASE ridesync; CREATE USER 'rs'@'localhost' IDENTIFIED BY 'rs'; GRANT ALL ON ridesync.* TO 'rs'@'localhost';"
mysql -u root ridesync < database/schema.sql
cp htdocs/config.sample.php htdocs/config.php      # then edit: DB_HOST 127.0.0.1, name ridesync, user/pass rs
php -S 127.0.0.1:8099 -t htdocs
```

Open http://127.0.0.1:8099

## Tests

With a fresh database (schema only) and the PHP server running:

```bash
BASE_URL=http://127.0.0.1:8099 python3 tests/e2e.py
```

The script registers its own users and exercises every role and feature. GitHub Actions runs the same test on each push.

## Upgrading an existing install

Replace the files in `htdocs/` (keep your `config.php`). `api.php` adds any missing columns/tables automatically on first use; the SQL in `database/migrations/` does the same by hand if you prefer.

## Security notes

- Never commit `config.php`. Use your GitHub no-reply address for commits (`git config user.email "ID+USERNAME@users.noreply.github.com"`) so your personal email is not published in the history.
- Passwords are hashed (bcrypt via `password_hash`); sessions use CSRF tokens; login attempts are rate-limited; all queries are prepared statements; every action is role-checked on the server.
- Drivers see passengers' names and queue numbers only – never phone numbers or emails.
- If a secret was ever committed, rotate it (change the database password in your host panel) – deleting the file from Git history is not enough.
- Never commit database exports: they contain users' names, phone numbers, emails and password hashes (`*.sql` is git-ignored except under `database/`).

## License

MIT – see [LICENSE](LICENSE).
