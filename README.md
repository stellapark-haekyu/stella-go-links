# go-links

A tiny internal **go-links** server: map short slugs to full URLs and redirect.
Type `go/wiki` in your browser and land on your team wiki.

Built with **Node.js + Express** and the standard library only (no extra
runtime dependencies beyond Express). Link data is stored in a plain
`links.json` file.

## Features

- `GET /:slug` → look up the slug in `links.json` and `302` redirect to its URL (`404` if not found)
- `GET /` → web UI to manage links
- `POST /api/links` `{ slug, url }` → add a link (`409` if the slug already exists)
- `PUT /api/links/:slug` `{ url }` → update a link
- `DELETE /api/links/:slug` → delete a link
- Web UI with live search, live duplicate-slug checking, and inline editing
- `links.json` is created automatically on first run

## Requirements

- Node.js 18 or newer

## Run locally (macOS)

```bash
# 1. Install dependencies
npm install

# 2. Start the server (default port 3000)
npm start

# Or choose a port
PORT=8080 npm start
```

Then open <http://localhost:3000> to manage links, and
<http://localhost:3000/wiki> to test a redirect.

This works immediately, but you still have to type the `localhost:3000` prefix.
To get the short `go.test/wiki` experience, do the DNS setup below.

## Make `go.test/<slug>` work in the browser

There are two reasons a bare `go/linear` just runs a web search instead of
redirecting:

1. **`go` isn't mapped to anything.** The server listens on `localhost`, and the
   hostname `go` points nowhere — so the request never reaches the server.
2. **Browsers treat a dotless, scheme-less word as a search term.** Typing
   `go/linear` (no `http://`, no dot) makes Chrome/Safari search for it instead
   of treating it as an address.

The fix for both: use a **dotted hostname** like `go.test` and run the server on
port **80** (so no `:3000` is needed). The `.test` suffix is reserved by
standard for local testing and is never a real domain, so browsers always treat
it as an address — never a search.

### Setup (single Mac)

**1. Map `go.test` to your machine** in `/etc/hosts`:

```bash
echo "127.0.0.1   go.test" | sudo tee -a /etc/hosts
```

**2. Run the server on port 80** (binding to port 80 needs `sudo` on macOS):

```bash
cd go-links
sudo PORT=80 npm start
```

**3. Use it.** In the browser address bar type:

```
go.test/linear
```

It redirects to the registered URL. Because `go.test` contains a dot, the
browser treats it as an address right away — no search, no `http://` needed.

> Manage links at <http://go.test>. To stop using a custom hostname, remove the
> `127.0.0.1 go.test` line from `/etc/hosts`.

### Prefer a bare `go/<slug>`?

You can map `go` instead of `go.test`:

```bash
echo "127.0.0.1   go" | sudo tee -a /etc/hosts
```

But a dotless host like `go` is the case browsers tend to search. You then have
to type `http://go/linear` (with the scheme) at least the first time, after
which the browser usually remembers `go` as a host. `go.test` avoids this
entirely, which is why it's recommended.

### Whole team (internal DNS)

For company-wide use, add an A record on your internal DNS server (or router)
pointing `go` (or `go.yourcompany.internal`) to the machine running this server,
then run the server there on port 80. Everyone on the network can then use
`http://go/<slug>`.

## Run with Docker

```bash
# Build the image
docker build -t go-links .

# Run it, persisting links.json to the host
docker run -d --name go-links \
  -p 3000:3000 \
  -v "$(pwd)/links.json:/app/links.json" \
  go-links
```

Open <http://localhost:3000>. Change the published port with `-p 80:3000` to
serve on the default HTTP port.

## API examples

```bash
# Add a link
curl -X POST localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  -d '{"slug":"wiki","url":"https://wiki.example.com"}'

# Update a link
curl -X PUT localhost:3000/api/links/wiki \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://new-wiki.example.com"}'

# Delete a link
curl -X DELETE localhost:3000/api/links/wiki

# Use it
curl -i localhost:3000/wiki    # -> 302 redirect
```

## Data format

`links.json` is a flat object of `slug → url`:

```json
{
  "wiki": "https://wiki.example.com",
  "hr/vacation": "https://hr.example.com/vacation"
}
```

Nested slugs (containing `/`) are supported.
